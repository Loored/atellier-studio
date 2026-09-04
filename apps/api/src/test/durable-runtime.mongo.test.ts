import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentMemoryContextReceipt } from "@atellier/shared";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { connectMongo, disconnectMongo } from "../db/mongo";
import { RunModel } from "../db/models/Run";
import { RunEventModel } from "../db/models/RunEvent";
import { ExecutionQueueService } from "../services/execution-queue.service";
import { RunEventService } from "../services/run-event.service";
import { RunService } from "../services/run.service";
import { WikiService } from "../services/wiki.service";

const configuredMongoUri = process.env.ATELLIER_TEST_MONGO_URI
  ?? (process.env.ATELLIER_TEST_MONGO === "1"
    ? "mongodb://127.0.0.1:27017/atellier_runtime_integration"
    : null);
const describeMongo = configuredMongoUri ? describe : describe.skip;

type QueueHarness = {
  events: RunEventService;
  queue: ExecutionQueueService;
  runs: RunService;
};

function buildContextReceipt(stableHash = "mongo-context-hash"): AgentMemoryContextReceipt {
  return {
    schemaVersion: 1,
    query: "Use durable trusted context",
    policy: "trusted-only",
    budgets: {
      totalBytes: 8_000,
      perItemBytes: 2_000,
      maxRetrievalItems: 3,
    },
    createdAt: "2026-08-30T12:00:00.000Z",
    items: [],
    excluded: [],
    stableHash,
  };
}

function isolatedMongoUri(baseUri: string): string {
  const uri = new URL(baseUri);
  uri.pathname = `/atellier_runtime_integration_${randomUUID().replaceAll("-", "")}`;
  return uri.toString();
}

