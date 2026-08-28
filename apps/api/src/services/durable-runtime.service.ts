import { randomUUID } from "node:crypto";
import type {
  Run,
  StartSkillOrchestrationInput,
  StartSkillOrchestrationResponse,
} from "@atellier/shared";
import { ExecutionQueueService } from "./execution-queue.service";
import {
  OrchestrationCancelledError,
  SkillOrchestrationService,
} from "./skill-orchestration.service";

export type DurableRuntimeOptions = {
  inline?: boolean;
  onDiagnostic?: DurableWorkerDiagnosticSink;
  pollMs?: number;
  workerId?: string;
};

export type DurableWorkerState = "idle" | "polling" | "running" | "stopping" | "stopped";

export type DurableWorkerDiagnostics = {
  workerId: string;
  state: DurableWorkerState;
  startedAt: string | null;
  stoppingAt: string | null;
  stoppedAt: string | null;
  currentRunId: string | null;
  processedRuns: number;
  lastError: string | null;
  leaseMs: number;
  pollMs: number;
};

export type DurableWorkerDiagnosticEvent = {
  event: "started" | "run_claimed" | "run_settled" | "error" | "stopping" | "stopped";
  timestamp: string;
  diagnostics: DurableWorkerDiagnostics;
};

export type DurableWorkerDiagnosticSink = (event: DurableWorkerDiagnosticEvent) => void;

export class DurableRuntimeService {
  private readonly inline: boolean;
  private readonly onDiagnostic?: DurableWorkerDiagnosticSink;
  private readonly pollMs: number;
  private readonly workerId: string;
  private activeRunPromise: Promise<boolean> | null = null;
  private activeRunController: AbortController | null = null;
  private drainPromise: Promise<void> | null = null;
  private pollPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private readonly stopController = new AbortController();
  private wakePending = false;
  private stopped = false;
  private state: DurableWorkerState = "idle";
  private startedAt: string | null = null;
  private stoppingAt: string | null = null;
  private stoppedAt: string | null = null;
  private currentRunId: string | null = null;
  private processedRuns = 0;
  private lastError: string | null = null;

  constructor(
    private readonly queue: ExecutionQueueService,
    private readonly skillOrchestrations: SkillOrchestrationService,
    options: DurableRuntimeOptions = {},
  ) {
    this.inline = options.inline ?? false;
    this.onDiagnostic = options.onDiagnostic;
    this.pollMs = Math.max(options.pollMs ?? 1_000, 100);
    this.workerId = options.workerId ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  }

  getDiagnostics(): DurableWorkerDiagnostics {
    return {
      workerId: this.workerId,
      state: this.state,
      startedAt: this.startedAt,
      stoppingAt: this.stoppingAt,
      stoppedAt: this.stoppedAt,
      currentRunId: this.currentRunId,
      processedRuns: this.processedRuns,
      lastError: this.lastError,
      leaseMs: this.queue.leaseMs,
      pollMs: this.pollMs,
    };
  }

  async enqueueSkill(input: StartSkillOrchestrationInput): Promise<StartSkillOrchestrationResponse> {
    const run = await this.skillOrchestrations.enqueue(input);
    await this.queue.recordQueued(run);
    this.wake();
    return { runId: run.id };
  }

  async requestCancel(runId: string): Promise<Run> {
    const run = await this.queue.requestCancel(runId);
    if (this.currentRunId === runId && !this.activeRunController?.signal.aborted) {
      this.activeRunController?.abort(new OrchestrationCancelledError());
    }
    return run;
  }

  async retry(runId: string): Promise<Run> {
    const run = await this.queue.retry(runId);
    this.wake();
    return run;
  }

  wake(): void {
    if (!this.inline || this.stopped) {
      return;
    }
    if (this.drainPromise) {
      this.wakePending = true;
      return;
    }
    this.drainPromise = Promise.resolve()
      .then(() => this.drain())
      .finally(() => {
        this.drainPromise = null;
        if (this.wakePending) {
          this.wakePending = false;
          this.wake();
        }
      });
  }

  runOnce(): Promise<boolean> {
    if (this.activeRunPromise) {
      return this.activeRunPromise;
    }
    const execution = this.executeOnce();
    const tracked = execution.finally(() => {
      if (this.activeRunPromise === tracked) {
        this.activeRunPromise = null;
      }
    });
    this.activeRunPromise = tracked;
    return tracked;
  }

  startPolling(): Promise<void> {
    if (this.pollPromise) {
      return this.pollPromise;
    }
    if (this.stopped) {
      return Promise.reject(new Error(`Durable worker ${this.workerId} cannot restart after shutdown.`));
    }

    this.startedAt = this.startedAt ?? new Date().toISOString();
    this.state = "polling";
    this.emitDiagnostic("started");
    const polling = this.poll();
    const tracked = polling.finally(() => {
      if (this.pollPromise === tracked) {
        this.pollPromise = null;
      }
    });
    this.pollPromise = tracked;
    return tracked;
  }

  stop(): Promise<void> {
    if (!this.stopPromise) {
      this.stopPromise = this.stopInternal();
    }
    return this.stopPromise;
  }

