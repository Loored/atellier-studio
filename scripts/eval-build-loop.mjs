/** Sequential, resumable local-only evaluation of the frozen Build Loop matrix. */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { auditFrozenNegativeControls } from "./evaluations/quality-audit.mjs";
import { auditReservedHoldout } from "../.protected-evals/holdout-audit.mjs";
import { auditSealedQuality } from "../.protected-evals/sealed-quality-v1-audit.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const api = "http://127.0.0.1:4000";
const terminalStatuses = new Set(["completed", "failed", "blocked", "cancelled", "approved"]);
/** Frozen per-campaign guardrails. The API still owns per-step execution limits. */
export const QUALITY_CAMPAIGN_BUDGET = Object.freeze({
  maxMeasuredChildDurationMs: 12 * 60_000,
  maxSemanticRepairsPerCase: 1,
});
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

export function validateMatrix(matrix) {
  if (matrix?.schemaVersion !== 1 || matrix.skillId !== "atellier-build-loop" || !Array.isArray(matrix.cases) || matrix.cases.length !== 8) {
    throw new Error("Expected a frozen eight-case Build Loop matrix.");
  }
  const ids = new Set();
  for (const item of matrix.cases) {
    if (!item.id || ids.has(item.id) || !item.family || !item.goal || !Array.isArray(item.acceptance) || item.acceptance.length < 3) {
      throw new Error(`Invalid or duplicate evaluation case: ${item.id ?? "missing id"}`);
    }
    ids.add(item.id);
  }
  return matrix;
}

export function parseEvaluationArgs(args, matrix) {
  const holdoutFlags = args.filter((arg) => arg === "--holdout");
  const sealedFlags = args.filter((arg) => arg.startsWith("--sealed="));
  const caseFlags = args.filter((arg) => arg.startsWith("--case="));
  const campaignFlags = args.filter((arg) => arg.startsWith("--campaign="));
  const variantFlags = args.filter((arg) => arg.startsWith("--variant="));
  const limits = args.filter((arg) => arg !== "--holdout" && !arg.startsWith("--sealed=") && !arg.startsWith("--case=") && !arg.startsWith("--campaign=") && !arg.startsWith("--variant="));
  if (holdoutFlags.length > 1 || sealedFlags.length > 1 || caseFlags.length > 1 || campaignFlags.length > 1 || variantFlags.length > 1 || limits.length > 1 ||
    args.some((arg) => !holdoutFlags.includes(arg) && !sealedFlags.includes(arg) && !caseFlags.includes(arg) && !campaignFlags.includes(arg) && !variantFlags.includes(arg) && !limits.includes(arg))) {
    throw new Error("Only an optional 1..8 limit, --holdout or --sealed=quality-v1, one --case=ID, and paired --campaign/--variant flags are supported.");
  }
  const limit = limits.length === 0 ? 8 : Number(limits[0]);
  if (!Number.isInteger(limit) || limit < 1 || limit > 8 || (caseFlags.length && limits.length)) {
    throw new Error("Optional limit must be 1 through 8 and cannot be combined with --case.");
  }
  const caseId = caseFlags[0]?.slice("--case=".length);
  if (caseFlags.length && (!caseId || !matrix.cases.some((item) => item.id === caseId))) {
    throw new Error("--case must name one exact case ID from the selected frozen matrix.");
  }
  const campaign = campaignFlags[0]?.slice("--campaign=".length);
  const variant = variantFlags[0]?.slice("--variant=".length);
  if (Boolean(campaign) !== Boolean(variant) || (campaign && (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(campaign) || !/^[a-z0-9][a-z0-9-]{0,63}$/i.test(variant)))) {
    throw new Error("--campaign and --variant must be paired identifiers using letters, digits, or hyphens.");
  }
  const sealed = sealedFlags[0]?.slice("--sealed=".length);
  if (holdoutFlags.length && sealedFlags.length) throw new Error("--holdout and --sealed cannot be combined.");
  if (sealed && sealed !== "quality-v1") throw new Error("Only --sealed=quality-v1 is available.");
  return { limit, caseId, campaign, variant, sealed };
}

export function resolveJournalPath({ holdout, sealed, campaign, variant }) {
  const suite = sealed ? `--sealed-${sealed}` : holdout ? "--holdout" : "";
  if (!campaign || !variant) return resolve(root, holdout ? "atelier/runs/2026-09-16-holdout-evaluation.ndjson" : "atelier/runs/2026-09-16-varied-goal-evaluation.ndjson");
  return resolve(root, "atelier/runs/evaluations", `${campaign}--${variant}${suite}.ndjson`);
}

export function resolveMatrixPath({ holdout, sealed }) {
  return resolve(root, sealed ? `.protected-evals/sealed-${sealed}.json` : holdout ? ".protected-evals/holdout-v1.json" : "scripts/evaluations/2026-09-16-varied-build-loop.json");
}