describeMongo("durable runtime Mongo concurrency", () => {
  let atelierRoot: string;
  let connected = false;
  let mongoUri: string;
  let wiki: WikiService;

  beforeAll(async () => {
    mongoUri = isolatedMongoUri(configuredMongoUri!);
    await connectMongo(mongoUri);
    connected = true;
    await Promise.all([RunModel.syncIndexes(), RunEventModel.syncIndexes()]);
  });

  beforeEach(async () => {
    await Promise.all([RunModel.deleteMany({}), RunEventModel.deleteMany({})]);
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-runtime-mongo-test-"));
    wiki = new WikiService(atelierRoot);
  });

  afterEach(async () => {
    await rm(atelierRoot, { recursive: true, force: true });
  });

  afterAll(async () => {
    if (!connected) return;
    await RunModel.db.dropDatabase();
    await disconnectMongo();
  });

  function createHarness(): QueueHarness {
    const runs = new RunService("mongo", wiki);
    const events = new RunEventService("mongo", runs);
    return {
      runs,
      events,
      queue: new ExecutionQueueService(runs, events, { leaseMs: 1_000 }),
    };
  }

  async function createQueuedRun(harness: QueueHarness) {
    const now = new Date().toISOString();
    const run = await harness.runs.create({
      type: "orchestration",
      status: "queued",
      input: { skillId: "wiki-dream-loop", goal: "Exercise Mongo worker concurrency." },
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "queued",
        definitionHash: "mongo-concurrency-test",
        definitionSnapshot: { id: "wiki-dream-loop", steps: [] },
        idempotencyKey: randomUUID(),
        attempt: 0,
        maxAttempts: 3,
        nextEventSequence: 0,
        availableAt: now,
      },
    });
    await harness.queue.recordQueued(run);
    return run;
  }

  it("allows exactly one worker to claim a queued run", async () => {
    const workerA = createHarness();
    const workerB = createHarness();
    const queued = await createQueuedRun(workerA);

    const claims = await Promise.all([
      workerA.queue.claim("worker-a"),
      workerB.queue.claim("worker-b"),
    ]);
    const successfulClaims = claims.filter((claim) => claim !== null);

    expect(successfulClaims).toHaveLength(1);
    expect(successfulClaims[0]?.id).toBe(queued.id);
    expect(claims.filter((claim) => claim === null)).toHaveLength(1);

    const stored = await workerA.runs.getById(queued.id);
    expect(stored).toMatchObject({
      status: "running",
      execution: {
        attempt: 1,
        leaseOwner: successfulClaims[0]?.execution?.leaseOwner,
      },
    });
    const eventResponse = await workerA.events.list(queued.id);
    expect(eventResponse.events.map((event) => event.type)).toEqual(["queued", "claimed"]);
    expect(eventResponse.events.map((event) => event.sequence)).toEqual([1, 2]);
  });

  it("reclaims an expired lease once and rejects stale-worker events", async () => {
    const workerA = createHarness();
    const workerB = createHarness();
    const workerC = createHarness();
    const queued = await createQueuedRun(workerA);
    expect(await workerA.queue.claim("worker-a")).not.toBeNull();
    expect(await workerA.runs.updateExecution(
      queued.id,
      { leaseExpiresAt: "2000-01-01T00:00:00.000Z" },
      "worker-a",
    )).not.toBeNull();
    expect(await workerA.queue.heartbeat(queued.id, "worker-a")).toBe(false);
    expect(await workerA.runs.updateExecution(
      queued.id,
      { phase: "finalizing" },
      "worker-a",
    )).toBeNull();
    await expect(
      workerA.queue.recordStepCompleted(queued.id, "worker-a", "audit"),
    ).rejects.toThrow("Execution lease lost while appending step_completed event");

    const [claimB, claimC] = await Promise.all([
      workerB.queue.claim("worker-b"),
      workerC.queue.claim("worker-c"),
    ]);
    const reclaimed = [claimB, claimC].filter((claim) => claim !== null);

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]).toMatchObject({
      id: queued.id,
      status: "running",
      execution: {
        attempt: 2,
        phase: "recovering",
      },
    });
    expect(await workerA.queue.heartbeat(queued.id, "worker-a")).toBe(false);
    expect(await workerA.runs.updateStatus(
      queued.id,
      "completed",
      { staleWorker: true },
      "worker-a",
    )).toBeNull();
    expect(await workerA.runs.complete(
      queued.id,
      { summary: "Stale worker completion" },
      "worker-a",
    )).toBeNull();
    await expect(
      workerA.queue.recordStepCompleted(queued.id, "worker-a", "audit"),
    ).rejects.toThrow("Execution lease lost while appending step_completed event");

    const activeWorker = claimB ? workerB : workerC;
    const activeWorkerId = reclaimed[0]!.execution!.leaseOwner!;
    await activeWorker.queue.recordStepStarted(
      queued.id,
      activeWorkerId,
      "audit",
      "Starting the reclaimed audit step.",
    );

    const eventResponse = await workerA.events.list(queued.id);
    expect(eventResponse.events.map((event) => event.type)).toEqual([
      "queued",
      "claimed",
      "claimed",
      "step_started",
    ]);
    expect(eventResponse.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect((await workerA.runs.getById(queued.id))?.execution?.nextEventSequence).toBe(4);
  });

  it("allocates ordered unique event sequences under concurrent appends", async () => {
    const worker = createHarness();
    const queued = await createQueuedRun(worker);
    expect(await worker.queue.claim("worker-a")).not.toBeNull();

    await Promise.all(
      Array.from({ length: 24 }, (_, index) => worker.queue.recordStepStarted(
        queued.id,
        "worker-a",
        `step-${index}`,
        `Concurrent event ${index}.`,
      )),
    );

    const eventResponse = await worker.events.list(queued.id);
    const sequences = eventResponse.events.map((event) => event.sequence);
    expect(sequences).toEqual(Array.from({ length: 26 }, (_, index) => index + 1));
    expect(new Set(sequences).size).toBe(sequences.length);
    expect((await worker.runs.getById(queued.id))?.execution?.nextEventSequence).toBe(26);

    await expect(RunEventModel.create({
      runId: queued.id,
      sequence: 3,
      type: "log",
      message: "Intentional duplicate sequence.",
    })).rejects.toHaveProperty("code", 11000);
  });

  it("atomically persists one context receipt under an active worker lease", async () => {
    const workerA = createHarness();
    const workerB = createHarness();
    const queued = await createQueuedRun(workerA);
    const claimed = await workerA.queue.claim("worker-a");
    expect(claimed).not.toBeNull();
    const receipt = buildContextReceipt();

    const writes = await Promise.all([
      workerA.runs.ensureContextReceipt(queued.id, receipt, "worker-a"),
      workerB.runs.ensureContextReceipt(queued.id, receipt, "worker-a"),
    ]);
    expect(writes).toEqual([receipt, receipt]);
    expect((await workerA.runs.getById(queued.id))?.contextReceipt).toEqual(receipt);

    await expect(workerB.runs.ensureContextReceipt(
      queued.id,
      buildContextReceipt("different-context-hash"),
      "worker-a",
    )).rejects.toThrow("Run already has a different agent memory context receipt.");
    await expect(workerB.runs.ensureContextReceipt(queued.id, receipt, "worker-b"))
      .resolves.toBeNull();
  });

  it("atomically persists one immutable context evaluation", async () => {
    const workerA = createHarness();
    const workerB = createHarness();
    const completed = await workerA.runs.create({ type: "orchestration", status: "completed" });
    await workerA.runs.ensureContextReceipt(completed.id, buildContextReceipt());
    const input = { outcome: "useful" as const, items: [] };

    const evaluations = await Promise.all([
      workerA.runs.recordContextReceiptEvaluation(completed.id, input),
      workerB.runs.recordContextReceiptEvaluation(completed.id, input),
    ]);
    expect(evaluations.map((run) => run?.contextEvaluation?.outcome)).toEqual(["useful", "useful"]);
    await expect(workerA.runs.recordContextReceiptEvaluation(completed.id, {
      outcome: "not-useful",
      items: [],
    })).rejects.toThrow("Context receipt evaluation is already recorded with different labels.");
  });
});
