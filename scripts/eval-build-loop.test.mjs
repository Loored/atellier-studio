import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { assessCampaignBudget, buildCampaignManifest, parseEvaluationArgs, QUALITY_CAMPAIGN_BUDGET, readRepositorySnapshot, resolveJournalPath, resolveMatrixPath, summarizeRun, validateMatrix } from "./eval-build-loop.mjs";
import { auditReservedHoldout } from "../.protected-evals/holdout-audit.mjs";
import { auditSealedQuality, SEALED_QUALITY_V1_HASH } from "../.protected-evals/sealed-quality-v1-audit.mjs";

test("the frozen matrix contains eight distinct cases with acceptance criteria", () => {
  const matrix = validateMatrix(JSON.parse(readFileSync(new URL("./evaluations/2026-09-16-varied-build-loop.json", import.meta.url))));
  assert.equal(matrix.cases.length, 8);
  assert.equal(new Set(matrix.cases.map((item) => item.family)).size, 4);
  assert.throws(() => validateMatrix({ ...matrix, cases: [matrix.cases[0], ...matrix.cases.slice(0, 7)] }), /duplicate/);
});

test("reserved holdout is a separate immutable eight-case suite", () => {
  const bytes = readFileSync(new URL("../.protected-evals/holdout-v1.json", import.meta.url));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "e5cf76058616ae510020b7a421dfd2e8d6764a40708ff55fe715c6c16086b37f");
  const matrix = validateMatrix(JSON.parse(bytes.toString("utf8")));
  assert.equal(new Set(matrix.cases.map((item) => item.family)).size, 4);
  assert.ok(matrix.cases.every((item) => item.id.startsWith("holdout-")));
});

test("single-case evaluation selects an exact frozen ID without changing the matrix or journal", () => {
  const matrix = validateMatrix(JSON.parse(readFileSync(new URL("../.protected-evals/holdout-v1.json", import.meta.url))));
  assert.deepEqual(parseEvaluationArgs(["--holdout", "--case=holdout-run-repair-difference"], matrix), {
    limit: 8, caseId: "holdout-run-repair-difference", campaign: undefined, variant: undefined, sealed: undefined,
  });
  assert.throws(() => parseEvaluationArgs(["--holdout", "--case=unknown"], matrix), /exact case ID/);
  assert.throws(() => parseEvaluationArgs(["--case=holdout-run-repair-difference", "2"], matrix), /cannot be combined/);
  assert.throws(() => parseEvaluationArgs(["--holdout", "--holdout"], matrix), /Only an optional/);
});

test("campaign identity creates an isolated reproducible journal", () => {
  const matrix = validateMatrix(JSON.parse(readFileSync(new URL("../.protected-evals/holdout-v1.json", import.meta.url))));
  assert.deepEqual(parseEvaluationArgs(["--holdout", "--campaign=c1-proof", "--variant=contract-v3"], matrix), {
    limit: 8, caseId: undefined, campaign: "c1-proof", variant: "contract-v3", sealed: undefined,
  });
  assert.match(resolveJournalPath({ holdout: true, campaign: "c1-proof", variant: "contract-v3" }), /atelier\/runs\/evaluations\/c1-proof--contract-v3--holdout\.ndjson$/);
  assert.throws(() => parseEvaluationArgs(["--campaign=missing-variant"], matrix), /must be paired/);
});

test("sealed suite is eight frozen cases with its own campaign journal and negative audit", () => {
  const matrix = validateMatrix(JSON.parse(readFileSync(new URL("../.protected-evals/sealed-quality-v1.json", import.meta.url))));
  assert.equal(createHash("sha256").update(readFileSync(new URL("../.protected-evals/sealed-quality-v1.json", import.meta.url))).digest("hex"), SEALED_QUALITY_V1_HASH);
  assert.deepEqual(parseEvaluationArgs(["--sealed=quality-v1", "--campaign=sealed-v1", "--variant=contract-v3"], matrix), {
    limit: 8, caseId: undefined, campaign: "sealed-v1", variant: "contract-v3", sealed: "quality-v1",
  });
  assert.match(resolveMatrixPath({ holdout: false, sealed: "quality-v1" }), /\.protected-evals\/sealed-quality-v1\.json$/);
  assert.match(resolveJournalPath({ holdout: false, sealed: "quality-v1", campaign: "sealed-v1", variant: "contract-v3" }), /sealed-v1--contract-v3--sealed-quality-v1\.ndjson$/);
  assert.throws(() => parseEvaluationArgs(["--holdout", "--sealed=quality-v1"], matrix), /cannot be combined/);
  assert.equal(auditSealedQuality({ caseId: "sealed-blank-review-template", parentRunId: "parent", artifact: "## Scope\nparent" }).verdict, "rejected");
});

