import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  CodexWorkerFinalizeEvidence,
  CodexWorkerExecutionAdapter,
  CodexWorkerMode,
  CodexWorkerProfile,
  CodexWorkerStep,
  Run,
} from "@atellier/shared";
import { RunService } from "./run.service";
import { WikiService } from "./wiki.service";
import {
  CodexWorkerSafetyError,
  FakeCodexWorkerExecutor,
  type CodexWorkerExecutionResult,
  type CodexWorkerExecutor,
} from "./codex-worker-executor.service";
import { MemoryEffectIdempotencyRepository } from "./effect-idempotency.repository";
import { EffectIdempotencyService } from "./effect-idempotency.service";

type CreateCodexWorkerRunInput = {
  goal: string;
  mode: CodexWorkerMode;
  profile: CodexWorkerProfile;
};
type FinalizeCodexWorkerRunInput = {
  summary?: string;
  changedFiles?: string[];
  testEvidence?: string[];
};

type CodexWorkerRunView = {
  run: Run;
  mode: CodexWorkerMode;
  profile: CodexWorkerProfile;
  goal: string;
  steps: CodexWorkerStep[];
  executionAdapter: CodexWorkerExecutionAdapter;
};

type ExtractedCodexWorker = {
  mode: CodexWorkerMode;
  profile: CodexWorkerProfile;
  goal: string;
  steps: CodexWorkerStep[];
  executionAdapter: CodexWorkerExecutionAdapter;
};

export class CodexWorkerService {
  private readonly activeExecutions = new Map<string, AbortController>();

  constructor(
    private readonly runs: RunService,
    private readonly wiki: WikiService,
    private readonly atelierRoot: string,
    private readonly executor: CodexWorkerExecutor = new FakeCodexWorkerExecutor(),
    private readonly effectIdempotency = new EffectIdempotencyService(
      new MemoryEffectIdempotencyRepository(),
    ),
  ) {}

  getExecutionAdapter(): CodexWorkerExecutionAdapter {
    return { mode: this.executor.mode, label: this.executor.label };
  }

  async create(input: CreateCodexWorkerRunInput): Promise<Run> {
    return this.runs.create({
      type: "build",
      status: "queued",
      input: {
        codexWorker: {
          goal: input.goal,
          mode: input.mode,
          profile: input.profile,
          steps: [],
          executionAdapter: { mode: this.executor.mode, label: this.executor.label },
        },
      },
    });
  }

