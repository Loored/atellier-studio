import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { AgentMemoryContextReceipt } from "@atellier/shared";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { RunService } from "../services/run.service";
import { WikiService } from "../services/wiki.service";

function buildReceipt(stableHash = "context-hash-a"): AgentMemoryContextReceipt {
  return {
    schemaVersion: 1,
    query: "Implement the scoped API change",
    policy: "evidence-first",
    budgets: {
      totalBytes: 8_000,
      perItemBytes: 2_000,
      maxRetrievalItems: 3,
    },
    createdAt: "2026-08-30T12:00:00.000Z",
    items: [{
      source: "direct",
      path: "raw/brief.md",
      memory: {
        layer: "raw",
        state: "immutable-source",
        authority: "evidence-only",
        provenancePaths: ["raw/brief.md"],
        reason: "Immutable source evidence.",
      },
      contentSha256: "brief-hash",
      originalBytes: 12,
      includedBytes: 12,
      truncated: false,
      excerpt: "Brief source",
    }],
    excluded: [],
    stableHash,
  };
}

describe("run context receipt persistence", () => {
  let atelierRoot: string;
  let runs: RunService;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-context-receipt-test-"));
    runs = new RunService("memory", new WikiService(atelierRoot));
  });

  afterEach(async () => {
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("stores a receipt once and returns the exact durable receipt on retry", async () => {
    const run = await runs.create({ type: "build", status: "running" });
    const receipt = buildReceipt();

    const first = await runs.ensureContextReceipt(run.id, receipt);
    expect(first).toEqual(receipt);

    receipt.query = "Caller mutation after persistence";
    const retry = await runs.ensureContextReceipt(run.id, buildReceipt());
    expect(retry).toEqual(buildReceipt());
    expect((await runs.getById(run.id))?.contextReceipt).toEqual(buildReceipt());
  });

  it("rejects a different receipt after the first write", async () => {
    const run = await runs.create({ type: "build", status: "running" });
    await runs.ensureContextReceipt(run.id, buildReceipt());

    await expect(runs.ensureContextReceipt(run.id, buildReceipt("context-hash-b")))
      .rejects.toThrow("Run already has a different agent memory context receipt.");
    await expect(runs.ensureContextReceipt(run.id, {
      ...buildReceipt(),
      query: "Different content with a reused hash",
    })).rejects.toThrow("Run already has a different agent memory context receipt.");
  });

  it("requires the supplied worker to own an active lease", async () => {
    const now = new Date().toISOString();
    const run = await runs.create({
      type: "orchestration",
      status: "running",
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "running",
        definitionHash: "context-receipt-test",
        definitionSnapshot: { id: "context-receipt-test", steps: [] },
        idempotencyKey: "context-receipt-test",
        attempt: 1,
        maxAttempts: 3,
        nextEventSequence: 0,
        availableAt: now,
        leaseOwner: "worker-a",
        leaseExpiresAt: new Date(Date.now() + 30_000).toISOString(),
      },
    });

    await expect(runs.ensureContextReceipt(run.id, buildReceipt(), "worker-b"))
      .resolves.toBeNull();
    await expect(runs.ensureContextReceipt(run.id, buildReceipt(), "worker-a"))
      .resolves.toEqual(buildReceipt());

    await runs.updateExecution(run.id, { leaseExpiresAt: "2000-01-01T00:00:00.000Z" });
    await expect(runs.ensureContextReceipt(run.id, buildReceipt(), "worker-a"))
      .resolves.toBeNull();
  });

  it("records one complete, durable evaluation only after an orchestration is terminal", async () => {
    const run = await runs.create({ type: "orchestration", status: "completed" });
    await runs.ensureContextReceipt(run.id, buildReceipt());
    const input = {
      outcome: "useful" as const,
      items: [{ path: "raw/brief.md", relevance: "relevant" as const }],
      note: "Direct brief determined the implementation scope.",
    };

    const first = await runs.recordContextReceiptEvaluation(run.id, input);
    expect(first?.contextEvaluation).toMatchObject({
      receiptHash: "context-hash-a",
      outcome: "useful",
      items: [{ path: "raw/brief.md", relevance: "relevant" }],
    });
    const artifact = await new WikiService(atelierRoot).readPage(`runs/context/${run.id}-memory-evaluation.md`);
    expect(artifact.content).toContain("Direct brief determined the implementation scope.");

    await expect(runs.recordContextReceiptEvaluation(run.id, input)).resolves.toMatchObject({
      contextEvaluation: { outcome: "useful" },
    });
    await expect(runs.recordContextReceiptEvaluation(run.id, {
      ...input,
      outcome: "not-useful",
    })).rejects.toThrow("Context receipt evaluation is already recorded with different labels.");
  });

  it("rejects incomplete labels and evaluations outside the terminal receipt boundary", async () => {
    const terminal = await runs.create({ type: "orchestration", status: "completed" });
    await runs.ensureContextReceipt(terminal.id, buildReceipt());
    await expect(runs.recordContextReceiptEvaluation(terminal.id, {
      outcome: "mixed",
      items: [],
    })).rejects.toThrow("label every included item exactly once");

    const active = await runs.create({ type: "orchestration", status: "running" });
    await runs.ensureContextReceipt(active.id, buildReceipt());
    await expect(runs.recordContextReceiptEvaluation(active.id, {
      outcome: "mixed",
      items: [{ path: "raw/brief.md", relevance: "uncertain" }],
    })).rejects.toThrow("Only terminal orchestration runs");
  });

  it("summarizes evaluated receipts by authority, role, and source without changing them", async () => {
    const first = await runs.create({ type: "orchestration", status: "completed" });
    await runs.ensureContextReceipt(first.id, buildReceipt("summary-a"));
    await runs.recordContextReceiptEvaluation(first.id, {
      outcome: "useful",
      items: [{ path: "raw/brief.md", relevance: "relevant" }],
    });

    const second = await runs.create({ type: "orchestration", status: "completed" });
    await runs.ensureContextReceipt(second.id, {
      ...buildReceipt("summary-b"),
      items: [{
        ...buildReceipt("summary-b").items[0],
        source: "retrieval",
        path: "wiki/role-memory/pm.md",
        applicableRole: "pm",
        memory: {
          layer: "learning",
          state: "verified",
          authority: "trusted",
          provenancePaths: ["wiki/role-memory/pm.md"],
          reason: "Curated role learning.",
        },
      }],
    });
    await runs.recordContextReceiptEvaluation(second.id, {
      outcome: "mixed",
      items: [{ path: "wiki/role-memory/pm.md", applicableRole: "pm", relevance: "uncertain" }],
    });

    const summary = await runs.summarizeContextReceiptEvaluations();
    expect(summary).toMatchObject({
      evaluatedReceipts: 2,
      outcomes: { useful: 1, mixed: 1, "not-useful": 0 },
      byAuthority: [
        { key: "evidence-only", relevance: { relevant: 1, uncertain: 0, irrelevant: 0 } },
        { key: "trusted", relevance: { relevant: 0, uncertain: 1, irrelevant: 0 } },
      ],
    });
    expect(summary.byRole).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "shared", relevance: { relevant: 1, uncertain: 0, irrelevant: 0 } }),
      expect.objectContaining({ key: "pm", relevance: { relevant: 0, uncertain: 1, irrelevant: 0 } }),
    ]));
  });

  it("automatically records a provisional terminal-output assessment without replacing operator labels", async () => {
    const created = await runs.create({ type: "orchestration", status: "running" });
    const run = await runs.complete(created.id, {
      output: { artifact: { content: "### Sources Used\n- raw/brief.md" } },
    });
    expect(run).not.toBeNull();
    await runs.ensureContextReceipt(run!.id, buildReceipt("auto-a"));

    const assessed = await runs.assessContextReceiptAutomatically(run!.id);
    expect(assessed?.automatedContextAssessment).toMatchObject({
      receiptHash: "auto-a",
      method: "terminal-output-path-reference",
      outcome: "supported",
      items: [{ path: "raw/brief.md", referenced: true }],
    });
    expect(assessed?.contextEvaluation).toBeUndefined();
    const artifact = await new WikiService(atelierRoot).readPage(`runs/context/${run!.id}-memory-auto-assessment.md`);
    expect(artifact.content).toContain("provisional");

    await expect(runs.assessContextReceiptAutomatically(run!.id)).resolves.toMatchObject({
      automatedContextAssessment: { outcome: "supported" },
    });
    expect(await runs.summarizeAutomatedContextReceiptAssessments()).toEqual({
      assessedReceipts: 1,
      outcomes: { supported: 1, partial: 0, unverified: 0 },
    });
  });

  it("marks output with no explicit source reference as unverified", async () => {
    const created = await runs.create({ type: "orchestration", status: "running" });
    const run = await runs.complete(created.id, { output: { summary: "Done." } });
    expect(run).not.toBeNull();
    await runs.ensureContextReceipt(run!.id, buildReceipt("auto-b"));

    await expect(runs.assessContextReceiptAutomatically(run!.id)).resolves.toMatchObject({
      automatedContextAssessment: { outcome: "unverified" },
    });
  });

  it("does not downgrade a cited shared source for role-scoped memory unavailable to the artifact producer", async () => {
    const created = await runs.create({ type: "orchestration", status: "running" });
    const run = await runs.complete(created.id, {
      output: { artifact: { content: "### Sources Used\n- raw/brief.md" } },
    });
    expect(run).not.toBeNull();
    await runs.ensureContextReceipt(run!.id, {
      ...buildReceipt("auto-role-scoped"),
      items: [
        ...buildReceipt("auto-role-scoped").items,
        {
          source: "retrieval",
          path: "wiki/role-memory/wiki-curator.md",
          applicableRole: "wiki-curator",
          memory: {
            layer: "learning",
            state: "verified",
            authority: "trusted",
            provenancePaths: ["wiki/role-memory/wiki-curator.md"],
            reason: "Curated role learning.",
          },
          contentSha256: "wiki-curator-hash",
          originalBytes: 16,
          includedBytes: 16,
          truncated: false,
          excerpt: "Curator-only memory",
        },
      ],
    });

    await expect(runs.assessContextReceiptAutomatically(run!.id)).resolves.toMatchObject({
      automatedContextAssessment: {
        outcome: "supported",
        items: [
          { path: "raw/brief.md", referenced: true },
          { path: "wiki/role-memory/wiki-curator.md", applicableRole: "wiki-curator", referenced: false },
        ],
      },
    });
  });

  it("backfills only terminal receipts that do not already have an automatic assessment", async () => {
    const created = await runs.create({ type: "orchestration", status: "running" });
    const completed = await runs.complete(created.id, { output: { source: "raw/brief.md" } });
    await runs.ensureContextReceipt(completed!.id, buildReceipt("auto-c"));
    const active = await runs.create({ type: "orchestration", status: "running" });
    await runs.ensureContextReceipt(active.id, buildReceipt("auto-d"));

    await expect(runs.assessUnassessedContextReceipts()).resolves.toEqual({ assessedRunIds: [completed!.id] });
    await expect(runs.assessUnassessedContextReceipts()).resolves.toEqual({ assessedRunIds: [] });
  });
});
