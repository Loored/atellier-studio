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
  pollMs?: number;
  workerId?: string;
};

export class DurableRuntimeService {
  private readonly inline: boolean;
  private readonly pollMs: number;
  private readonly workerId: string;
  private drainPromise: Promise<void> | null = null;
  private wakePending = false;
  private stopped = false;

  constructor(
    private readonly queue: ExecutionQueueService,
    private readonly skillOrchestrations: SkillOrchestrationService,
    options: DurableRuntimeOptions = {},
  ) {
    this.inline = options.inline ?? false;
    this.pollMs = Math.max(options.pollMs ?? 1_000, 100);
    this.workerId = options.workerId ?? `worker-${process.pid}-${randomUUID().slice(0, 8)}`;
  }

  async enqueueSkill(input: StartSkillOrchestrationInput): Promise<StartSkillOrchestrationResponse> {
    const run = await this.skillOrchestrations.enqueue(input);
    await this.queue.recordQueued(run);
    this.wake();
    return { runId: run.id };
  }

  async requestCancel(runId: string): Promise<Run> {
    return this.queue.requestCancel(runId);
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

  async runOnce(): Promise<boolean> {
    const run = await this.queue.claim(this.workerId);
    if (!run) {
      return false;
    }

    const heartbeat = setInterval(() => {
      void this.queue.heartbeat(run.id, this.workerId).catch(() => {
        // A lost lease is surfaced by the next state transition.
      });
    }, Math.max(Math.floor(this.queue.leaseMs / 3), 500));

    try {
      await this.skillOrchestrations.executeClaimed(run, {
        isCancellationRequested: () => this.queue.isCancellationRequested(run.id),
        onStepStarted: async (step) => {
          await this.queue.setPhase(run.id, this.workerId, "running", step.id);
          await this.queue.recordStepStarted(run.id, step.id, `Starting ${step.label} with ${step.agentName}.`);
        },
        onStepCompleted: async (step, result) => {
          await this.queue.recordStepCompleted(run.id, step.id, { runId: result.runId });
        },
        onStepReused: async (step, result) => {
          await this.queue.setPhase(run.id, this.workerId, "recovering", step.id);
          await this.queue.recordStepReused(run.id, step.id, { runId: result.runId });
        },
        onFinalizing: async () => {
          await this.queue.setPhase(run.id, this.workerId, "finalizing", null);
        },
      });
      await this.queue.markCompleted(run.id, this.workerId);
    } catch (error) {
      if (error instanceof OrchestrationCancelledError || await this.queue.isCancellationRequested(run.id)) {
        await this.queue.markCancelled(run.id, this.workerId);
      } else {
        await this.queue.handleFailure(run.id, this.workerId, error);
      }
    } finally {
      clearInterval(heartbeat);
    }

    return true;
  }

  async startPolling(): Promise<void> {
    this.stopped = false;
    while (!this.stopped) {
      let worked = false;
      try {
        worked = await this.runOnce();
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown durable worker error.";
        console.error(`[atellier-worker] ${message}`);
      }
      if (!worked && !this.stopped) {
        await this.delay(this.pollMs);
      }
    }
  }

  async stop(): Promise<void> {
    this.stopped = true;
    await this.drainPromise;
  }

  private async drain(): Promise<void> {
    while (!this.stopped && await this.runOnce()) {
      // Drain all currently available memory-mode executions.
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }
}
