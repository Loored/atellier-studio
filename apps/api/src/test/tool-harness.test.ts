import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { ToolDefinition } from "@atellier/shared";
import { buildServer } from "../server";
import { parseAgentToolRequest, ToolHarnessService } from "../services/tool-harness.service";
import { createAppServices } from "../services/app-services";
import type { AgentExecutorService } from "../services/agent-executor.service";
import type { RunService } from "../services/run.service";
import type { WikiService } from "../services/wiki.service";

const guardedDefinition: ToolDefinition = {
  name: "workspace.patch",
  label: "Patch workspace",
  description: "Applies a bounded patch.",
  classification: "reversible",
  autonomy: "approval-required",
  executionState: "available",
  allowedRoles: ["builder"],
  inputSummary: "A verified patch.",
  evidenceSummary: "The patch and verification output are recorded.",
};

describe("ToolHarnessService", () => {
  const now = new Date("2026-09-08T12:00:00.000Z");
  const service = new ToolHarnessService(
    {} as WikiService,
    {} as RunService,
    [guardedDefinition],
    () => now,
  );

  it("fails closed for unknown tools and unauthorized roles", () => {
    expect(service.evaluatePolicy({ toolName: "shell.exec", agentRole: "builder" })).toMatchObject({
      action: "deny",
      reasonCode: "tool-unregistered",
      evidenceRequired: true,
    });
    expect(service.evaluatePolicy({ toolName: "workspace.patch", agentRole: "qa" })).toMatchObject({
      action: "deny",
      reasonCode: "role-not-authorized",
    });
  });

  it("requires a current human approval before a guarded capability is allowed", () => {
    expect(service.evaluatePolicy({ toolName: "workspace.patch", agentRole: "builder" })).toMatchObject({
      action: "require-approval",
      reasonCode: "approval-required",
    });
    expect(service.evaluatePolicy({
      toolName: "workspace.patch",
      agentRole: "builder",
      approval: {
        toolName: "workspace.patch",
        grantedBy: "human",
        grantedAt: "2026-09-08T11:00:00.000Z",
        expiresAt: "2026-09-08T13:00:00.000Z",
      },
    })).toMatchObject({
      action: "allow",
      reasonCode: "approval-granted",
    });
  });

  it("parses only a whole-response tool request", () => {
    expect(parseAgentToolRequest('TOOL_REQUEST: {"toolName":"wiki.query","input":{"query":"status"}}')).toEqual({
      toolName: "wiki.query",
      input: { query: "status" },
    });
    expect(parseAgentToolRequest('Here is an example: TOOL_REQUEST: {"toolName":"wiki.query","input":{}}')).toBeNull();
  });
});