test("campaign manifest binds the configuration to an exact repository snapshot", () => {
  const commands = new Map([
    ["rev-parse HEAD", "abc123"],
    ["status --porcelain=v1", " M apps/api/src/a.ts\n?? scripts/evaluations/b.json"],
  ]);
  const repository = readRepositorySnapshot((args) => commands.get(args.join(" ")));
  assert.deepEqual(repository, {
    revision: "abc123", changedPaths: ["apps/api/src/a.ts", "scripts/evaluations/b.json"],
    fingerprint: "5f36731fcbf62ca64ad65ebdbf95bbd4115ce0d765a9e5519ab21404f7231a47",
  });
  const manifest = buildCampaignManifest({
    campaign: "quality-v1", variant: "contract-v3", matrixHash: "matrix", repository,
    health: { storageMode: "mongo", executorMode: "ollama", executorModel: "qwen3.5:4b", executorRoleOverrides: { qa: "qwen3.5:9b" } },
  });
  assert.equal(manifest.repository.revision, "abc123");
  assert.equal(manifest.budget.maxSemanticRepairsPerCase, 1);
});

test("frozen campaign budget fails closed after an expensive or repeated-repair case", () => {
  assert.deepEqual(assessCampaignBudget({ measuredChildDurationMs: QUALITY_CAMPAIGN_BUDGET.maxMeasuredChildDurationMs, semanticRepairs: 1 }), { withinBudget: true, reasons: [] });
  assert.deepEqual(assessCampaignBudget({ measuredChildDurationMs: QUALITY_CAMPAIGN_BUDGET.maxMeasuredChildDurationMs + 1, semanticRepairs: 2 }), {
    withinBudget: false,
    reasons: [
      `Measured child duration exceeded ${QUALITY_CAMPAIGN_BUDGET.maxMeasuredChildDurationMs} ms.`,
      "Semantic repairs exceeded 1.",
    ],
  });
});

test("holdout detects self-reference without declaring any artifact positively verified", () => {
  assert.equal(auditReservedHoldout({ caseId: "holdout-plan-blocked-run", parentRunId: "parent-id", artifact: "Day 1 inspects parent-id" }).verdict, "rejected");
  assert.equal(auditReservedHoldout({ caseId: "holdout-plan-blocked-run", parentRunId: "parent-id", artifact: "Day 1 inspects prior run receipts" }).verdict, "unverified");
});

test("summarizes receipts without treating parent completion as substantive approval", () => {
  const status = { steps: [{ stepId: "build", runId: "child", status: "completed" }] };
  const parent = { status: "completed", reviewStatus: "pending", output: {
    readiness: "needs-human", validation: { passed: false, issues: [{ code: "qa.off-artifact" }] },
    repair: { attemptsUsed: 0 }, semanticRepair: { attemptsUsed: 0 },
  } };
  const children = [{ id: "child", output: { validation: { passed: true, issues: [] } }, toolInvocations: [] }];
  assert.deepEqual(summarizeRun(status, parent, children), {
    status: "completed", reviewStatus: "pending", readiness: "needs-human", validationPassed: false,
    validationIssues: ["qa.off-artifact"], firstBuilderPassed: true, firstBuilderIssues: [],
    deterministicRepairs: 0, semanticRepairs: 0, qaChecklist: [], measuredChildDurationMs: null,
    models: [], toolInvocations: [], childRunIds: [{ stepId: "build", runId: "child", status: "completed" }],
  });
});
