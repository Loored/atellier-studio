import type { Agent, AgentMessage, ExecutionBudgetReceipt, Run } from "@atellier/shared";
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
    updateStatus: vi.fn().mockImplementation(async (_id, status) => ({ ...run, status })),
    recordEvaluation: vi.fn().mockResolvedValue(run),
    complete: vi.fn().mockResolvedValue({ ...run, status: "completed" }),
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

  it("persists the exact provider-confirmed model in output and terminal evaluation", async () => {
    const executor: AgentExecutorService = {
      execute: vi.fn().mockResolvedValue({
        response: "## Scope\nOne.\n## Approach\nTwo.\n## Acceptance Criteria\n- Works.\n## Handoff\nDone.",
        needsHuman: true,
        resolvedModel: "qwen3.5:9b",
      }),
    };
    const { runs, service } = createHarness(executor);

    await service.run(agent.id, { instruction: "Run the provider." });

    expect(runs.complete).toHaveBeenCalledWith(run.id, expect.objectContaining({
      output: expect.objectContaining({ resolvedModel: "qwen3.5:9b" }),
    }));
    expect(runs.recordEvaluation).toHaveBeenCalledWith(run.id, expect.objectContaining({
      resolvedModel: "qwen3.5:9b",
    }));
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
    expect(runs.recordEvaluation).toHaveBeenCalledWith(run.id, expect.objectContaining({
      terminalStatus: "cancelled",
      outcome: "cancelled",
      error: { kind: "cancelled", message: "Agent execution cancelled." },
    }));
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
    expect(runs.recordEvaluation).toHaveBeenCalledWith(run.id, expect.objectContaining({
      terminalStatus: "failed",
      outcome: "failed",
      error: { kind: "timeout", message: "Execution timeout after 1000ms." },
    }));
  });

  it("applies the bound model and context budget and records its configuration fingerprint", async () => {
    const started = deferred<void>();
    const executor: AgentExecutorService = {
      execute: vi.fn((input) => {
        started.resolve();
        return new Promise<{ response: string; needsHuman: boolean }>(() => undefined);
      }),
    };
    const { runs, service } = createHarness(executor);
    const controller = new AbortController();
    const budget = {
      id: "budget-test",
      canaryId: "canary-test",
      canaryFingerprint: "c".repeat(64),
      proposalFingerprint: "p".repeat(64),
      bundleId: "bundle-test",
      bundleFingerprint: "f".repeat(64),
      runId: "orchestration-test",
      selectionBucket: 0,
      assignmentFingerprint: "a".repeat(64),
      limits: { executionTimeoutMs: 5_000, maxRetries: 0, contextBytes: 4 },
      modelProfiles: { cheap: "cheap-model", standard: "standard-model", deep: "deep-model" },
      allowedTools: [],
      status: "reserved",
      createdAt: now,
      path: "wiki/decisions/budget-test.md",
    } satisfies ExecutionBudgetReceipt;

    const execution = service.run(agent.id, {
      instruction: "Run the provider.",
      context: "123456789",
      modelProfileOverride: "standard",
    }, { signal: controller.signal, executionBudget: budget });
    await started.promise;

    expect(executor.execute).toHaveBeenCalledWith(expect.objectContaining({
      context: "1234",
      modelOverride: "standard-model",
    }));
    expect(runs.create).toHaveBeenCalledWith(expect.objectContaining({
      input: expect.objectContaining({ controlBudgetReceiptId: "budget-test", context: "1234" }),
    }));
    controller.abort();
    await expect(execution).rejects.toBeInstanceOf(AgentExecutionCancelledError);
    expect(runs.recordEvaluation).toHaveBeenCalledWith(run.id, expect.objectContaining({
      configurationFingerprint: "f".repeat(64),
    }));
  });
});
