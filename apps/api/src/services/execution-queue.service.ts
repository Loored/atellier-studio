import type { Run, RunExecutionPhase } from "@atellier/shared";
import { RunEventService } from "./run-event.service";
import { RunService } from "./run.service";

export type ExecutionQueueOptions = {
  leaseMs?: number;
  retryBaseDelayMs?: number;
};

export class ExecutionQueueService {
  readonly leaseMs: number;
  private readonly retryBaseDelayMs: number;

  constructor(
    private readonly runs: RunService,
    private readonly events: RunEventService,
    options: ExecutionQueueOptions = {},
  ) {
    this.leaseMs = Math.max(options.leaseMs ?? 30_000, 1_000);
    this.retryBaseDelayMs = Math.max(options.retryBaseDelayMs ?? 1_000, 0);
  }

  async recordQueued(run: Run): Promise<void> {
    await this.events.append(run.id, {
      type: "queued",
      phase: "queued",
      message: "Orchestration queued for durable local execution.",
    });
  }

  async claim(workerId: string): Promise<Run | null> {
    let run = await this.runs.claimNextExecution(workerId, this.leaseMs);
    if (!run?.execution) {
      return null;
    }
    if (run.execution.attempt > 1) {
      run = await this.runs.updateExecution(
        run.id,
        { phase: "recovering" },
        workerId,
      ) ?? run;
    }
    const execution = run.execution;
    if (!execution) {
      throw new Error(`Claimed run ${run.id} lost its execution envelope.`);
    }
    await this.events.append(run.id, {
      type: "claimed",
      phase: execution.phase,
      message: `Execution claimed by ${workerId}.`,
      payload: { attempt: execution.attempt },
    }, workerId);
    return run;
  }

  async heartbeat(runId: string, workerId: string): Promise<boolean> {
    return this.runs.heartbeatExecution(runId, workerId, this.leaseMs);
  }

  async isCancellationRequested(runId: string): Promise<boolean> {
    const run = await this.runs.getById(runId);
    return run?.status === "cancelled" || Boolean(run?.execution?.cancelRequestedAt);
  }

  async setPhase(
    runId: string,
    workerId: string,
    phase: RunExecutionPhase,
    currentStepId?: string | null,
  ): Promise<Run> {
    const run = await this.runs.updateExecution(
      runId,
      { phase, currentStepId },
      workerId,
    );
    if (!run) {
      throw new Error(`Execution lease lost for run ${runId}.`);
    }
    await this.events.append(runId, {
      type: "phase_changed",
      phase,
      stepId: currentStepId ?? undefined,
      message: currentStepId ? `Execution entered step ${currentStepId}.` : `Execution phase changed to ${phase}.`,
    }, workerId);
    return run;
  }

  async recordStepStarted(runId: string, workerId: string, stepId: string, message: string): Promise<void> {
    await this.events.append(runId, {
      type: "step_started",
      phase: "running",
      stepId,
      message,
    }, workerId);
  }

  async recordStepCompleted(runId: string, workerId: string, stepId: string, payload?: unknown): Promise<void> {
    await this.events.append(runId, {
      type: "step_completed",
      phase: "running",
      stepId,
      message: `Step ${stepId} completed.`,
      payload,
    }, workerId);
  }

  async recordStepReused(runId: string, workerId: string, stepId: string, payload?: unknown): Promise<void> {
    await this.events.append(runId, {
      type: "step_reused",
      phase: "recovering",
      stepId,
      message: `Reused the completed result for step ${stepId}.`,
      payload,
    }, workerId);
  }

  async markCompleted(runId: string, workerId: string): Promise<Run> {
    const finishedAt = new Date().toISOString();
    const run = await this.runs.updateExecution(
      runId,
      {
        status: "completed",
        phase: "completed",
        finishedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        currentStepId: null,
        lastError: null,
      },
      workerId,
    );
    if (!run) {
      throw new Error(`Execution lease lost before run ${runId} could be finalized.`);
    }
    await this.events.append(runId, {
      type: "completed",
      phase: "completed",
      message: "Orchestration execution completed.",
    });
    return run;
  }

