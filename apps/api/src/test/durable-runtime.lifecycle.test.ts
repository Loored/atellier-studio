import type { Run } from "@atellier/shared";
import { describe, expect, it, vi } from "vitest";
import {
  DurableRuntimeService,
  type DurableWorkerDiagnosticEvent,
} from "../services/durable-runtime.service";
import type { ExecutionQueueService } from "../services/execution-queue.service";
import type { SkillOrchestrationService } from "../services/skill-orchestration.service";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createClaimedRun(): Run {
  const now = new Date().toISOString();
  return {
    id: "run-lifecycle",
    type: "orchestration",
    status: "running",
    input: { skillId: "wiki-dream-loop", goal: "Test worker lifecycle." },
    execution: {
      schemaVersion: 1,
      kind: "skill-orchestration",
      phase: "running",
      definitionHash: "lifecycle-test",
      definitionSnapshot: { id: "wiki-dream-loop", steps: [] },
      idempotencyKey: "lifecycle-test",
      attempt: 1,
      maxAttempts: 3,
      nextEventSequence: 0,
      availableAt: now,
      leaseOwner: "worker-lifecycle",
      leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
    },
    logs: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createQueue(claim: ReturnType<typeof vi.fn>) {
  return {
    leaseMs: 3_000,
    claim,
    heartbeat: vi.fn().mockResolvedValue(true),
    isCancellationRequested: vi.fn().mockResolvedValue(false),
    setPhase: vi.fn(),
    recordStepStarted: vi.fn(),
    recordStepCompleted: vi.fn(),
    recordStepReused: vi.fn(),
    markCompleted: vi.fn().mockResolvedValue(createClaimedRun()),
    markCancelled: vi.fn(),
    handleFailure: vi.fn(),
    requestCancel: vi.fn(),
    retry: vi.fn(),
    recordQueued: vi.fn(),
  } as unknown as ExecutionQueueService;
}

function createOrchestrations(executeClaimed: ReturnType<typeof vi.fn>) {
  return {
    executeClaimed,
    enqueue: vi.fn(),
  } as unknown as SkillOrchestrationService;
}

describe("durable runtime lifecycle", () => {
  it("waits for active work before stopping and prevents another claim", async () => {
    const run = createClaimedRun();
    const executionStarted = deferred();
    const releaseExecution = deferred();
    const claim = vi.fn()
      .mockResolvedValueOnce(run)
      .mockResolvedValue(null);
    const queue = createQueue(claim);
    const executeClaimed = vi.fn(async () => {
      executionStarted.resolve();
      await releaseExecution.promise;
    });
    const diagnostics: DurableWorkerDiagnosticEvent[] = [];
    const runtime = new DurableRuntimeService(queue, createOrchestrations(executeClaimed), {
      pollMs: 5_000,
      workerId: "worker-lifecycle",
      onDiagnostic: (event) => diagnostics.push(event),
    });

    const polling = runtime.startPolling();
    await executionStarted.promise;
    const stopping = runtime.stop();
    let stopResolved = false;
    void stopping.then(() => {
      stopResolved = true;
    });
    await Promise.resolve();

    expect(stopResolved).toBe(false);
    expect(runtime.getDiagnostics()).toMatchObject({
      workerId: "worker-lifecycle",
      state: "stopping",
      currentRunId: run.id,
      processedRuns: 0,
    });

    releaseExecution.resolve();
    await Promise.all([stopping, polling]);

    expect(claim).toHaveBeenCalledTimes(1);
    expect(queue.markCompleted).toHaveBeenCalledWith(run.id, "worker-lifecycle");
    expect(runtime.getDiagnostics()).toMatchObject({
      state: "stopped",
      currentRunId: null,
      processedRuns: 1,
      lastError: null,
      startedAt: expect.any(String),
      stoppingAt: expect.any(String),
      stoppedAt: expect.any(String),
    });
    expect(diagnostics.map((event) => event.event)).toEqual([
      "started",
      "run_claimed",
      "stopping",
      "run_settled",
      "stopped",
    ]);
  });

  it("interrupts an idle poll delay during shutdown", async () => {
    const firstClaim = deferred();
    const claim = vi.fn(async () => {
      firstClaim.resolve();
      return null;
    });
    const diagnostics: DurableWorkerDiagnosticEvent[] = [];
    const runtime = new DurableRuntimeService(
      createQueue(claim),
      createOrchestrations(vi.fn()),
      {
        pollMs: 5_000,
        workerId: "worker-idle",
        onDiagnostic: (event) => diagnostics.push(event),
      },
    );

    const polling = runtime.startPolling();
    await firstClaim.promise;
    const stoppedPromptly = await Promise.race([
      runtime.stop().then(() => true),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 250)),
    ]);
    await polling;

    expect(stoppedPromptly).toBe(true);
    expect(claim).toHaveBeenCalledTimes(1);
    expect(runtime.getDiagnostics().state).toBe("stopped");
    expect(diagnostics.map((event) => event.event)).toEqual(["started", "stopping", "stopped"]);
  });

  it("shares one in-flight runOnce call instead of overlapping work", async () => {
    const run = createClaimedRun();
    const executionStarted = deferred();
    const releaseExecution = deferred();
    const claim = vi.fn().mockResolvedValueOnce(run);
    const queue = createQueue(claim);
    const executeClaimed = vi.fn(async () => {
      executionStarted.resolve();
      await releaseExecution.promise;
    });
    const runtime = new DurableRuntimeService(queue, createOrchestrations(executeClaimed), {
      workerId: "worker-lifecycle",
    });

    const first = runtime.runOnce();
    await executionStarted.promise;
    const second = runtime.runOnce();

    expect(second).toBe(first);
    expect(claim).toHaveBeenCalledTimes(1);
    releaseExecution.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([true, true]);
    expect(runtime.getDiagnostics()).toMatchObject({
      state: "idle",
      processedRuns: 1,
      currentRunId: null,
    });
    await runtime.stop();
  });
});