  async getById(id: string): Promise<CodexWorkerRunView | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    return { run, ...worker };
  }

  async plan(id: string): Promise<Run | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const steps: CodexWorkerStep[] = [
      this.step("Inspect relevant files and constraints", "rg --files", "low", false),
      this.step("Implement bounded change with Codex", "codex exec", "medium", true),
      this.step("Capture the workspace diff", "git diff --no-ext-diff", "low", false),
      this.step("Validate full project contract checks", "pnpm typecheck", "high", true),
    ];
    return this.runs.updateStatus(id, "queued", { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async approveStep(id: string, stepId: string): Promise<Run | { error: string } | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const target = worker.steps.find((step) => step.id === stepId);
    if (!target) return { error: "Step not found." };
    if (!target.needsApproval) return { error: "This step does not require approval." };
    if (target.status === "completed") return { error: "Completed steps cannot be approved again." };
    if (target.status === "failed" || target.status === "blocked") {
      return { error: "Retry the step before approving it again." };
    }
    const steps = worker.steps.map((s) =>
      s.id === stepId && s.status === "pending" ? { ...s, status: "approved" as const, approvedAt: new Date().toISOString() } : s,
    );
    return this.runs.updateStatus(id, run.status, { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async executeNext(id: string): Promise<Run | { error: string } | null> {
    if (this.activeExecutions.has(id)) {
      return { error: "A Codex worker step is already executing for this run." };
    }
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    if (run.status === "blocked") return { error: "Run is cancelled or blocked." };
    if (run.status === "completed") return { error: "Run is already completed." };
    if (worker.mode === "dry_run") return { error: "Dry-run mode only previews the plan and cannot execute commands." };
    if (worker.executionAdapter.mode !== this.executor.mode) {
      return { error: `Run requires the ${worker.executionAdapter.mode} execution adapter, but ${this.executor.mode} is active.` };
    }
    if (worker.steps.length === 0) return { error: "Run has not been planned yet." };
    const idx = worker.steps.findIndex((step) => step.status !== "completed");
    if (idx === -1) return { error: "No executable step available." };
    const step = worker.steps[idx];
    if (step.status === "running") return { error: "The next Codex worker step is already running." };
    if (step.status === "failed" || step.status === "blocked") {
      return { error: "Retry the failed or blocked step before continuing." };
    }
    if (step.needsApproval && step.status !== "approved") {
      return { error: "No executable step available. Approve a step first." };
    }
    const startedAtDate = new Date();
    const startedAt = startedAtDate.toISOString();
    const datePrefix = startedAt.slice(0, 10);
    const artifactBaseName = `${datePrefix}-codex-worker-${id}-step-${idx + 1}-${step.id}`;
    const stdoutPath = `runs/artifacts/${artifactBaseName}.stdout.log`;
    const stderrPath = `runs/artifacts/${artifactBaseName}.stderr.log`;
    const stdoutAbsolute = path.join(this.atelierRoot, stdoutPath);
    const stderrAbsolute = path.join(this.atelierRoot, stderrPath);
    const runningSteps = worker.steps.map((candidate, stepIndex) =>
      stepIndex === idx
        ? { ...candidate, status: "running" as const, startedAt }
        : candidate,
    );
    const runningRun = await this.runs.updateStatus(id, "running", {
      ...(run.output as object | undefined),
      codexWorker: { ...worker, steps: runningSteps },
    });
    if (!runningRun) return null;
    await mkdir(path.dirname(stdoutAbsolute), { recursive: true });
    let safetyFailure = false;
    let idempotencyDisposition: "executed" | "reused" | "failed" | null = null;
    let execution: CodexWorkerExecutionResult;
    const controller = new AbortController();
    this.activeExecutions.set(id, controller);
    try {
      const executionInput = {
        runId: id,
        stepId: step.id,
        goal: worker.goal,
        profile: worker.profile,
        command: step.command,
        workingDirectory: step.workingDirectory,
        signal: controller.signal,
      };
      const irreversible = this.executor.mode === "real" && step.command === "codex exec";
      const attempt = step.executionAttempt ?? 1;
      const outcome = await this.effectIdempotency.execute(
        {
          toolName: "codex-worker",
          classification: irreversible ? "irreversible" : "read",
          ...(irreversible
            ? {
                idempotencyKey: `codex-worker:${id}:${step.id}:${attempt}`,
                fingerprint: this.executionFingerprint(worker, step, attempt),
              }
            : {}),
        },
        () => this.executor.execute(executionInput),
      );
      if (outcome.disposition === "in-progress") {
        const current = await this.runs.getById(id);
        if (current?.status !== "blocked") {
          await this.runs.updateStatus(id, "queued", {
            ...(run.output as object | undefined),
            codexWorker: worker,
          });
        }
        return { error: "This approved Codex effect is already in progress." };
      }
      if (outcome.disposition === "failed") {
        idempotencyDisposition = "failed";
        execution = {
          stdout: "",
          stderr: outcome.error,
          exitCode: null,
          durationMs: Math.max(0, Date.now() - startedAtDate.getTime()),
          timedOut: false,
        };
      } else {
        idempotencyDisposition = outcome.disposition;
        execution = outcome.result;
      }
    } catch (error) {
      safetyFailure = error instanceof CodexWorkerSafetyError;
      execution = {
        stdout: "",
        stderr: error instanceof Error ? error.message : "Codex worker execution failed before process start.",
        exitCode: null,
        durationMs: Math.max(0, Date.now() - startedAtDate.getTime()),
        timedOut: false,
      };
    } finally {
      if (this.activeExecutions.get(id) === controller) {
        this.activeExecutions.delete(id);
      }
    }
    const stdoutContent = execution.stdout;
    const stderrContent = execution.stderr;
    await writeFile(stdoutAbsolute, stdoutContent, "utf8");
    await writeFile(stderrAbsolute, stderrContent, "utf8");
    const finishedAtDate = new Date();
    const finishedAt = finishedAtDate.toISOString();
    const durationMs = Math.max(0, execution.durationMs);
    const failed = safetyFailure || execution.cancelled || execution.timedOut || execution.exitCode !== 0;
    const stepStatus = safetyFailure || execution.cancelled
      ? "blocked" as const
      : failed
        ? "failed" as const
        : "completed" as const;
    const executorName = this.executor.mode === "fake" ? "Fake executor" : "Real allowlisted executor";
    const evidenceSummary = safetyFailure
      ? "Execution blocked by Codex worker safety policy."
      : execution.cancelled
        ? `${executorName} was cancelled by the operator.`
      : execution.timedOut
        ? `${executorName} timed out.`
        : execution.exitCode === 0
          ? `${executorName} completed step.`
          : `${executorName} failed with exit code ${execution.exitCode ?? "unknown"}.`;
    const notes = [
      `Execution adapter: ${this.executor.label} (${this.executor.mode}).`,
      `stdout written to ${stdoutPath}`,
      `stderr written to ${stderrPath}`,
    ];
    if (execution.stdoutTruncated) notes.push("stdout was truncated at the configured capture limit.");
    if (execution.stderrTruncated) notes.push("stderr was truncated at the configured capture limit.");
    if (execution.timedOut) notes.push("Process exceeded the configured timeout and was terminated.");
    if (execution.cancelled) notes.push("Process was terminated after operator cancellation.");
    if (idempotencyDisposition) notes.push(`Idempotency disposition: ${idempotencyDisposition}.`);
    const evidence = {
      summary: evidenceSummary,
      capturedAt: finishedAt,
      command: step.command,
      workingDirectory: step.workingDirectory,
      durationMs,
      notes,
      artifacts: [
        { label: "stdout", path: stdoutPath, byteSize: Buffer.byteLength(stdoutContent, "utf8") },
        { label: "stderr", path: stderrPath, byteSize: Buffer.byteLength(stderrContent, "utf8") },
      ],
    };
    const updated = worker.steps.map((s, i) =>
      i === idx
        ? {
            ...s,
            status: stepStatus,
            startedAt,
            finishedAt,
            exitCode: execution.exitCode ?? undefined,
            output: execution.stdout.trim() || execution.stderr.trim() || evidenceSummary,
            stdoutPath,
            stderrPath,
            evidence,
          }
        : s,
    );
    await this.runs.appendLog(id, {
      level: failed ? "error" : "info",
      message: `${evidenceSummary} Step: ${step.summary}`,
    });
    const allCompleted = updated.every((candidate) => candidate.status === "completed");
    const latestRun = await this.runs.getById(id);
    const computedStatus = allCompleted
      ? "completed"
      : safetyFailure || execution.cancelled
        ? "blocked"
        : failed
          ? "failed"
          : "running";
    return this.runs.updateStatus(
      id,
      latestRun?.status === "blocked" ? "blocked" : computedStatus,
      { ...(latestRun?.output as object | undefined), codexWorker: { ...worker, steps: updated } },
    );
  }

  async retryStep(id: string, stepId: string): Promise<Run | { error: string } | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const step = worker.steps.find((s) => s.id === stepId);
    if (!step) return { error: "Step not found." };
    if (step.status !== "failed" && step.status !== "blocked") {
      return { error: "Only failed or blocked steps can be retried." };
    }
    const steps = worker.steps.map((s) =>
      s.id === stepId
        ? {
            ...s,
            status: "pending" as const,
            executionAttempt: (s.executionAttempt ?? 1) + 1,
            approvedAt: undefined,
            startedAt: undefined,
            finishedAt: undefined,
            exitCode: undefined,
            output: undefined,
            stdoutPath: undefined,
            stderrPath: undefined,
            evidence: undefined,
          }
        : s,
    );
    await this.runs.appendLog(id, { level: "info", message: `Codex worker retried step: ${step.summary}` });
    return this.runs.updateStatus(id, "queued", { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async cancel(id: string): Promise<Run | { error: string } | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    if (run.status === "completed") return { error: "Completed runs cannot be cancelled." };
    if (run.status === "blocked") return { error: "Run is already cancelled." };
    this.activeExecutions.get(id)?.abort(new Error("Cancelled by operator."));
    const worker = this.extract(run);
    const now = new Date().toISOString();
    const steps = worker?.steps.map((step) =>
      step.status === "running"
        ? {
            ...step,
            status: "blocked" as const,
            finishedAt: now,
            output: "Cancelled by operator.",
          }
        : step,
    );
    return this.runs.updateStatus(id, "blocked", {
      ...(run.output as object | undefined),
      reason: "Cancelled by operator",
      ...(worker ? { codexWorker: { ...worker, steps } } : {}),
    });
  }

  async finalize(id: string, input: FinalizeCodexWorkerRunInput = {}): Promise<Run | { error: string } | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    if (worker.steps.length === 0) {
      return { error: "Cannot finalize before planning steps." };
    }
    const unresolved = worker.steps.filter((step) => step.status !== "completed");
    if (unresolved.length > 0) {
      return { error: "Cannot finalize while there are unresolved steps." };
    }
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10);
    const runPath = `runs/${datePrefix}-codex-worker-${id}.md`;
    const completed = worker.steps.filter((s) => s.status === "completed").length;
    const failed = worker.steps.filter((s) => s.status === "failed").length;
    const blocked = worker.steps.filter((s) => s.status === "blocked").length;
    const totalDurationMs = worker.steps.reduce((sum, step) => {
      const value = step.evidence?.durationMs;
      return sum + (typeof value === "number" && Number.isFinite(value) ? value : 0);
    }, 0);
    const artifactCount = worker.steps.reduce((sum, step) => sum + (step.evidence?.artifacts.length ?? 0), 0);
    const content = [
      "# Run Log - Codex Worker Finalize",
      "",
      "## Context",
      "",
      `- Run ID: ${id}`,
      `- Goal: ${worker.goal}`,
      `- Mode: ${worker.mode}`,
      `- Profile: ${worker.profile}`,
      `- Execution adapter: ${worker.executionAdapter.label} (${worker.executionAdapter.mode})`,
      "",
      "## Summary",
      "",
      input.summary ?? `Completed ${completed}/${worker.steps.length} planned steps.`,
      "",
      "## Steps",
      "",
      ...worker.steps.flatMap((s) => {
        const lines = [`- ${s.summary} [${s.status}]`];
        if (s.evidence) {
          lines.push(`  - evidence: ${s.evidence.summary}`);
          lines.push(`  - capturedAt: ${s.evidence.capturedAt}`);
          lines.push(`  - command: ${s.evidence.command}`);
          lines.push(`  - workingDirectory: ${s.evidence.workingDirectory}`);
          if (s.evidence.notes.length > 0) {
            lines.push("  - notes:");
            lines.push(...s.evidence.notes.map((note) => `    - ${note}`));
          }
          if (s.evidence.artifacts.length > 0) {
            lines.push("  - artifacts:");
            lines.push(...s.evidence.artifacts.map((artifact) => `    - ${artifact.label}: ${artifact.path}`));
          }
        }
        if (s.exitCode !== undefined) lines.push(`  - exitCode: ${s.exitCode}`);
        if (s.stdoutPath) lines.push(`  - stdout: ${s.stdoutPath}`);
        if (s.stderrPath) lines.push(`  - stderr: ${s.stderrPath}`);
        return lines;
      }),
      "",
      "## Evidence",
      "",
      `- Completed steps: ${completed}/${worker.steps.length}`,
      `- Failed steps: ${failed}`,
      `- Blocked steps: ${blocked}`,
      `- Total step duration: ${totalDurationMs} ms`,
      `- Captured artifacts: ${artifactCount}`,
      `- Changed files: ${(input.changedFiles ?? []).length}`,
      ...(input.changedFiles ?? []).map((file) => `  - ${file}`),
      `- Test evidence: ${(input.testEvidence ?? []).length}`,
      ...(input.testEvidence ?? []).map((evidence) => `  - ${evidence}`),
      "",
      "## Verification",
      "",
      "- Phase 3 finalize generated run artifact and wiki event.",
      "",
    ].join("\n");
    const absolute = path.join(this.atelierRoot, runPath);
    await mkdir(path.dirname(absolute), { recursive: true });
    await writeFile(absolute, content, "utf8");
    await this.wiki.appendLog({
      eventType: "decision",
      title: "Codex worker run finalized",
      summary: input.summary ?? `Codex worker run ${id} finalized.`,
      runId: id,
      details: {
        runLog: runPath,
        completedSteps: completed,
        totalSteps: worker.steps.length,
        changedFiles: (input.changedFiles ?? []).join(", "),
        testEvidence: (input.testEvidence ?? []).join(", "),
        evidenceCompletedSteps: completed,
        evidenceTotalSteps: worker.steps.length,
        evidenceFailedSteps: failed,
        evidenceBlockedSteps: blocked,
        evidenceTotalDurationMs: totalDurationMs,
        evidenceArtifactCount: artifactCount,
      },
    });
    return this.runs.updateStatus(id, "completed", {
      ...(run.output as object | undefined),
      codexWorker: worker,
      finalize: {
        runLog: runPath,
        finalizedAt: now.toISOString(),
        evidence: {
          completedSteps: completed,
          totalSteps: worker.steps.length,
          failedSteps: failed,
          blockedSteps: blocked,
          totalDurationMs,
          artifactCount,
          changedFiles: input.changedFiles ?? [],
          testEvidence: input.testEvidence ?? [],
        } satisfies CodexWorkerFinalizeEvidence,
      },
    });
  }

  async latestActive(): Promise<CodexWorkerRunView | null> {
    const runs = await this.runs.list();
    const active = runs.find((r) => {
      const hasCodex = !!(
        (r.input as Record<string, unknown> | undefined)?.codexWorker ??
        (r.output as Record<string, unknown> | undefined)?.codexWorker
      );
      return hasCodex && (r.status === "queued" || r.status === "running");
    });
    if (!active) return null;
    return this.getById(active.id);
  }

  private step(summary: string, command: string, riskLevel: "low" | "medium" | "high", needsApproval: boolean): CodexWorkerStep {
    return {
      id: randomUUID(),
      summary,
      command,
      workingDirectory: ".",
      riskLevel,
      needsApproval,
      status: "pending",
      executionAttempt: 1,
    };
  }

  private executionFingerprint(
    worker: ExtractedCodexWorker,
    step: CodexWorkerStep,
    attempt: number,
  ): string {
    return createHash("sha256")
      .update(JSON.stringify({
        adapter: worker.executionAdapter,
        attempt,
        command: step.command,
        goal: worker.goal,
        profile: worker.profile,
        workingDirectory: step.workingDirectory,
      }))
      .digest("hex");
  }

  private extract(run: Run): ExtractedCodexWorker | null {
    const source = ((run.output as any)?.codexWorker ?? (run.input as any)?.codexWorker) as any;
    if (!source?.goal || !source?.mode || !source?.profile) return null;
    const executionAdapter = source.executionAdapter?.mode === "real" || source.executionAdapter?.mode === "fake"
      ? { mode: source.executionAdapter.mode, label: String(source.executionAdapter.label ?? source.executionAdapter.mode) }
      : { mode: this.executor.mode, label: this.executor.label };
    return {
      goal: source.goal,
      mode: source.mode,
      profile: source.profile,
      steps: Array.isArray(source.steps) ? source.steps : [],
      executionAdapter,
    };
  }
}