  private async executeOnce(): Promise<boolean> {
    const reconciled = await this.queue.reconcileCompletedFinalizing();
    const run = await this.queue.claim(this.workerId);
    if (!run) {
      return reconciled > 0;
    }

    this.currentRunId = run.id;
    const runController = new AbortController();
    this.activeRunController = runController;
    this.lastError = null;
    this.state = "running";
    this.emitDiagnostic("run_claimed");

    const heartbeat = setInterval(() => {
      void this.queue.heartbeat(run.id, this.workerId).catch(() => {
        // A lost lease is surfaced by the next state transition.
      });
    }, Math.max(Math.floor(this.queue.leaseMs / 3), 500));
    let checkingCancellation = false;
    const cancellationPoll = setInterval(() => {
      if (checkingCancellation || runController.signal.aborted) {
        return;
      }
      checkingCancellation = true;
      void this.queue.isCancellationRequested(run.id)
        .then((cancelled) => {
          if (cancelled && !runController.signal.aborted) {
            runController.abort(new OrchestrationCancelledError());
          }
        })
        .catch(() => {
          // A transient cancellation read failure falls back to step-boundary checks.
        })
        .finally(() => {
          checkingCancellation = false;
        });
    }, Math.min(Math.max(Math.floor(this.queue.leaseMs / 6), 250), 1_000));

    try {
      await this.skillOrchestrations.executeClaimed(run, {
        isCancellationRequested: () => this.queue.isCancellationRequested(run.id),
        signal: runController.signal,
        onStepStarted: async (step) => {
          await this.queue.setPhase(run.id, this.workerId, "running", step.id);
          await this.queue.recordStepStarted(
            run.id,
            this.workerId,
            step.id,
            `Starting ${step.label} with ${step.agentName}.`,
          );
        },
        onStepCompleted: async (step, result) => {
          await this.queue.recordStepCompleted(run.id, this.workerId, step.id, { runId: result.runId });
        },
        onStepReused: async (step, result) => {
          await this.queue.setPhase(run.id, this.workerId, "recovering", step.id);
          await this.queue.recordStepReused(run.id, this.workerId, step.id, { runId: result.runId });
        },
        onFinalizing: async () => {
          await this.queue.setPhase(run.id, this.workerId, "finalizing", null);
        },
      });
      if (runController.signal.aborted || await this.queue.isCancellationRequested(run.id)) {
        throw new OrchestrationCancelledError();
      }
      await this.queue.markCompleted(run.id, this.workerId);
    } catch (error) {
      if (
        error instanceof OrchestrationCancelledError
        || runController.signal.aborted
        || await this.queue.isCancellationRequested(run.id)
      ) {
        await this.queue.markCancelled(run.id, this.workerId);
      } else {
        this.lastError = error instanceof Error ? error.message : "Unknown orchestration execution error.";
        this.emitDiagnostic("error");
        await this.queue.handleFailure(run.id, this.workerId, error);
      }
    } finally {
      clearInterval(heartbeat);
      clearInterval(cancellationPoll);
      if (this.activeRunController === runController) {
        this.activeRunController = null;
      }
      this.processedRuns += 1;
      this.currentRunId = null;
      this.state = this.stopped
        ? "stopping"
        : (this.pollPromise || this.drainPromise ? "polling" : "idle");
      this.emitDiagnostic("run_settled");
    }

    return true;
  }

  private async poll(): Promise<void> {
    while (!this.stopped) {
      let worked = false;
      try {
        worked = await this.runOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown durable worker error.";
        this.lastError = message;
        this.emitDiagnostic("error");
        console.error(`[atellier-worker] ${message}`);
      }
      if (!worked && !this.stopped) {
        await this.delay(this.pollMs);
      }
    }
  }

  private async stopInternal(): Promise<void> {
    if (this.state === "stopped") {
      return;
    }
    this.stopped = true;
    this.stoppingAt = this.stoppingAt ?? new Date().toISOString();
    this.state = "stopping";
    this.emitDiagnostic("stopping");
    this.stopController.abort();

    const pending = [...new Set(
      [this.activeRunPromise, this.drainPromise, this.pollPromise]
        .filter((promise): promise is Promise<boolean> | Promise<void> => promise !== null),
    )];
    const results = await Promise.allSettled(pending);
    const rejection = results.find((result) => result.status === "rejected");
    if (rejection?.status === "rejected") {
      this.lastError = rejection.reason instanceof Error
        ? rejection.reason.message
        : "Unknown worker shutdown error.";
      this.emitDiagnostic("error");
    }

    this.stoppedAt = new Date().toISOString();
    this.state = "stopped";
    this.emitDiagnostic("stopped");
  }

  private async drain(): Promise<void> {
    while (!this.stopped && await this.runOnce()) {
      // Drain all currently available memory-mode executions.
    }
  }

  private async delay(ms: number): Promise<void> {
    if (this.stopController.signal.aborted) {
      return;
    }
    await new Promise<void>((resolve) => {
      const signal = this.stopController.signal;
      const done = (): void => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", done);
        resolve();
      };
      const timeout = setTimeout(done, ms);
      signal.addEventListener("abort", done, { once: true });
    });
  }

  private emitDiagnostic(event: DurableWorkerDiagnosticEvent["event"]): void {
    if (!this.onDiagnostic) {
      return;
    }
    try {
      this.onDiagnostic({
        event,
        timestamp: new Date().toISOString(),
        diagnostics: this.getDiagnostics(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown diagnostic sink error.";
      console.error(`[atellier-worker] Diagnostic sink failed: ${message}`);
    }
  }
}
