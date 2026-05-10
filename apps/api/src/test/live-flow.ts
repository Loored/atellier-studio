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
 *   GOAL="..."                         # custom orchestration goal
 *   CONTEXT="..."                      # custom orchestration context
 *   POLL_TIMEOUT_MS=180000             # how long to wait before giving up
 *
 * ⚠️  Real LLM calls cost real money on hosted providers (OpenAI, Anthropic).
 *     Groq has a free tier and Ollama is fully local — both are good defaults
 *     for repeated smoke testing.
 */

const API = process.env.API_URL ?? "http://127.0.0.1:4000";
const SKILL_ID = process.env.SKILL ?? "atellier-build-loop";
const POLL_TIMEOUT_MS = Number(process.env.POLL_TIMEOUT_MS ?? 180_000);
const POLL_INTERVAL_MS = 2_000;
const FED_URL = process.env.FED_URL ?? "http://127.0.0.1:5173";

const DEFAULT_GOALS: Record<string, { goal: string; context: string }> = {
  "atellier-build-loop": {
    goal:
      "Add a /health endpoint badge that reports the current executor model. " +
      "Keep the change minimal: a tiny React component reading from useHealthApi, " +
      "rendered in the existing app header. No new dependencies.",
    context:
      "Atellier Studio monorepo. Frontend uses React 19 + TanStack Query. " +
      "useHealthApi returns { executorMode, executorModel, modelProfile }. " +
      "The header lives in apps/web/src/app/AppShell.tsx.",
  },
  "llm-wiki-ingest-loop": {
    goal:
      "Ingest this short note into the wiki: 'Anthropic Code with Claude 2026 " +
      "keynote introduced Opus 4.7 with prompt caching and Skills 2.0. " +
      "Atellier should expose itself as MCP server.'",
    context: "Source: developer-notes/keynote-2026-05-06.md (paraphrased).",
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

type StepStatus = {
  stepId: string;
  label: string;
  phase: string;
  agentName: string;
  agentRole: string;
  agentId?: string;
  runId?: string;
  status: "pending" | "running" | "completed" | "failed";
  isActive: boolean;
};

type OrchestrationStatus = {
  orchestrationRunId: string;
  skillId: string;
  goal: string;
  status: string;
  steps: StepStatus[];
  activeStep: StepStatus | null;
  nextStep: StepStatus | null;
};

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

function statusGlyph(status: StepStatus["status"]): string {
  switch (status) {
    case "pending": return clr("dim", "·");
    case "running": return clr("yellow", "▶");
    case "completed": return clr("green", "✓");
    case "failed": return clr("red", "✗");
  }
}

function renderProgress(status: OrchestrationStatus): string {
  return status.steps
    .map((step) => {
      const glyph = statusGlyph(step.status);
      return `  ${glyph} ${dim(`[${step.phase}]`)} ${bold(step.agentName)} — ${step.label}`;
    })
    .join("\n");
}

async function pollUntilDone(runId: string): Promise<OrchestrationStatus> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let lastRender = "";

  while (Date.now() < deadline) {
    const status = await req<OrchestrationStatus>("GET", `/orchestrations/${runId}/status`);
    const render = renderProgress(status);
    if (render !== lastRender) {
      console.log(`\n${bold("Progress:")}`);
      console.log(render);
      lastRender = render;
    }
    if (status.status === "completed" || status.status === "failed" || status.status === "approved") {
      return status;
    }
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  throw new Error(`Orchestration polling timed out after ${POLL_TIMEOUT_MS}ms`);
}

async function main(): Promise<void> {
  console.log(bold("\n🧪 Multi-agent live smoke test\n"));

  // 1. Health check.
  let health: HealthStatus;
  try {
    health = await req<HealthStatus>("GET", "/health");
  } catch (error) {
    console.error(clr("red", `✗ Cannot reach API at ${API}.`));
    console.error(`  ${(error as Error).message}`);
    console.error(dim("\n  Hint: start the backend, e.g."));
    console.error(dim("    AGENT_EXECUTOR_MODE=groq GROQ_API_KEY=gsk_... \\"));
    console.error(dim("    pnpm --filter @atellier/api dev:memory\n"));
    process.exit(1);
  }

  if (health.executorMode === "mock") {
    console.error(
      clr("red", `✗ /health reports executorMode=mock — this script needs a real executor.`),
    );
    console.error(
      dim("  Restart the API with one of: openai, anthropic, groq, ollama."),
    );
    console.error(dim("  Free options:"));
    console.error(dim("    - groq (free cloud tier):  AGENT_EXECUTOR_MODE=groq GROQ_API_KEY=..."));
    console.error(dim("    - ollama (local, free):    AGENT_EXECUTOR_MODE=ollama OLLAMA_MODEL=llama3.2"));
    process.exit(1);
  }

  console.log(
    `${clr("green", "✓")} API healthy — ${bold(health.executorMode.toUpperCase())} ` +
      `(${health.modelProfile}) ${health.executorModel}`,
  );

  // 2. Resolve skill + goal.
  const defaults = DEFAULT_GOALS[SKILL_ID];
  if (!defaults) {
    console.error(clr("red", `✗ Unknown skill "${SKILL_ID}".`));
    console.error(`  Known skills: ${Object.keys(DEFAULT_GOALS).join(", ")}`);
    process.exit(1);
  }
  const goal = process.env.GOAL?.trim() || defaults.goal;
  const context = process.env.CONTEXT?.trim() || defaults.context;

  console.log(`${clr("cyan", "→")} Skill:   ${bold(SKILL_ID)}`);
  console.log(`${clr("cyan", "→")} Goal:    ${goal}`);
  console.log(`${clr("cyan", "→")} Context: ${dim(context)}`);

  // 3. Launch orchestration (background).
  const start = await req<StartResponse>("POST", `/orchestrations/skills/${SKILL_ID}/run`, {
    goal,
    context,
  });
  console.log(`\n${clr("magenta", "★")} Orchestration started — runId=${bold(start.runId)}`);
  console.log(dim(`  Watch live in the UI: ${FED_URL}/runs`));
  console.log(dim(`  Pixel Office:         ${FED_URL}/office`));

  // 4. Poll until done.
  const final = await pollUntilDone(start.runId);

  // 5. Summary.
  console.log(`\n${bold("Final state:")}`);
  console.log(renderProgress(final));

  const completed = final.steps.filter((s) => s.status === "completed").length;
  const failed = final.steps.filter((s) => s.status === "failed").length;

  if (final.status === "completed" || final.status === "approved") {
    console.log(
      `\n${clr("green", "✓ Orchestration finished.")} ` +
        `${completed}/${final.steps.length} steps OK ` +
        dim(`(run status: ${final.status})`),
    );
    console.log(dim(`  Open ${FED_URL}/review to inspect each agent's response.`));
  } else {
    console.log(
      `\n${clr("red", "✗ Orchestration ended in non-success state:")} ${final.status} ` +
        `(${completed} ok / ${failed} failed)`,
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(clr("red", `\n✗ Smoke test crashed: ${(error as Error).message}`));
  process.exit(1);
});

export {};