  async requestCancel(runId: string): Promise<Run> {
    const current = await this.requireExecutionRun(runId);
    if (current.status === "queued") {
      const finishedAt = new Date().toISOString();
      const run = await this.runs.updateExecution(runId, {
        status: "cancelled",
        phase: "cancelled",
        cancelRequestedAt: finishedAt,
        finishedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        currentStepId: null,
      });
      if (!run) throw new Error(`Run ${runId} disappeared during cancellation.`);
      await this.events.append(runId, {
        type: "cancelled",
        phase: "cancelled",
        message: "Queued orchestration cancelled before execution.",
      });
      return run;
    }

    if (current.status === "running") {
      if (current.execution?.cancelRequestedAt) {
        return current;
      }
      const cancelRequestedAt = new Date().toISOString();
      const run = await this.runs.updateExecution(runId, { cancelRequestedAt });
      if (!run) throw new Error(`Run ${runId} disappeared during cancellation.`);
      await this.events.append(runId, {
        type: "cancel_requested",
        phase: run.execution?.phase,
        stepId: run.execution?.currentStepId,
        message: "Cancellation requested; the worker will stop at the next safe step boundary.",
      });
      return run;
    }

    throw new Error(`Run ${runId} cannot be cancelled from status ${current.status}.`);
  }

  async retry(runId: string): Promise<Run> {
    const current = await this.requireExecutionRun(runId);
    if (current.status !== "failed" && current.status !== "blocked") {
      throw new Error(`Run ${runId} cannot be retried from status ${current.status}.`);
    }
    const run = await this.runs.updateExecution(runId, {
      status: "queued",
      phase: "queued",
      attempt: 0,
      availableAt: new Date().toISOString(),
      leaseOwner: null,
      leaseExpiresAt: null,
      heartbeatAt: null,
      cancelRequestedAt: null,
      finishedAt: null,
      lastError: null,
      currentStepId: null,
    });
    if (!run) throw new Error(`Run ${runId} disappeared during retry.`);
    await this.events.append(runId, {
      type: "queued",
      phase: "queued",
      message: "Manual retry queued; completed step results will be reused.",
    });
    return run;
  }

  async markCancelled(runId: string, workerId: string): Promise<Run> {
    const finishedAt = new Date().toISOString();
    const run = await this.runs.updateExecution(
      runId,
      {
        status: "cancelled",
        phase: "cancelled",
        finishedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        currentStepId: null,
      },
      workerId,
    );
    if (!run) throw new Error(`Execution lease lost while cancelling run ${runId}.`);
    await this.events.append(runId, {
      type: "cancelled",
      phase: "cancelled",
      message: "Orchestration cancelled at a safe step boundary.",
    });
    return run;
  }

  async handleFailure(runId: string, workerId: string, error: unknown): Promise<Run> {
    const message = error instanceof Error ? error.message : "Unknown orchestration execution error.";
    const current = await this.requireExecutionRun(runId);
    const attempt = current.execution?.attempt ?? 1;
    const maxAttempts = current.execution?.maxAttempts ?? 1;

    if (attempt < maxAttempts) {
      const delayMs = Math.min(this.retryBaseDelayMs * 2 ** Math.max(attempt - 1, 0), 30_000);
      const availableAt = new Date(Date.now() + delayMs).toISOString();
      const run = await this.runs.updateExecution(
        runId,
        {
          status: "queued",
          phase: "queued",
          availableAt,
          leaseOwner: null,
          leaseExpiresAt: null,
          heartbeatAt: null,
          lastError: message,
        },
        workerId,
      );
      if (!run) throw new Error(`Execution lease lost while retrying run ${runId}.`);
      await this.events.append(runId, {
        type: "retry_scheduled",
        phase: "queued",
        stepId: current.execution?.currentStepId,
        message,
        payload: { attempt, maxAttempts, availableAt },
      });
      return run;
    }

    const finishedAt = new Date().toISOString();
    const run = await this.runs.updateExecution(
      runId,
      {
        status: "failed",
        phase: "failed",
        finishedAt,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        lastError: message,
      },
      workerId,
    );
    if (!run) throw new Error(`Execution lease lost while failing run ${runId}.`);
    await this.events.append(runId, {
      type: "failed",
      phase: "failed",
      stepId: current.execution?.currentStepId,
      message,
      payload: { attempt, maxAttempts },
    });
    return run;
  }

  private async requireExecutionRun(runId: string): Promise<Run> {
    const run = await this.runs.getById(runId);
    if (!run?.execution || run.execution.kind !== "skill-orchestration") {
      throw new Error(`Durable orchestration run ${runId} was not found.`);
    }
    return run;
  }
}
