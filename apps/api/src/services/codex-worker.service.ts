import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CodexWorkerMode, CodexWorkerProfile, CodexWorkerStep, Run } from "@atellier/shared";
import { RunService } from "./run.service";
import { WikiService } from "./wiki.service";

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
};

export class CodexWorkerService {
  constructor(
    private readonly runs: RunService,
    private readonly wiki: WikiService,
    private readonly atelierRoot: string,
  ) {}

  async create(input: CreateCodexWorkerRunInput): Promise<Run> {
    return this.runs.create({
      type: "build",
      status: "queued",
      input: { codexWorker: { goal: input.goal, mode: input.mode, profile: input.profile, steps: [] } },
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
      this.step("Implement bounded change and update tests", "pnpm test:api", "medium", true),
      this.step("Validate full project contract checks", "pnpm typecheck", "high", true),
    ];
    return this.runs.updateStatus(id, "queued", { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async approveStep(id: string, stepId: string): Promise<Run | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const steps = worker.steps.map((s) =>
      s.id === stepId && s.status === "pending" ? { ...s, status: "approved" as const, approvedAt: new Date().toISOString() } : s,
    );
    return this.runs.updateStatus(id, run.status, { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async executeNext(id: string): Promise<Run | { error: string } | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const idx = worker.steps.findIndex((s) => s.status === "approved" || (!s.needsApproval && s.status === "pending"));
    if (idx === -1) return { error: "No executable step available. Approve a step first." };
    const step = worker.steps[idx];
    if (step.needsApproval && step.status !== "approved") return { error: "Step requires approval before execution." };
    const startedAt = new Date().toISOString();
    const finishedAt = new Date().toISOString();
    const updated = worker.steps.map((s, i) =>
      i === idx
        ? { ...s, status: "completed" as const, startedAt, finishedAt, exitCode: 0, output: "Fake executor completed step." }
        : s,
    );
    await this.runs.appendLog(id, { level: "info", message: `Codex worker executed step: ${step.summary}` });
    return this.runs.updateStatus(id, "running", { ...(run.output as object | undefined), codexWorker: { ...worker, steps: updated } });
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
        ? { ...s, status: s.needsApproval ? ("approved" as const) : ("pending" as const), startedAt: undefined, finishedAt: undefined, exitCode: undefined, output: undefined }
        : s,
    );
    await this.runs.appendLog(id, { level: "info", message: `Codex worker retried step: ${step.summary}` });
    return this.runs.updateStatus(id, "queued", { ...(run.output as object | undefined), codexWorker: { ...worker, steps } });
  }

  async cancel(id: string): Promise<Run | null> {
    return this.runs.updateStatus(id, "blocked", { reason: "Cancelled by operator" });
  }

  async finalize(id: string, input: FinalizeCodexWorkerRunInput = {}): Promise<Run | null> {
    const run = await this.runs.getById(id);
    if (!run) return null;
    const worker = this.extract(run);
    if (!worker) return null;
    const now = new Date();
    const datePrefix = now.toISOString().slice(0, 10);
    const runPath = `runs/${datePrefix}-codex-worker-${id}.md`;
    const completed = worker.steps.filter((s) => s.status === "completed").length;
    const content = [
      "# Run Log - Codex Worker Finalize",
      "",
      "## Context",
      "",
      `- Run ID: ${id}`,
      `- Goal: ${worker.goal}`,
      `- Mode: ${worker.mode}`,
      `- Profile: ${worker.profile}`,
      "",
      "## Summary",
      "",
      input.summary ?? `Completed ${completed}/${worker.steps.length} planned steps.`,
      "",
      "## Steps",
      "",
      ...worker.steps.map((s) => `- ${s.summary} [${s.status}]`),
      "",
      "## Evidence",
      "",
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
      },
    });
    return this.runs.updateStatus(id, "completed", {
      ...(run.output as object | undefined),
      codexWorker: worker,
      finalize: { runLog: runPath, finalizedAt: now.toISOString() },
    });
  }

  private step(summary: string, command: string, riskLevel: "low" | "medium" | "high", needsApproval: boolean): CodexWorkerStep {
    return { id: randomUUID(), summary, command, workingDirectory: ".", riskLevel, needsApproval, status: "pending" };
  }

  private extract(run: Run): { mode: CodexWorkerMode; profile: CodexWorkerProfile; goal: string; steps: CodexWorkerStep[] } | null {
    const source = ((run.output as any)?.codexWorker ?? (run.input as any)?.codexWorker) as any;
    if (!source?.goal || !source?.mode || !source?.profile) return null;
    return { goal: source.goal, mode: source.mode, profile: source.profile, steps: Array.isArray(source.steps) ? source.steps : [] };
  }
}
