import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { AgentService } from "../services/agent.service";
import { ExecutionQueueService } from "../services/execution-queue.service";
import { RunEventService } from "../services/run-event.service";
import { RunService } from "../services/run.service";
import { WikiService } from "../services/wiki.service";

describe("execution queue recovery", () => {
  let atelierRoot: string;
  let agents: AgentService;
  let runs: RunService;
  let queue: ExecutionQueueService;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-queue-recovery-"));
    agents = new AgentService("memory");
    runs = new RunService("memory", new WikiService(atelierRoot));
    const events = new RunEventService("memory", runs);
    queue = new ExecutionQueueService(runs, events, { leaseMs: 1_000 }, agents);
  });

  afterEach(async () => {
    await rm(atelierRoot, { recursive: true, force: true });
  });

  async function createExpiredParent(input: { cancel?: boolean; attempt?: number; maxAttempts?: number } = {}) {
    const now = new Date().toISOString();
    return runs.create({
      type: "orchestration",
      status: "running",
      input: { skillId: "atellier-build-loop", goal: "Test recovery." },
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "running",
        definitionHash: "recovery-test",
        definitionSnapshot: { id: "atellier-build-loop", steps: [] },
        idempotencyKey: `recovery-${Math.random()}`,
        attempt: input.attempt ?? 1,
        maxAttempts: input.maxAttempts ?? 3,
        nextEventSequence: 0,
        availableAt: now,
        leaseOwner: "stopped-worker",
        leaseExpiresAt: "2000-01-01T00:00:00.000Z",
        ...(input.cancel ? { cancelRequestedAt: now } : {}),
      },
    });
  }

  it("settles a cancellation-pending parent, child, and matching agent idempotently", async () => {
    const parent = await createExpiredParent({ cancel: true });
    const agent = await agents.create({ name: "Builder", role: "builder" });
    const child = await runs.create({
      agentId: agent.id,
      type: "manual",
      status: "running",
      input: { orchestrationRunId: parent.id, orchestrationStepId: "build" },
    });
    await agents.updateStatus(agent.id, { status: "executing", lastRunId: child.id });

    await expect(queue.reconcileExpiredExecutions()).resolves.toBe(1);
    await expect(queue.reconcileExpiredExecutions()).resolves.toBe(0);

    expect(await runs.getById(parent.id)).toMatchObject({ status: "cancelled", execution: { phase: "cancelled" } });
    expect(await runs.getById(child.id)).toMatchObject({ status: "cancelled" });
    expect(await agents.getById(agent.id)).toMatchObject({ status: "idle", lastRunId: child.id });
  });

  it("fails an expired parent at max attempts and cannot reclaim it", async () => {
    const parent = await createExpiredParent({ attempt: 3, maxAttempts: 3 });
    const child = await runs.create({
      type: "manual",
      status: "running",
      input: { orchestrationRunId: parent.id, orchestrationStepId: "build" },
    });

    await expect(queue.reconcileExpiredExecutions()).resolves.toBe(1);
    await expect(queue.claim("new-worker")).resolves.toBeNull();
    expect(await runs.getById(parent.id)).toMatchObject({ status: "failed", execution: { phase: "failed" } });
    expect(await runs.getById(child.id)).toMatchObject({ status: "failed" });
  });
});
