import { mkdir, mkdtemp, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  CodexWorkerSafetyError,
  RealCodexWorkerExecutor,
  type CodexProcessRunner,
  type CodexProcessRunnerInput,
  type CodexWorkerExecutionResult,
} from "../services/codex-worker-executor.service";
import { CodexWorkerService } from "../services/codex-worker.service";
import { EffectIdempotencyService } from "../services/effect-idempotency.service";
import { MemoryEffectIdempotencyRepository } from "../services/effect-idempotency.repository";
import { RunService } from "../services/run.service";
import { WikiService } from "../services/wiki.service";
import { createAppServices } from "../services/app-services";

class FakeProcessRunner implements CodexProcessRunner {
  readonly calls: CodexProcessRunnerInput[] = [];

  constructor(
    private readonly result: CodexWorkerExecutionResult = {
      stdout: "controlled output\n",
      stderr: "",
      exitCode: 0,
      durationMs: 17,
      timedOut: false,
    },
  ) {}

  async run(input: CodexProcessRunnerInput): Promise<CodexWorkerExecutionResult> {
    this.calls.push(input);
    return this.result;
  }
}

class SequencedProcessRunner implements CodexProcessRunner {
  readonly calls: CodexProcessRunnerInput[] = [];

  constructor(private readonly results: CodexWorkerExecutionResult[]) {}

  async run(input: CodexProcessRunnerInput): Promise<CodexWorkerExecutionResult> {
    this.calls.push(input);
    const result = this.results.shift();
    if (!result) throw new Error("Missing fake process result.");
    return result;
  }
}

class CancelAwareProcessRunner implements CodexProcessRunner {
  readonly calls: CodexProcessRunnerInput[] = [];
  private releaseStarted!: () => void;
  readonly started = new Promise<void>((resolve) => {
    this.releaseStarted = resolve;
  });

  async run(input: CodexProcessRunnerInput): Promise<CodexWorkerExecutionResult> {
    this.calls.push(input);
    this.releaseStarted();
    return new Promise((resolve) => {
      const finish = (): void => resolve({
        stdout: "",
        stderr: "cancelled",
        exitCode: null,
        durationMs: 4,
        timedOut: false,
        cancelled: true,
      });
      if (input.signal?.aborted) finish();
      else input.signal?.addEventListener("abort", finish, { once: true });
    });
  }
}

