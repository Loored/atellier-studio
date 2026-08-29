/**
 * Multi-agent live smoke test (provider-agnostic).
 *
 * Drives the real local API (default http://127.0.0.1:4000) through one
 * orchestration skill so every step is visible in real time at
 * http://127.0.0.1:5173 (Office, Runs, Review).
 *
 * Works against any non-mock executor mode: openai, anthropic, groq, ollama.
 * The script reads /health to discover the active mode and refuses to run
 * against `mock` (where every response is fake and the test would not prove
 * anything about the integration).
 *
 * Pre-requisites:
 *   - API running with an executor mode set (and the relevant API key, if any)
 *   - FED running (pnpm --filter @atellier/web dev) for live UI feedback
 *
 * Usage:
 *   pnpm --filter @atellier/api exec tsx src/test/live-flow.ts
 *
 * Optional env overrides:
 *   API_URL=http://127.0.0.1:4000     # API base URL
 *   FED_URL=http://127.0.0.1:5173     # FED base URL (only used in log output)
 *   SKILL=atellier-build-loop          # or llm-wiki-ingest-loop
 *   RUN_ID=<existing orchestration id> # inspect without starting a new run
 *   GOAL="..."                         # custom orchestration goal
 *   CONTEXT="..."                      # custom orchestration context
 *   POLL_TIMEOUT_MS=180000             # how long to wait before giving up
 *   OUTPUT_FORMAT=json                 # machine-readable final result
 *
 * Exit codes:
 *   0 = ready for human review / successful non-build skill
 *   1 = failed, cancelled, or unexpected error
 *   2 = completed but needs human input
 *   3 = polling timeout
 *
 * ⚠️  Real LLM calls cost real money on hosted providers (OpenAI, Anthropic).
 *     Groq has a free tier and Ollama is fully local — both are good defaults
 *     for repeated smoke testing.
 */

import type { Run } from "@atellier/shared";
import {
  LIVE_FLOW_EXIT_CODES,
  evaluateLiveFlow,
  type LiveFlowOrchestrationStatus,
  type LiveFlowResult,
  type LiveFlowStepStatus,
} from "./live-flow-result";

const API = process.env.API_URL ?? "http://127.0.0.1:4000";
const SKILL_ID = process.env.SKILL ?? "atellier-build-loop";
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS ?? 180_000);
const POLL_INTERVAL_MS = 2_000;
const FED_URL = process.env.FED_URL ?? "http://127.0.0.1:5173";
const OUTPUT_FORMAT = process.env.OUTPUT_FORMAT ?? "text";
const JSON_OUTPUT = OUTPUT_FORMAT === "json";

const DEFAULT_GOALS: Record<string, { goal: string; context: string }> = {
  "atellier-build-loop": {
    goal:
      "Create a practical 3-day operating plan for using Atellier daily. " +
      "Each day must include Objective, Actions, Expected Evidence, Acceptance Signal, " +
      "Risks, and Human Approval Boundary.",
    context:
      "Private local-first workflow. Produce the complete plan under Requested Artifact. " +
      "Do not reference or modify repository files.",
  },
  "llm-wiki-ingest-loop": {
    goal:
      "Ingest this short note into the wiki: 'Anthropic Code with Claude 2026 " +
      "keynote introduced Opus 4.7 with prompt caching and Skills 2.0. " +
      "Atellier should expose itself as MCP server.'",
    context: "Source: developer-notes/keynote-2026-05-06.md (paraphrased).",
  },
  "wiki-dream-loop": {
    goal:
      "Periodic curator pass over the wiki — surface stale pages, " +
      "contradictions, and orphan notes; propose tidy-ups but apply nothing.",
    context: "Triggered manually as part of the live smoke test.",
  },
};

const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
} as const;
const clr = (color: keyof typeof c, s: string) => `${c[color]}${s}${c.reset}`;
const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const dim = (s: string) => `${c.dim}${s}${c.reset}`;

type HealthStatus = {
  status: string;
  executorMode: string;
  executorModel: string;
  modelProfile: string;
};