export function buildCampaignManifest({ campaign, variant, matrixHash, health, repository }) {
  const configurationFingerprint = createHash("sha256").update(JSON.stringify({
    campaign, variant, matrixHash, repository, storageMode: health.storageMode, executorMode: health.executorMode,
    executorModel: health.executorModel, executorRoleOverrides: health.executorRoleOverrides,
  })).digest("hex");
  return {
    campaign, variant, matrixHash, configurationFingerprint, repository, budget: QUALITY_CAMPAIGN_BUDGET,
    health: {
      storageMode: health.storageMode, executorMode: health.executorMode, executorModel: health.executorModel,
      executorRoleOverrides: health.executorRoleOverrides,
    },
  };
}

export function readRepositorySnapshot(command = (args) => execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim()) {
  const revision = command(["rev-parse", "HEAD"]);
  const changedPaths = command(["status", "--porcelain=v1"]).split("\n").filter(Boolean).map((line) => line.slice(3)).sort();
  const fingerprint = createHash("sha256").update(JSON.stringify({ revision, changedPaths })).digest("hex");
  return { revision, changedPaths, fingerprint };
}

export function summarizeRun(status, parent, childRuns) {
  const steps = status.steps ?? [];
  const firstBuilder = steps.find((step) => step.stepId === "build");
  const builder = childRuns.find((run) => run.id === firstBuilder?.runId);
  const invocations = childRuns.flatMap((run) => (run.toolInvocations ?? []).map((invocation) => ({
    stepId: steps.find((step) => step.runId === run.id)?.stepId ?? "unknown",
    toolName: invocation.toolName,
    status: invocation.status,
  })));
  const output = parent.output ?? {};
  return {
    status: parent.status,
    reviewStatus: parent.reviewStatus,
    readiness: output.readiness ?? null,
    validationPassed: output.validation?.passed ?? false,
    validationIssues: output.validation?.issues?.map((issue) => issue.code) ?? [],
    firstBuilderPassed: builder?.output?.validation?.passed ?? null,
    firstBuilderIssues: builder?.output?.validation?.issues?.map((issue) => issue.code) ?? [],
    deterministicRepairs: output.repair?.attemptsUsed ?? null,
    semanticRepairs: output.semanticRepair?.attemptsUsed ?? null,
    qaChecklist: output.qaChecklist?.items?.map((item) => ({ criterion: item.criterion, status: item.status })) ?? [],
    measuredChildDurationMs: output.performance?.totalDurationMs ?? null,
    models: output.performance?.byModel ?? [],
    toolInvocations: invocations,
    childRunIds: steps.map((step) => ({ stepId: step.stepId, runId: step.runId ?? null, status: step.status })),
  };
}

export function assessCampaignBudget(summary) {
  const reasons = [];
  if (typeof summary.measuredChildDurationMs === "number" && summary.measuredChildDurationMs > QUALITY_CAMPAIGN_BUDGET.maxMeasuredChildDurationMs) {
    reasons.push(`Measured child duration exceeded ${QUALITY_CAMPAIGN_BUDGET.maxMeasuredChildDurationMs} ms.`);
  }
  if (typeof summary.semanticRepairs === "number" && summary.semanticRepairs > QUALITY_CAMPAIGN_BUDGET.maxSemanticRepairsPerCase) {
    reasons.push(`Semantic repairs exceeded ${QUALITY_CAMPAIGN_BUDGET.maxSemanticRepairsPerCase}.`);
  }
  return { withinBudget: reasons.length === 0, reasons };
}

async function request(method, path, body) {
  const response = await fetch(`${api}${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${method} ${path}: HTTP ${response.status} ${await response.text()}`);
  return response.json();
}

function journal(journalPath, event) {
  mkdirSync(resolve(journalPath, ".."), { recursive: true });
  appendFileSync(journalPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, { flag: "a" });
}

function readJournal(journalPath) {
  if (!existsSync(journalPath)) return [];
  return readFileSync(journalPath, "utf8").split("\n").filter(Boolean).map((line) => JSON.parse(line));
}

async function waitForTerminal(caseId, runId) {
  const deadline = Date.now() + 25 * 60_000;
  let lastProgress = "";
  let lastReport = 0;
  while (Date.now() < deadline) {
    const status = await request("GET", `/orchestrations/${runId}/status`);
    const progress = (status.steps ?? []).map((step) => `${step.stepId}:${step.status}`).join(" ");
    if (progress !== lastProgress || Date.now() - lastReport >= 30_000) {
      console.log(`[${caseId}] ${status.status} ${progress}`);
      lastProgress = progress;
      lastReport = Date.now();
    }
    if (terminalStatuses.has(status.status)) return status;
    await sleep(5_000);
  }
  throw new Error(`Run ${runId} exceeded 25 minutes; journal retains its ID for resume.`);
}

