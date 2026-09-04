import type { Agent, AgentMessage, Run } from "@atellier/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AgentExecutionCancelledError,
  type AgentExecutorService,
} from "../services/agent-executor.service";
import {
  AgentExecutionTimeoutError,
  AgentRunService,
} from "../services/agent-run.service";
import type { AgentService } from "../services/agent.service";
import type { MessageService } from "../services/message.service";
import type { RunService } from "../services/run.service";

const now = "2026-08-24T00:00:00.000Z";
const agent: Agent = {
  id: "agent-cancel",
  name: "Pia",
  role: "pm",
  status: "idle",
  createdAt: now,
  updatedAt: now,
};
const run: Run = {
  id: "child-run-cancel",
  agentId: agent.id,
  type: "manual",
  status: "running",
  logs: [],
  createdAt: now,
  updatedAt: now,
};
const userMessage: AgentMessage = {
  id: "message-user",
  agentId: agent.id,
  runId: run.id,
  role: "user",
  content: "Run the provider.",
  createdAt: now,
  updatedAt: now,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function createHarness(executor: AgentExecutorService, executionTimeoutMs = 45_000) {
  const agents = {
    getById: vi.fn().mockResolvedValue(agent),
    updateStatus: vi.fn().mockImplementation(async (_id, input) => ({ ...agent, ...input })),
  } as unknown as AgentService;
  const runs = {
    create: vi.fn().mockResolvedValue(run),
    appendLog: vi.fn().mockResolvedValue(run),
    updateStatus: vi.fn().mockResolvedValue(run),
    complete: vi.fn(),
  } as unknown as RunService;
  const messages = {
    create: vi.fn().mockResolvedValue(userMessage),
  } as unknown as MessageService;
  const service = new AgentRunService(
    agents,
    runs,
    messages,
    "openai",
    { openai: executor },
    { executionTimeoutMs },
  );
  return { agents, runs, service };
}

describe("agent run cancellation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("settles a child run as cancelled and ignores a late cooperative executor result", async () => {
    const started = deferred<void>();
    const provider = deferred<{ response: string; needsHuman: boolean }>();
    let providerSignal: AbortSignal | undefined;
    const executor: AgentExecutorService = {
      execute: vi.fn((input) => {
        providerSignal = input.signal;
        started.resolve();
        return provider.promise;
      }),
    };
    const { agents, runs, service } = createHarness(executor);
    const controller = new AbortController();

    const execution = service.run(
      agent.id,
      {
        instruction: "Run the provider.",
        recordDeliverable: false,
        orchestrationStep: {
          orchestrationRunId: "orchestration-cancel",
          stepId: "plan",
          label: "Plan",
          phase: "plan",
        },
      },
      { signal: controller.signal },
    );
    await started.promise;

    controller.abort();

    await expect(execution).rejects.toBeInstanceOf(AgentExecutionCancelledError);
    expect(providerSignal?.aborted).toBe(true);
    expect(runs.updateStatus).toHaveBeenCalledWith(
      run.id,
      "cancelled",
      { error: "Agent execution cancelled." },
    );
    expect(agents.updateStatus).toHaveBeenLastCalledWith(agent.id, {
      status: "idle",
      lastRunId: run.id,
      currentStep: null,
    });
    expect(runs.complete).not.toHaveBeenCalled();

    provider.resolve({ response: "This result arrived too late.", needsHuman: false });
    await Promise.resolve();
    expect(runs.complete).not.toHaveBeenCalled();
  });

  it("aborts the provider on timeout but records a timeout failure, not cancellation", async () => {
    vi.useFakeTimers();
    const started = deferred<void>();
    let providerSignal: AbortSignal | undefined;
    const executor: AgentExecutorService = {
      execute: vi.fn((input) => {
        providerSignal = input.signal;
        started.resolve();
        return new Promise<{ response: string; needsHuman: boolean }>(() => undefined);
      }),
    };
    const { runs, service } = createHarness(executor, 1_000);
    const execution = service.run(agent.id, { instruction: "Run the provider." });
    await started.promise;
    const rejection = expect(execution).rejects.toBeInstanceOf(AgentExecutionTimeoutError);

    await vi.advanceTimersByTimeAsync(1_000);

    await rejection;
    expect(providerSignal?.aborted).toBe(true);
    expect(runs.updateStatus).toHaveBeenCalledWith(
      run.id,
      "failed",
      { error: "Execution timeout after 1000ms." },
    );
  });
});