type StartResponse = { runId: string };

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  const res = await fetch(`${API}${path}`, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function statusGlyph(status: LiveFlowStepStatus["status"]): string {
  switch (status) {
    case "pending": return clr("dim", "·");
    case "running": return clr("yellow", "▶");
    case "completed": return clr("green", "✓");
    case "failed": return clr("red", "✗");
  }
}

function renderProgress(status: LiveFlowOrchestrationStatus): string {
  return status.steps
    .map((step) => {
      const glyph = statusGlyph(step.status);
      return `  ${glyph} ${dim(`[${step.phase}]`)} ${bold(step.agentName)} — ${step.label}`;
    })
    .join("\n");
}

class PollingTimeoutError extends Error {}

async function pollUntilDone(runId: string): Promise<LiveFlowOrchestrationStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastRender = "";

  while (Date.now() < deadline) {
    const status = await req<LiveFlowOrchestrationStatus>("GET", `/orchestrations/${runId}/status`);
    const render = renderProgress(status);
    if (!JSON_OUTPUT && render !== lastRender) {
      console.log(`\n${bold("Progress:")}`);
      console.log(render);
      lastRender = render;
    }
    if (["completed", "failed", "approved", "blocked", "cancelled"].includes(status.status)) {
      return status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new PollingTimeoutError(`Orchestration polling timed out after ${POLL_TIMEOUT_MS}ms`);
}

function renderOperationalSummary(result: LiveFlowResult): string {
  const outcome = result.outcome === "success"
    ? clr("green", "✓ READY FOR HUMAN REVIEW")
    : result.outcome === "needs-human"
      ? clr("yellow", "⚠ NEEDS HUMAN INPUT")
      : clr("red", "✗ FAILED");
  const lines = [
    `  Outcome:    ${outcome}`,
    `  Run:        ${result.runId}`,
    `  Status:     ${result.status}`,
    `  Readiness:  ${result.readiness ?? "not-applicable"}`,
    `  Steps:      ${result.completedSteps}/${result.totalSteps} completed, ${result.failedSteps} failed`,
    `  Validation: ${result.validationPassed === undefined ? "not-applicable" : result.validationPassed ? "passed" : "blocked"}`,
  ];
  if (result.checklist) {
    lines.push(
      `  QA:         ${result.checklist.complete ? "complete" : "incomplete"} ` +
      `(${result.checklist.pass} pass / ${result.checklist.fail} fail / ${result.checklist.total} total)`,
    );
  }
  for (const repair of result.repairs) {
    lines.push(
      `  ${repair.kind}: ${repair.attemptsUsed}/${repair.maxAttempts} attempts, ` +
      `${repair.exhausted ? "exhausted" : repair.resolved ? "resolved" : "unresolved"}`,
    );
  }
  if (result.blockers.length > 0) {
    lines.push("  Blockers:", ...result.blockers.map((blocker) => `    - ${blocker}`));
  }
  return lines.join("\n");
}

function exitWithError(message: string, exitCode: number): never {
  if (JSON_OUTPUT) {
    console.log(JSON.stringify({
      outcome: exitCode === LIVE_FLOW_EXIT_CODES.timeout ? "timeout" : "failed",
      exitCode,
      error: message,
    }, null, 2));
  } else {
    console.error(clr("red", `\n✗ ${message}`));
  }
  process.exit(exitCode);
}

async function main(): Promise<void> {
  if (!new Set(["text", "json"]).has(OUTPUT_FORMAT)) {
    exitWithError(`OUTPUT_FORMAT must be either text or json; received ${OUTPUT_FORMAT}.`, LIVE_FLOW_EXIT_CODES.failed);
  }
  if (!Number.isFinite(POLL_TIMEOUT_MS) || POLL_TIMEOUT_MS <= 0) {
    exitWithError("POLL_TIMEOUT_MS must be a positive number.", LIVE_FLOW_EXIT_CODES.failed);
  }
  const existingRunId = process.env.RUN_ID?.trim();
  if (!JSON_OUTPUT) console.log(bold("\n🧪 Multi-agent live smoke test\n"));

  // 1. Health check.
  let health: HealthStatus;
  try {
    health = await req<HealthStatus>("GET", "/health");
  } catch (error) {
    exitWithError(`Cannot reach API at ${API}: ${(error as Error).message}`, LIVE_FLOW_EXIT_CODES.failed);
  }

  if (!existingRunId && health.executorMode === "mock") {
    exitWithError(
      "/health reports executorMode=mock; restart with openai, anthropic, groq, or ollama.",
      LIVE_FLOW_EXIT_CODES.failed,
    );
  }

  if (!JSON_OUTPUT) console.log(
    `${clr("green", "✓")} API healthy — ${bold(health.executorMode.toUpperCase())} ` +
      `(${health.modelProfile}) ${health.executorModel}`,
  );

  // 2. Resolve skill + goal.
  const defaults = DEFAULT_GOALS[SKILL_ID];
  if (!existingRunId && !defaults) {
    exitWithError(
      `Unknown skill "${SKILL_ID}". Known skills: ${Object.keys(DEFAULT_GOALS).join(", ")}`,
      LIVE_FLOW_EXIT_CODES.failed,
    );
  }
  const goal = process.env.GOAL?.trim() || defaults?.goal;
  const context = process.env.CONTEXT?.trim() || defaults?.context;

  if (!JSON_OUTPUT && existingRunId) {
    console.log(`${clr("cyan", "→")} Inspecting existing orchestration: ${bold(existingRunId)}`);
  } else if (!JSON_OUTPUT) {
    console.log(`${clr("cyan", "→")} Skill:   ${bold(SKILL_ID)}`);
    console.log(`${clr("cyan", "→")} Goal:    ${goal}`);
    console.log(`${clr("cyan", "→")} Context: ${dim(context)}`);
  }

  // 3. Launch orchestration (background).
  const runId = existingRunId ?? (await req<StartResponse>(
    "POST",
    `/orchestrations/skills/${SKILL_ID}/run`,
    { goal, context },
  )).runId;
  if (!JSON_OUTPUT && !existingRunId) {
    console.log(`\n${clr("magenta", "★")} Orchestration started — runId=${bold(runId)}`);
    console.log(dim(`  Watch live in the UI: ${FED_URL}/runs`));
    console.log(dim(`  Pixel Office:         ${FED_URL}/office`));
  }

  // 4. Poll until done.
  const final = await pollUntilDone(runId);
  const parentRun = await req<Run>("GET", `/runs/${runId}`);
  const result = evaluateLiveFlow(final, parentRun);

  // 5. Summary.
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`\n${bold("Final state:")}`);
    console.log(renderProgress(final));
    console.log(`\n${renderOperationalSummary(result)}`);
    console.log(dim(`\n  Open ${FED_URL}/review to inspect each agent's response.`));
  }
  process.exitCode = result.exitCode;
}

main().catch((error) => {
  const exitCode = error instanceof PollingTimeoutError
    ? LIVE_FLOW_EXIT_CODES.timeout
    : LIVE_FLOW_EXIT_CODES.failed;
  exitWithError(`Smoke test crashed: ${(error as Error).message}`, exitCode);
});