describe("tool harness routes", () => {
  let server: FastifyInstance;
  let atelierRoot: string;
  let workspaceRoot: string;
  let services: Awaited<ReturnType<typeof createAppServices>>;

  beforeEach(async () => {
    workspaceRoot = await mkdtemp(path.join(tmpdir(), "atellier-tool-harness-test-"));
    atelierRoot = path.join(workspaceRoot, "atelier");
    await mkdir(path.join(workspaceRoot, "docs"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "docs", "tool-fixture.md"), "# Workspace fixture\nFirst bounded line.\nWorkspace boundary stays server-owned.\n", "utf8");
    services = await createAppServices({ storageMode: "memory", atelierRoot, workspaceRoot });
    server = await buildServer({ storageMode: "memory", atelierRoot, workspaceRoot, services });
  });

  afterEach(async () => {
    await server.close();
    await rm(workspaceRoot, { recursive: true, force: true });
  });

  it("exposes only explicitly catalogued capabilities and a policy check", async () => {
    const catalogResponse = await server.inject({ method: "GET", url: "/tool-harness/catalog" });
    expect(catalogResponse.statusCode).toBe(200);
    expect(catalogResponse.json()).toMatchObject({
      phase: "catalog-and-policy",
      definitions: expect.arrayContaining([
        expect.objectContaining({ name: "wiki.query", classification: "read", executionState: "available" }),
      ]),
    });

    const allowedResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/policy-check",
      payload: { toolName: "wiki.query", agentRole: "pm" },
    });
    expect(allowedResponse.statusCode).toBe(200);
    expect(allowedResponse.json()).toMatchObject({ action: "allow", reasonCode: "read-only-allowed" });

    const deniedResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/policy-check",
      payload: { toolName: "shell.exec", agentRole: "builder" },
    });
    expect(deniedResponse.statusCode).toBe(200);
    expect(deniedResponse.json()).toMatchObject({ action: "deny", reasonCode: "tool-unregistered" });
  });

  it("persists a denial when a bound execution budget excludes the requested tool", async () => {
    const run = await services.runs.create({ type: "manual", status: "running" });
    const response = await services.toolHarness.invoke({
      parentRunId: run.id,
      toolName: "wiki.query",
      agentRole: "pm",
      input: { query: "status" },
    }, { allowedTools: [] });

    expect(response.invocation).toMatchObject({
      status: "denied",
      policy: { action: "deny", reasonCode: "budget-tool-denied" },
    });
    expect((await services.runs.getById(run.id))?.toolInvocations).toEqual([
      expect.objectContaining({ id: response.invocation.id, status: "denied" }),
    ]);
  });

  it("executes a bounded read-only tool and persists its receipt on the parent run", async () => {
    const parentResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: { type: "manual", status: "running" },
    });
    const parentRun = parentResponse.json<{ id: string }>();

    const invokeResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/invoke",
      payload: {
        parentRunId: parentRun.id,
        toolName: "wiki.query",
        agentRole: "pm",
        input: { query: "operational memory", limit: 3, retrievalPolicy: "balanced" },
      },
    });
    expect(invokeResponse.statusCode).toBe(200);
    expect(invokeResponse.json()).toMatchObject({
      invocation: {
        parentRunId: parentRun.id,
        toolName: "wiki.query",
        status: "succeeded",
        classification: "read",
        policy: { action: "allow" },
      },
      result: { query: "operational memory" },
    });

    const parentAfter = await server.inject({ method: "GET", url: `/runs/${parentRun.id}` });
    expect(parentAfter.statusCode).toBe(200);
    expect(parentAfter.json()).toMatchObject({
      toolInvocations: [expect.objectContaining({ toolName: "wiki.query", status: "succeeded" })],
      logs: [expect.objectContaining({ message: expect.stringContaining("Tool wiki.query succeeded") })],
    });

    const workspaceReadResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/invoke",
      payload: {
        parentRunId: parentRun.id,
        toolName: "workspace.read",
        agentRole: "builder",
        input: { path: "docs/tool-fixture.md", startLine: 2, endLine: 3 },
      },
    });
    expect(workspaceReadResponse.statusCode).toBe(200);
    expect(workspaceReadResponse.json()).toMatchObject({
      invocation: { status: "succeeded", toolName: "workspace.read" },
      result: { path: "docs/tool-fixture.md", startLine: 2, endLine: 3, content: expect.stringContaining("First bounded line.") },
    });

    const workspaceSearchResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/invoke",
      payload: {
        parentRunId: parentRun.id,
        toolName: "workspace.search",
        agentRole: "builder",
        input: { query: "server-owned", limit: 5 },
      },
    });
    expect(workspaceSearchResponse.statusCode).toBe(200);
    expect(workspaceSearchResponse.json()).toMatchObject({
      invocation: { status: "succeeded", toolName: "workspace.search" },
      result: { matches: [expect.objectContaining({ path: "docs/tool-fixture.md", line: 3 })] },
    });

    const traversalResponse = await server.inject({
      method: "POST",
      url: "/tool-harness/invoke",
      payload: {
        parentRunId: parentRun.id,
        toolName: "workspace.read",
        agentRole: "builder",
        input: { path: "docs/../package.json" },
      },
    });
    expect(traversalResponse.statusCode).toBe(200);
    expect(traversalResponse.json()).toMatchObject({
      invocation: { status: "failed", outputSummary: expect.stringContaining("non-traversing") },
    });
  });

  it("reads two exact run receipts in one bounded request, including parent and initial Builder evidence", async () => {
    const caller = await services.runs.create({ type: "manual", status: "running" });
    const parentIds: string[] = [];
    for (const count of [1, 0]) {
      const builder = await services.runs.create({ type: "manual", status: "running" });
      await services.runs.complete(builder.id, { output: { validation: { passed: true, issues: [] } } });
      const parent = await services.runs.create({ type: "orchestration", status: "running" });
      await services.runs.complete(parent.id, { output: {
        readiness: "ready-for-human-review",
        repair: { attemptsUsed: count },
        steps: [{ stepId: "build", runId: builder.id }],
        qaChecklist: { items: [{ criterion: "Inspect current evidence", status: "pass", evidence: "Current artifact cites a run." }] },
      } });
      parentIds.push(parent.id);
    }
    const result = await services.toolHarness.invoke({
      parentRunId: caller.id,
      toolName: "runs.read",
      agentRole: "pm",
      input: { runIds: parentIds },
    });
    expect(result.invocation.status).toBe("succeeded");
    expect(result.result).toMatchObject([
      { id: parentIds[0], firstPassBuilderValid: true, deterministicRepairCount: 1, readiness: "ready-for-human-review" },
      { id: parentIds[1], firstPassBuilderValid: true, deterministicRepairCount: 0, readiness: "ready-for-human-review" },
    ]);
    expect(JSON.stringify(result.result).length).toBeLessThan(6_000);
    const overLimit = await services.toolHarness.invoke({ parentRunId: caller.id, toolName: "runs.read", agentRole: "pm", input: { runIds: [...parentIds, caller.id] } });
    expect(overLimit.invocation.status).toBe("failed");
  });

  it("only records an immutable decision for current candidate evidence", async () => {
    const evaluatedRun = await services.runs.create({ type: "manual", status: "completed" });
    await services.runs.recordEvaluation(evaluatedRun.id, {
      schemaVersion: 2,
      evaluationId: `terminal:${evaluatedRun.id}`,
      fingerprint: "a".repeat(64),
      runId: evaluatedRun.id,
      terminalStatus: "completed",
      outcome: "failed",
      validationPassed: false,
      needsHuman: false,
      executorMode: "mock",
      modelProfile: "standard",
      toolInvocations: { succeeded: 0, denied: 0, failed: 0 },
      startedAt: "2026-09-08T12:00:00.000Z",
      completedAt: "2026-09-08T12:00:01.000Z",
      durationMs: 1_000,
      recordedAt: "2026-09-08T12:00:00.000Z",
    });

    const candidatesResponse = await server.inject({ method: "GET", url: "/evaluations/candidates" });
    expect(candidatesResponse.statusCode).toBe(200);
    const candidate = candidatesResponse.json<{ candidates: Array<{ id: string; evidenceDigest: string }> }>().candidates
      .find((item) => item.id === "validation-failures");
    expect(candidate).toBeDefined();

    const missingCandidate = await server.inject({
      method: "POST",
      url: "/evaluations/candidates/decisions",
      payload: { candidateId: "invented", evidenceDigest: "a".repeat(64), decision: "accepted", note: "Review it." },
    });
    expect(missingCandidate.statusCode).toBe(404);

    const staleEvidence = await server.inject({
      method: "POST",
      url: "/evaluations/candidates/decisions",
      payload: { candidateId: candidate!.id, evidenceDigest: "a".repeat(64), decision: "accepted", note: "Review it." },
    });
    expect(staleEvidence.statusCode).toBe(409);

    const request = {
      candidateId: candidate!.id,
      evidenceDigest: candidate!.evidenceDigest,
      decision: "accepted",
      note: "Use this only to prepare a future experiment.",
    } as const;
    const created = await server.inject({ method: "POST", url: "/evaluations/candidates/decisions", payload: request });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ created: true, ...request });
    const createdPath = created.json<{ path: string }>().path;
    const decisionPage = await services.wiki.readPage(createdPath);
    expect(decisionPage.content).toContain("It does not activate a policy");

    const replay = await server.inject({ method: "POST", url: "/evaluations/candidates/decisions", payload: request });
    expect(replay.statusCode).toBe(200);
    expect(replay.json()).toMatchObject({ created: false, path: createdPath });

    const reviewedCandidates = await server.inject({ method: "GET", url: "/evaluations/candidates" });
    expect(reviewedCandidates.json()).toMatchObject({
      candidates: [expect.objectContaining({
        id: candidate!.id,
        status: "accepted-for-experiment",
        decision: expect.objectContaining({ note: request.note, path: createdPath }),
      })],
    });
    const experiment = await server.inject({ method: "POST", url: "/evaluations/candidates/experiments", payload: { candidateId: candidate!.id, evidenceDigest: candidate!.evidenceDigest, note: request.note } });
    expect(experiment.statusCode).toBe(201);
    expect(experiment.json()).toMatchObject({ candidateId: candidate!.id, mode: "shadow", status: "prepared" });
    const observation = await server.inject({ method: "POST", url: `/evaluations/experiments/${experiment.json<{ id: string }>().id}/observations`, payload: { quality: "better", durationMs: 1200, retries: 0, needsHuman: false, note: "Observation only; no runtime change." } });
    expect(observation.statusCode).toBe(200);
    expect(observation.json()).toMatchObject({ quality: "better", durationMs: 1200, path: expect.stringContaining("observations.md") });
    const comparison = await server.inject({ method: "GET", url: `/evaluations/experiments/${experiment.json<{ id: string }>().id}/comparison` });
    expect(comparison.statusCode).toBe(200);
    expect(comparison.json()).toMatchObject({ observations: 1, quality: { better: 1, same: 0, worse: 0 }, verdict: "improving", safety: "observation-only" });
    const experimentReplay = await server.inject({ method: "POST", url: "/evaluations/candidates/experiments", payload: { candidateId: candidate!.id, evidenceDigest: candidate!.evidenceDigest, note: request.note } });
    expect(experimentReplay.statusCode).toBe(200);

    const laterFailure = await services.runs.create({ type: "manual", status: "completed" });
    await services.runs.recordEvaluation(laterFailure.id, {
      schemaVersion: 2,
      evaluationId: `terminal:${laterFailure.id}`,
      fingerprint: "b".repeat(64),
      runId: laterFailure.id,
      terminalStatus: "completed",
      outcome: "failed",
      validationPassed: false,
      needsHuman: false,
      executorMode: "mock",
      modelProfile: "standard",
      toolInvocations: { succeeded: 0, denied: 0, failed: 0 },
      startedAt: "2026-09-08T12:01:00.000Z",
      completedAt: "2026-09-08T12:01:01.000Z",
      durationMs: 1_000,
      recordedAt: "2026-09-08T12:01:00.000Z",
    });
    const changedEvidence = await server.inject({ method: "GET", url: "/evaluations/candidates" });
    expect(changedEvidence.json()).toMatchObject({
      candidates: [expect.objectContaining({
        id: candidate!.id,
        status: "pending-review",
        history: [expect.objectContaining({ evidenceDigest: candidate!.evidenceDigest, decision: "accepted" })],
      })],
    });

    const conflict = await server.inject({
      method: "POST",
      url: "/evaluations/candidates/decisions",
      payload: { ...request, decision: "rejected" },
    });
    expect(conflict.statusCode).toBe(409);
  });

  it("records a terminal evaluation when an executor fails", async () => {
    const failingServices = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      agentExecutorMode: "mock",
      agentExecutor: {
        async execute() {
          throw new Error("Local executor unavailable.");
        },
      },
    });
    const agent = await failingServices.agents.create({ name: "Failing Builder", role: "builder" });

    await expect(failingServices.agentRuns.run(agent.id, { instruction: "Implement the requested change." }))
      .rejects.toThrow("Local executor unavailable.");

    const [failedRun] = await failingServices.runs.list({ statuses: ["failed"] });
    expect(failedRun).toMatchObject({ status: "failed" });
    expect(failedRun?.evaluationLedger).toEqual([
      expect.objectContaining({
        schemaVersion: 2,
        terminalStatus: "failed",
        outcome: "failed",
        error: { kind: "executor", message: "Local executor unavailable." },
      }),
    ]);
  });

  it("persists and reads inactive Control Bundles while rejecting an unknown proposal target", async () => {
    const created = await server.inject({ method: "POST", url: "/control-bundles", payload: { note: "Keep this draft inactive.", modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:4b", deep: "qwen3.5:4b" }, limits: { executionTimeoutMs: 120000, maxRetries: 3, contextBytes: 16000 }, allowedTools: ["wiki.query"] } });
    expect(created.statusCode).toBe(201);
    const bundle = created.json<{ id: string; status: string; fingerprint: string }>();
    expect(bundle).toMatchObject({ status: "draft", fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const fetched = await server.inject({ method: "GET", url: `/control-bundles/${bundle.id}` });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json()).toMatchObject({ id: bundle.id, limits: { maxRetries: 3 } });
    const listed = await server.inject({ method: "GET", url: "/control-bundles" });
    expect(listed.json()).toMatchObject({ bundles: [expect.objectContaining({ id: bundle.id })] });
    const unknownProposal = await server.inject({ method: "POST", url: "/control-bundle-proposals", payload: { experimentId: "unknown", bundleId: "bundle-missing", rationale: "Must fail closed." } });
    expect(unknownProposal.statusCode).toBe(400);
    expect(unknownProposal.json()).toMatchObject({ error: "Control Bundle does not exist." });
  });

  it("rejects a Control Bundle whose durable configuration no longer matches its fingerprint", async () => {
    const created = await server.inject({
      method: "POST",
      url: "/control-bundles",
      payload: {
        note: "Fingerprint this exact configuration.",
        modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:4b", deep: "qwen3.5:4b" },
        limits: { executionTimeoutMs: 120000, maxRetries: 3, contextBytes: 16000 },
        allowedTools: ["wiki.query"],
      },
    });
    const bundle = created.json<{ id: string; path: string }>();
    const bundlePath = path.join(atelierRoot, bundle.path);
    const content = await readFile(bundlePath, "utf8");
    await writeFile(bundlePath, content.replace('"cheap": "qwen3.5:4b"', '"cheap": "tampered:model"'), "utf8");

    await expect(services.wiki.getControlBundle(bundle.id)).rejects.toThrow("Control Bundle fingerprint is invalid.");
  });

  it("requires eligible shadow evidence before a durable proposal can receive approval", async () => {
    const experiment = await services.wiki.recordLearningShadowExperiment({
      candidate: {
        id: "paired-ledger-candidate",
        evidenceDigest: "d".repeat(64),
        title: "Receipt-derived comparison",
        rationale: "Only comparable terminal receipts may support a future proposal.",
        evidence: { total: 0, outcomes: { passed: 0, "needs-human": 0, failed: 0, cancelled: 0 }, toolInvocations: { succeeded: 0, denied: 0, failed: 0 }, generatedAt: "2026-09-10T00:00:00.000Z" },
        status: "accepted-for-experiment",
      },
      note: "Prepare a receipt-derived shadow comparison only.",
      createdAt: "2026-09-10T00:00:00.000Z",
    });
    const experimentId = experiment.id;
    for (let index = 0; index < 3; index += 1) await services.wiki.recordLearningShadowObservation({ experimentId, quality: "better", note: `Improvement ${index + 1}.`, observedAt: `2026-09-09T0${index}:00:00.000Z` });
    const bundle = (await server.inject({ method: "POST", url: "/control-bundles", payload: { note: "Prepared only.", modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:4b", deep: "qwen3.5:4b" }, limits: { executionTimeoutMs: 120000, maxRetries: 3, contextBytes: 16000 }, allowedTools: [] } })).json<{ id: string; fingerprint: string }>();
    const manualOnly = await server.inject({ method: "POST", url: "/control-bundle-proposals", payload: { experimentId, bundleId: bundle.id, rationale: "Manual observations must not make this eligible." } });
    expect(manualOnly.statusCode).toBe(400);
    expect(manualOnly.json()).toMatchObject({ error: expect.stringContaining("Requires at least 3 paired Evaluation Ledger receipts.") });

    const createReceipt = async (label: string, durationMs: number, contextReceiptHash = "c".repeat(64), configurationFingerprint = label.startsWith("baseline") ? "e".repeat(64) : bundle.fingerprint) => {
      const run = await services.runs.create({ type: "manual", status: "completed" });
      const evaluationId = `paired:${label}:${run.id}`;
      await services.runs.recordEvaluation(run.id, {
        schemaVersion: 2,
        evaluationId,
        fingerprint: run.id.replace(/[^a-f0-9]/g, "").padEnd(64, label.startsWith("baseline") ? "a" : "b").slice(0, 64),
        runId: run.id,
        terminalStatus: "completed",
        outcome: "passed",
        validationPassed: true,
        needsHuman: false,
        executorMode: "mock",
        modelProfile: "standard",
        configurationFingerprint,
        agentRole: "builder",
        orchestration: { logicalStepId: "build-artifact" },
        contextReceiptHash,
        toolInvocations: { succeeded: 0, denied: 0, failed: 0 },
        startedAt: "2026-09-10T00:00:00.000Z",
        completedAt: "2026-09-10T00:00:01.000Z",
        durationMs,
        recordedAt: "2026-09-10T00:00:01.000Z",
      });
      return { runId: run.id, evaluationId };
    };
    const incompatibleBaseline = await createReceipt("incompatible-baseline", 1_000, "1".repeat(64));
    const incompatibleShadow = await createReceipt("incompatible-shadow", 800, "2".repeat(64));
    const incompatiblePair = await server.inject({ method: "POST", url: `/evaluation-experiments/${experimentId}/ledger-pairs`, payload: { baseline: incompatibleBaseline, shadow: incompatibleShadow } });
    expect(incompatiblePair.statusCode).toBe(400);
    expect(incompatiblePair.json()).toMatchObject({ error: "Paired evidence requires the same Context Receipt hash." });
    let firstBaseline: { runId: string; evaluationId: string } | undefined;
    for (let index = 0; index < 3; index += 1) {
      const baseline = await createReceipt(`baseline-${index}`, 1_000);
      const shadow = await createReceipt(`shadow-${index}`, 800);
      firstBaseline ??= baseline;
      const pair = await server.inject({ method: "POST", url: `/evaluation-experiments/${experimentId}/ledger-pairs`, payload: { baseline, shadow } });
      expect(pair.statusCode).toBe(201);
      expect(pair.json()).toMatchObject({ experimentId, verdict: "improving", baseline, shadow });
    }
    const extraShadow = await createReceipt("shadow-reuse-check", 700);
    const reusedReceipt = await server.inject({ method: "POST", url: `/evaluation-experiments/${experimentId}/ledger-pairs`, payload: { baseline: firstBaseline!, shadow: extraShadow } });
    expect(reusedReceipt.statusCode).toBe(400);
    expect(reusedReceipt.json()).toMatchObject({ error: "An Evaluation Ledger receipt can belong to only one evidence pair." });
    const pairedComparison = await server.inject({ method: "GET", url: `/evaluation-experiments/${experimentId}/ledger-comparison` });
    expect(pairedComparison.json()).toMatchObject({ pairs: 3, quality: { improving: 3, neutral: 0, regressing: 0 }, safety: "receipt-derived-only", eligibility: { eligibleForProposal: true }, autonomousPromotion: { eligible: false, reasons: [expect.stringContaining("substantive-quality")] } });
    const allPairs = await server.inject({ method: "GET", url: "/evaluation-ledger/pairs" });
    expect(allPairs.json()).toMatchObject({ pairs: expect.arrayContaining([expect.objectContaining({ experimentId, verdict: "improving" })]) });

    const otherBundle = (await server.inject({ method: "POST", url: "/control-bundles", payload: { note: "Not the tested shadow configuration.", modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:9b", deep: "qwen3.5:9b" }, limits: { executionTimeoutMs: 90000, maxRetries: 2, contextBytes: 12000 }, allowedTools: [] } })).json<{ id: string }>();
    const wrongConfiguration = await server.inject({ method: "POST", url: "/control-bundle-proposals", payload: { experimentId, bundleId: otherBundle.id, rationale: "This must not borrow evidence from another configuration." } });
    expect(wrongConfiguration.statusCode).toBe(400);
    expect(wrongConfiguration.json()).toMatchObject({ error: "Paired shadow evidence was not produced by this exact Control Bundle configuration." });

    const proposal = await server.inject({ method: "POST", url: "/control-bundle-proposals", payload: { experimentId, bundleId: bundle.id, rationale: "Three independent shadow observations improved." } });
    expect(proposal.statusCode).toBe(201);
    const proposalId = proposal.json<{ id: string; status: string }>();
    expect(proposalId.status).toBe("pending-approval");
    const proposalRead = await server.inject({ method: "GET", url: `/control-bundle-proposals/${proposalId.id}` });
    expect(proposalRead.json()).toMatchObject({ id: proposalId.id, status: "pending-approval", fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), bundleFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), evidenceDigest: expect.stringMatching(/^[a-f0-9]{64}$/) });
    const approval = await server.inject({ method: "POST", url: `/control-bundle-proposals/${proposalId.id}/approval`, payload: { note: "Authorize a future bounded canary only.", expiresAt: "2030-01-01T00:00:00.000Z" } });
    expect(approval.statusCode).toBe(201);
    const verified = await server.inject({ method: "GET", url: `/control-bundle-proposals/${proposalId.id}/approval` });
    expect(verified.json()).toMatchObject({ approved: true, approval: { proposalId: proposalId.id, scope: "control-bundle-canary" } });
    const approvals = await server.inject({ method: "GET", url: `/control-bundle-proposals/${proposalId.id}/approvals` });
    expect(approvals.json()).toMatchObject({ approvals: [expect.objectContaining({ proposalId: proposalId.id, proposalFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), status: "active" })] });
    const canary = await server.inject({ method: "POST", url: `/control-bundle-proposals/${proposalId.id}/canary`, payload: { samplePercent: 5 } });
    expect(canary.statusCode).toBe(201);
    const canaryRecord = canary.json<{ id: string; fingerprint: string; frozenBundle: { limits: { executionTimeoutMs: number } } }>();
    const canaryId = canaryRecord.id;
    expect(canaryRecord).toMatchObject({ fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), frozenBundle: { limits: { executionTimeoutMs: 120000 } } });
    const listedCanaries = await server.inject({ method: "GET", url: "/control-bundle-canaries" });
    expect(listedCanaries.json()).toMatchObject({ canaries: [expect.objectContaining({ id: canaryId, proposalFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), status: "planned" })] });
    let blockedBudget: ReturnType<typeof server.inject> extends Promise<infer Value> ? Value : never;
    let reservedBudget: ReturnType<typeof server.inject> extends Promise<infer Value> ? Value : never;
    let reservedRun: Awaited<ReturnType<typeof services.skillOrchestrations.enqueue>> | undefined;
    for (let attempt = 0; attempt < 150 && (!blockedBudget! || !reservedBudget!); attempt += 1) {
      const run = await services.skillOrchestrations.enqueue({ skillId: "wiki-dream-loop", goal: `Canary reservation ${attempt}.` });
      const budget = await server.inject({ method: "POST", url: `/runs/${run.id}/control-budget`, payload: { canaryId } });
      if (budget.statusCode === 409 && !blockedBudget!) blockedBudget = budget;
      if (budget.statusCode === 201 && !reservedBudget!) {
        reservedBudget = budget;
        reservedRun = run;
      }
    }
    expect(blockedBudget!).toMatchObject({ statusCode: 409, json: expect.any(Function) });
    expect(blockedBudget!.json()).toMatchObject({ status: "blocked", reason: expect.stringContaining("outside the deterministic 5%") });
    expect(reservedBudget!).toMatchObject({ statusCode: 201, json: expect.any(Function) });
    expect(reservedBudget!.json()).toMatchObject({ status: "reserved", canaryId, canaryFingerprint: canaryRecord.fingerprint, assignmentFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), limits: { executionTimeoutMs: 120000 } });
    const boundRun = await services.runs.getById(reservedRun!.id);
    expect(boundRun).toMatchObject({
      input: { controlBudgetReceiptId: reservedBudget!.json<{ id: string }>().id, controlBundleFingerprint: bundle.fingerprint },
      execution: { maxAttempts: 4 },
    });
    const budgetReceipts = await server.inject({ method: "GET", url: "/control-bundle-budget-receipts" });
    expect(budgetReceipts.json()).toMatchObject({ receipts: expect.arrayContaining([expect.objectContaining({ canaryId, status: "reserved" }), expect.objectContaining({ canaryId, status: "blocked" })]) });
    const rollback = await server.inject({ method: "POST", url: `/control-bundle-canaries/${canaryId}/rollback`, payload: { reason: "Operator stopped the planned sample." } });
    expect(rollback.json()).toMatchObject({ status: "rolled-back", samplePercent: 5 });
    await expect(services.controlBundles.resolveRuntimeBudget(boundRun!)).rejects.toThrow("rolled back or is no longer executable");
    const postRollbackRun = await services.runs.create({ type: "manual", status: "queued" });
    const postRollbackBudget = await server.inject({ method: "POST", url: `/runs/${postRollbackRun.id}/control-budget`, payload: { canaryId } });
    expect(postRollbackBudget.statusCode).toBe(409);
    expect(postRollbackBudget.json()).toMatchObject({ status: "blocked", reason: "Canary has been rolled back." });
    const rolledBackProposal = await server.inject({ method: "GET", url: `/control-bundle-proposals/${proposalId.id}` });
    expect(rolledBackProposal.json()).toMatchObject({ status: "canary-rolled-back" });
    const secondApproval = await server.inject({
      method: "POST",
      url: `/control-bundle-proposals/${proposalId.id}/approval`,
      payload: { note: "A canary lifecycle cannot receive a new approval.", expiresAt: "2031-01-01T00:00:00.000Z" },
    });
    expect(secondApproval.statusCode).toBe(400);
    expect(secondApproval.json()).toMatchObject({ error: "Control Bundle proposal has already entered its canary lifecycle." });
  });

  it("does not create an approval for an unknown Control Bundle proposal", async () => {
    const approval = await server.inject({
      method: "POST",
      url: "/control-bundle-proposals/proposal-missing/approval",
      payload: { note: "This must remain unapproved.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    expect(approval.statusCode).toBe(400);
    expect(approval.json()).toMatchObject({ error: "Control Bundle proposal does not exist." });
  });

  it("records one attempt-scoped terminal receipt when a durable orchestration is blocked", async () => {
    const startedAt = "2026-09-08T12:00:00.000Z";
    const finishedAt = "2026-09-08T12:00:05.000Z";
    const blocked = await services.runs.create({
      type: "orchestration",
      status: "blocked",
      input: { skillId: "atellier-build-loop", goal: "Stop safely for review." },
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "blocked",
        definitionHash: "terminal-receipt-test",
        definitionSnapshot: { id: "atellier-build-loop", steps: [] },
        idempotencyKey: "terminal-receipt-test",
        attempt: 2,
        maxAttempts: 3,
        nextEventSequence: 0,
        availableAt: startedAt,
        startedAt,
        finishedAt,
        lastError: "QA evidence requires human review.",
      },
    });

    const first = await services.runs.recordTerminalOrchestrationEvaluation(blocked.id);
    const replay = await services.runs.recordTerminalOrchestrationEvaluation(blocked.id);

    expect(first?.evaluationLedger).toEqual([
      expect.objectContaining({
        evaluationId: `orchestration-terminal:${blocked.id}:generation:0:attempt:2`,
        terminalStatus: "blocked",
        outcome: "needs-human",
        validationPassed: false,
        needsHuman: true,
        error: { kind: "validation", message: "QA evidence requires human review." },
        durationMs: 5_000,
      }),
    ]);
    expect(replay?.evaluationLedger).toHaveLength(1);
  });

  it("lets an agent make one bounded request and then answer with the returned result", async () => {
    let callCount = 0;
    const executor: AgentExecutorService = {
      async execute() {
        callCount += 1;
        if (callCount === 1) {
          return {
            response: 'TOOL_REQUEST: {"toolName":"wiki.query","input":{"query":"operational memory","limit":3}}',
            needsHuman: false,
          };
        }
        return {
          response: [
            "## Scope",
            "Use the retrieved operational memory.",
            "## Approach",
            "Keep the next work bounded.",
            "## Acceptance Criteria",
            "The evidence is cited in the run receipt.",
            "## Handoff",
            "Builder may proceed.",
          ].join("\n"),
          needsHuman: false,
        };
      },
    };
    const services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      agentExecutorMode: "mock",
      agentExecutor: executor,
    });
    const agent = await services.agents.create({ name: "Harness PM", role: "pm" });

    const result = await services.agentRuns.run(agent.id, {
      instruction: "Find the current operational memory and make a plan.",
    });

    expect(callCount).toBe(2);
    expect(result?.run.toolInvocations).toEqual([
      expect.objectContaining({ toolName: "wiki.query", status: "succeeded", parentRunId: result?.run.id }),
    ]);
    expect(result?.run.evaluation).toMatchObject({
      outcome: "passed",
      validationPassed: true,
      toolInvocations: { succeeded: 1, denied: 0, failed: 0 },
    });
    expect((result?.run.output as { response?: string }).response).toContain("Use the retrieved operational memory.");
  });

  it("gives the initial artifact Builder one final response after a repeated post-result request without invoking a second tool", async () => {
    const request = 'TOOL_REQUEST: {"toolName":"wiki.query","input":{"query":"operational memory","limit":3}}';
    let callCount = 0;
    const executor: AgentExecutorService = {
      async execute(input) {
        callCount += 1;
        if (callCount < 3) return { response: request, needsHuman: false };
        expect(input.instruction).toContain("No further tool request can be executed.");
        return {
          response: [
            "## Summary", "Prepared a complete operating note.",
            "## Requested Artifact", "Day 1: Review one bounded task and record the observable run outcome for the operator.",
            "## Risk Assessment", "Human review remains required.",
            "## Blockers", "None.",
            "## QA Handoff", "Review the artifact.",
          ].join("\n\n"),
          needsHuman: false,
        };
      },
    };
    const localServices = await createAppServices({
      storageMode: "memory", atelierRoot, agentExecutorMode: "mock", agentExecutor: executor,
    });
    const agent = await localServices.agents.create({ name: "Artifact Builder", role: "builder" });
    const result = await localServices.agentRuns.run(agent.id, {
      instruction: "Create a complete operating note.",
      orchestrationStep: {
        orchestrationRunId: "parent-test",
        stepId: "build",
        label: "Implement the slice",
        phase: "backend",
        validationProfile: "artifact-builder",
      },
    }, { completeArtifactAfterTool: true });

    expect(callCount).toBe(3);
    expect(result?.run.toolInvocations).toHaveLength(1);
    expect(result?.run.toolInvocations?.[0]).toMatchObject({ status: "succeeded", toolName: "wiki.query" });
    expect((result?.run.output as { validation?: { passed?: boolean } }).validation?.passed).toBe(true);
    expect((result?.run.output as { response?: string }).response).toContain("## Requested Artifact");
  });
});