describe("controlled Codex worker executor", () => {
  let root: string;
  let repositoryRoot: string;
  let atelierRoot: string;

  beforeEach(async () => {
    root = await mkdtemp(path.join(tmpdir(), "atellier-codex-executor-"));
    repositoryRoot = path.join(root, "repo");
    atelierRoot = path.join(repositoryRoot, "atelier");
    await mkdir(path.join(repositoryRoot, "apps", "api"), { recursive: true });
    await mkdir(atelierRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("keeps real execution disabled unless app services receive the explicit opt-in", async () => {
    const fakeServices = await createAppServices({
      atelierRoot,
      storageMode: "memory",
      seedDemoData: false,
    });
    const realServices = await createAppServices({
      atelierRoot,
      storageMode: "memory",
      seedDemoData: false,
      codexWorkerRealEnabled: true,
    });

    expect(fakeServices.codexWorkers.getExecutionAdapter()).toEqual({
      mode: "fake",
      label: "fake-safe",
    });
    expect(realServices.codexWorkers.getExecutionAdapter()).toEqual({
      mode: "real",
      label: "real-allowlisted",
    });
  });

  it("builds a fixed no-shell codex exec argv with the goal as one argument", async () => {
    const processRunner = new FakeProcessRunner();
    const executor = new RealCodexWorkerExecutor({
      repositoryRoot,
      allowedWorkingDirectories: ["apps/api"],
      processRunner,
      timeoutMs: 4321,
      maxOutputBytes: 1234,
    });

    const result = await executor.execute({
      runId: "run-1",
      stepId: "step-1",
      goal: "Implement the bounded API change; do not treat this as a shell command",
      profile: "deep",
      command: "codex exec",
      workingDirectory: "apps/api",
    });

    expect(result.stdout).toBe("controlled output\n");
    expect(processRunner.calls).toHaveLength(1);
    const call = processRunner.calls[0];
    expect(call.executable).toBe("codex");
    expect(call.cwd).toBe(await realpath(path.join(repositoryRoot, "apps", "api")));
    expect(call.timeoutMs).toBe(4321);
    expect(call.maxOutputBytes).toBe(1234);
    expect(call.argv).toEqual([
      "exec",
      "--cd",
      call.cwd,
      "--sandbox",
      "workspace-write",
      "--approve-for-me",
      "--ephemeral",
      expect.any(String),
    ]);
    const prompt = call.argv.at(-1);
    expect(prompt).toContain("Implement the bounded API change; do not treat this as a shell command");
    expect(prompt).toContain("Use deep reasoning");
    expect(call.argv.filter((argument) => argument.includes("Implement the bounded API change"))).toHaveLength(1);
  });

  it("rejects command variants instead of parsing a shell string", async () => {
    const processRunner = new FakeProcessRunner();
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });

    await expect(executor.execute({
      runId: "run-1",
      stepId: "step-1",
      goal: "Unsafe command lookup",
      profile: "standard",
      command: "codex exec --dangerously-bypass-approvals-and-sandbox",
      workingDirectory: ".",
    })).rejects.toThrow(new CodexWorkerSafetyError(
      "Command is not allowlisted: codex exec --dangerously-bypass-approvals-and-sandbox",
    ));
    expect(processRunner.calls).toHaveLength(0);
  });

  it("rejects dangerous flags even when a command envelope is configured", async () => {
    const processRunner = new FakeProcessRunner();
    const executor = new RealCodexWorkerExecutor({
      repositoryRoot,
      processRunner,
      allowedCommands: {
        unsafe: {
          executable: "codex",
          argv: ["exec", "--dangerously-bypass-approvals-and-sandbox"],
        },
      },
    });

    await expect(executor.execute({
      runId: "run-1",
      stepId: "step-1",
      goal: "Unsafe envelope",
      profile: "standard",
      command: "unsafe",
      workingDirectory: ".",
    })).rejects.toThrow("Dangerous command argument is forbidden");
    expect(processRunner.calls).toHaveLength(0);
  });

  it("rejects lexical and symlink working-directory escapes", async () => {
    const outside = path.join(root, "outside");
    await mkdir(outside);
    await symlink(outside, path.join(repositoryRoot, "outside-link"));
    const processRunner = new FakeProcessRunner();
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });
    const baseInput = {
      runId: "run-1",
      stepId: "step-1",
      goal: "Inspect safely",
      profile: "standard" as const,
      command: "rg --files",
    };

    await expect(executor.execute({ ...baseInput, workingDirectory: "../outside" })).rejects.toThrow(
      "Working directory escapes the configured repository root.",
    );
    await expect(executor.execute({ ...baseInput, workingDirectory: "outside-link" })).rejects.toThrow(
      "Working directory escapes the configured repository root.",
    );
    expect(processRunner.calls).toHaveLength(0);
  });

  it("keeps real execution behind the existing per-step approval gate and captures evidence", async () => {
    const processRunner = new FakeProcessRunner();
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });
    const wiki = new WikiService(atelierRoot);
    const runs = new RunService("memory", wiki);
    const service = new CodexWorkerService(runs, wiki, atelierRoot, executor);
    const run = await service.create({
      goal: "Implement with controlled Codex",
      mode: "approved_step",
      profile: "standard",
    });
    await service.plan(run.id);

    await service.executeNext(run.id);
    const beforeApproval = await service.executeNext(run.id);
    expect(beforeApproval).toEqual({ error: "No executable step available. Approve a step first." });
    expect(processRunner.calls).toHaveLength(1);

    const planned = await service.getById(run.id);
    const codexStep = planned?.steps.find((step) => step.command === "codex exec");
    expect(planned?.executionAdapter).toEqual({ mode: "real", label: "real-allowlisted" });
    expect(codexStep?.status).toBe("pending");
    await service.approveStep(run.id, codexStep!.id);
    await service.executeNext(run.id);

    expect(processRunner.calls).toHaveLength(2);
    expect(processRunner.calls[1]?.executable).toBe("codex");
    const executed = await service.getById(run.id);
    const completedCodexStep = executed?.steps.find((step) => step.id === codexStep?.id);
    expect(completedCodexStep?.status).toBe("completed");
    expect(completedCodexStep?.evidence).toMatchObject({
      summary: "Real allowlisted executor completed step.",
      durationMs: 17,
    });
    expect(completedCodexStep?.evidence?.notes).toContain("Execution adapter: real-allowlisted (real).");
    expect(completedCodexStep?.stdoutPath).toBeDefined();
    expect(completedCodexStep?.stderrPath).toBeDefined();
  });

  it("persists timeout, truncated output, exit state, and duration from the process runner", async () => {
    const processRunner = new FakeProcessRunner({
      stdout: "partial stdout",
      stderr: "process timed out",
      exitCode: null,
      durationMs: 2500,
      timedOut: true,
      stdoutTruncated: true,
      stderrTruncated: true,
    });
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });
    const wiki = new WikiService(atelierRoot);
    const runs = new RunService("memory", wiki);
    const service = new CodexWorkerService(runs, wiki, atelierRoot, executor);
    const run = await service.create({
      goal: "Capture timeout evidence",
      mode: "approved_step",
      profile: "cheap",
    });
    await service.plan(run.id);

    const result = await service.executeNext(run.id);
    expect(result && !("error" in result) ? result.status : null).toBe("failed");
    const view = await service.getById(run.id);
    const failedStep = view?.steps[0];
    expect(failedStep).toMatchObject({
      status: "failed",
      output: "partial stdout",
      exitCode: undefined,
      evidence: {
        summary: "Real allowlisted executor timed out.",
        durationMs: 2500,
      },
    });
    expect(failedStep?.evidence?.notes).toEqual(expect.arrayContaining([
      "stdout was truncated at the configured capture limit.",
      "stderr was truncated at the configured capture limit.",
      "Process exceeded the configured timeout and was terminated.",
    ]));
    expect(failedStep?.evidence?.artifacts).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "stdout", byteSize: Buffer.byteLength("partial stdout") }),
      expect.objectContaining({ label: "stderr", byteSize: Buffer.byteLength("process timed out") }),
    ]));
  });

  it("uses a new idempotency key and requires fresh approval for an explicit retry", async () => {
    const success = (stdout: string): CodexWorkerExecutionResult => ({
      stdout,
      stderr: "",
      exitCode: 0,
      durationMs: 5,
      timedOut: false,
    });
    const processRunner = new SequencedProcessRunner([
      success("inspection"),
      { stdout: "", stderr: "codex failed", exitCode: 1, durationMs: 8, timedOut: false },
      success("codex retry completed"),
    ]);
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });
    const wiki = new WikiService(atelierRoot);
    const runs = new RunService("memory", wiki);
    const repository = new MemoryEffectIdempotencyRepository();
    const service = new CodexWorkerService(
      runs,
      wiki,
      atelierRoot,
      executor,
      new EffectIdempotencyService(repository),
    );
    const run = await service.create({
      goal: "Retry an approved Codex effect",
      mode: "approved_step",
      profile: "standard",
    });
    await service.plan(run.id);
    await service.executeNext(run.id);
    const planned = await service.getById(run.id);
    const codexStep = planned!.steps.find((step) => step.command === "codex exec")!;
    await service.approveStep(run.id, codexStep.id);
    await service.executeNext(run.id);

    const firstKey = `codex-worker:${run.id}:${codexStep.id}:1`;
    expect(await repository.findByKey(firstKey)).toMatchObject({ status: "completed" });
    await expect(service.latestActive()).resolves.toBeNull();
    await service.retryStep(run.id, codexStep.id);
    const retried = await service.getById(run.id);
    expect(retried!.steps.find((step) => step.id === codexStep.id)).toMatchObject({
      status: "pending",
      executionAttempt: 2,
      approvedAt: undefined,
    });
    await expect(service.executeNext(run.id)).resolves.toEqual({
      error: "No executable step available. Approve a step first.",
    });
    await service.approveStep(run.id, codexStep.id);
    await service.executeNext(run.id);

    const secondKey = `codex-worker:${run.id}:${codexStep.id}:2`;
    expect(await repository.findByKey(secondKey)).toMatchObject({ status: "completed" });
    expect(processRunner.calls).toHaveLength(3);
  });

  it("aborts an active allowlisted process when the operator cancels the run", async () => {
    const processRunner = new CancelAwareProcessRunner();
    const executor = new RealCodexWorkerExecutor({ repositoryRoot, processRunner });
    const wiki = new WikiService(atelierRoot);
    const runs = new RunService("memory", wiki);
    const service = new CodexWorkerService(runs, wiki, atelierRoot, executor);
    const run = await service.create({
      goal: "Cancel active controlled execution",
      mode: "approved_step",
      profile: "standard",
    });
    await service.plan(run.id);

    const execution = service.executeNext(run.id);
    await processRunner.started;
    await service.cancel(run.id);
    const settled = await execution;

    expect(processRunner.calls[0]?.signal?.aborted).toBe(true);
    expect(settled && !("error" in settled) ? settled.status : null).toBe("blocked");
    expect(settled && !("error" in settled) ? settled.output : null).toMatchObject({
      reason: "Cancelled by operator",
    });
    const view = await service.getById(run.id);
    expect(view?.steps[0]).toMatchObject({
      status: "blocked",
      output: "cancelled",
      evidence: { summary: "Real allowlisted executor was cancelled by the operator." },
    });
  });
});