async function main() {
  const rawArgs = process.argv.slice(2);
  const holdout = rawArgs.includes("--holdout");
  const sealed = rawArgs.find((arg) => arg.startsWith("--sealed="))?.slice("--sealed=".length);
  const matrixPath = resolveMatrixPath({ holdout, sealed });
  const matrix = validateMatrix(JSON.parse(readFileSync(matrixPath, "utf8")));
  const { limit, caseId, campaign, variant } = parseEvaluationArgs(rawArgs, matrix);
  const journalPath = resolveJournalPath({ holdout, sealed, campaign, variant });
  const matrixHash = createHash("sha256").update(readFileSync(matrixPath)).digest("hex");
  const events = readJournal(journalPath);
  if (events.some((event) => event.matrixHash !== matrixHash)) throw new Error("Matrix changed after the evaluation journal began.");
  if (events.some((event) => event.campaign !== campaign || event.variant !== variant)) throw new Error("Campaign journal belongs to a different variant identity.");
  if (events.length === 0 && campaign && variant) {
    const health = await request("GET", "/health");
    journal(journalPath, { type: "manifest", ...buildCampaignManifest({
      campaign, variant, matrixHash, health, repository: readRepositorySnapshot(),
    }) });
  }
  let processed = 0;

  for (const item of matrix.cases) {
    if (caseId && item.id !== caseId) continue;
    if (processed >= limit) break;
    const history = events.filter((event) => event.caseId === item.id);
    if (history.some((event) => event.type === "finished")) continue;
    const priorBudgetFailure = events.find((event) => event.type === "budget-exceeded");
    if (priorBudgetFailure) {
      console.log(`Campaign halted by frozen budget: ${priorBudgetFailure.reasons.join(" ")}`);
      break;
    }
    let runId = history.find((event) => event.type === "started")?.runId;
    if (!runId && history.some((event) => event.type === "intent")) {
      throw new Error(`Uncertain enqueue for ${item.id}: intent was journaled without a run ID. Reconcile the API before any retry.`);
    }
    if (!runId) {
      const health = await request("GET", "/health");
      if (health.status !== "ok" || health.storageMode !== "mongo" || health.executorMode !== "ollama"
        || health.mongo?.connected !== true || health.metrics?.activeRuns !== 0) {
        throw new Error(`Unsafe evaluation preflight for ${item.id}: ${JSON.stringify({
          status: health.status, storageMode: health.storageMode, executorMode: health.executorMode,
          mongoConnected: health.mongo?.connected, activeRuns: health.metrics?.activeRuns,
        })}`);
      }
      journal(journalPath, { type: "intent", matrixHash, campaign, variant, caseId: item.id, family: item.family });
      const started = await request("POST", "/orchestrations/skills/atellier-build-loop/run", {
        goal: item.goal,
        context: item.context,
        semanticRepairLimit: QUALITY_CAMPAIGN_BUDGET.maxSemanticRepairsPerCase,
      });
      runId = started.runId;
      journal(journalPath, { type: "started", matrixHash, campaign, variant, caseId: item.id, family: item.family, runId });
      console.log(`[${item.id}] started ${runId}`);
    } else {
      console.log(`[${item.id}] resuming ${runId}`);
    }
    const status = await waitForTerminal(item.id, runId);
    const parent = await request("GET", `/runs/${runId}`);
    const childRuns = await Promise.all((status.steps ?? []).filter((step) => step.runId)
      .map((step) => request("GET", `/runs/${step.runId}`)));
    const summary = summarizeRun(status, parent, childRuns);
    summary.campaignBudget = assessCampaignBudget(summary);
    summary.qualityAudit = sealed
      ? auditSealedQuality({ caseId: item.id, parentRunId: runId, artifact: parent.output?.artifact?.content ?? "" })
      : holdout ? auditReservedHoldout({ caseId: item.id, parentRunId: runId, artifact: parent.output?.artifact?.content ?? "" })
        : auditFrozenNegativeControls({ caseId: item.id, parentRunId: runId, artifact: parent.output?.artifact?.content ?? "" });
    journal(journalPath, { type: "finished", matrixHash, campaign, variant, caseId: item.id, family: item.family, runId, summary });
    if (!summary.campaignBudget.withinBudget) {
      journal(journalPath, { type: "budget-exceeded", matrixHash, campaign, variant, caseId: item.id, runId, reasons: summary.campaignBudget.reasons });
      console.log(`[${item.id}] campaign budget exceeded; no later case will be dispatched.`);
    }
    console.log(`[${item.id}] finished ${runId} ${summary.readiness ?? summary.status}; firstBuilder=${summary.firstBuilderPassed}; repairs=${summary.deterministicRepairs}/${summary.semanticRepairs}; tools=${summary.toolInvocations.length}`);
    processed += 1;
  }
  console.log(`Evaluation invocation complete: ${processed} case(s) processed; journal ${journalPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
