/**
 * Multi-agent live integration driver.
 *
 * Runs against the real API (http://localhost:4000) so every action is
 * visible in real time at http://localhost:5173/office.
 *
 * Usage:
 *   pnpm --filter @atellier/api exec tsx src/test/codex-live-flow.ts
 *
 * ⚠️  executorMode=openai: agent runs consume real tokens.
 *     Codex Worker steps use the fake executor (free).
 */

const API = "http://localhost:4000";

// Delays (ms) — tune to taste; longer = more time to watch the canvas
const D = { step: 1_200, phase: 2_000, post_agent: 800 };

// ─── ANSI colours ─────────────────────────────────────────────────────────
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m", white: "\x1b[37m",
};
const clr = (color: keyof typeof c, s: string) => `${c[color]}${s}${c.reset}`;
const bold = (s: string) => `${c.bold}${s}${c.reset}`;
const dim  = (s: string) => `${c.dim}${s}${c.reset}`;

// ─── Types ─────────────────────────────────────────────────────────────────
type Agent   = { id: string; name: string; role: string; status: string };
type Run     = { id: string; status: string; type: string };
type CodexView = {
  run: Run;
  goal: string;
  steps: Array<{ id: string; summary: string; status: string; needsApproval: boolean }>;
};
type WikiPage  = { content: string; ready: boolean };
type HealthStatus = { executorMode: string; executorModel: string; modelProfile: string };

// ─── HTTP helpers ──────────────────────────────────────────────────────────
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
const get  = <T>(p: string)              => req<T>("GET",  p);
const post = <T>(p: string, b?: unknown) => req<T>("POST", p, b);

// ─── Logger ────────────────────────────────────────────────────────────────
const startTime = Date.now();
function ts() { return dim(`+${((Date.now() - startTime) / 1000).toFixed(1)}s`); }
function log(tag: string, tagColor: keyof typeof c, msg: string) {
  console.log(`${ts()} ${clr(tagColor, tag.padEnd(18))} ${msg}`);
}
function phase(n: number, title: string) {
  console.log(`\n${bold(clr("cyan", `── PHASE ${n}: ${title} ──`))}`);
}

function wait(ms: number) { return new Promise((r) => setTimeout(r, ms)); }

// ─── Agent helpers ─────────────────────────────────────────────────────────
async function createAgent(name: string, role: string): Promise<Agent> {
  const agent = await post<Agent>("/agents", { name, role });
  log("create", "green", `${clr("white", name)} (${role}) → ${dim(agent.id)}`);
  return agent;
}

async function runAgent(
  agent: Agent,
  instruction: string,
  opts: { handoffAgentId?: string; handoffInstruction?: string; context?: string } = {},
): Promise<void> {
  log("run →", "blue", `${clr("white", agent.name)} — ${dim(instruction.slice(0, 70))}`);
  await post(`/agents/${agent.id}/run`, {
    instruction,
    context: opts.context ?? "Live multi-agent demo.",
    ...(opts.handoffAgentId ? {
      handoffAgentId: opts.handoffAgentId,
      handoffInstruction: opts.handoffInstruction,
    } : {}),
  });
  log("run ✓", "green", `${clr("white", agent.name)} completed`);
  await wait(D.post_agent);
}

// ─── Codex Worker helpers ──────────────────────────────────────────────────
async function runCodexWorker(goal: string): Promise<void> {
  log("codex", "magenta", `Creating run: "${goal}"`);
  const run = await post<Run>("/codex/runs", { goal, mode: "approved_step", profile: "standard" });
  log("codex", "magenta", `Run ${dim(run.id)} created`);
  await wait(D.step);

  log("codex", "magenta", "Planning steps…");
  await post(`/codex/runs/${run.id}/plan`);
  await wait(D.step);

  let iteration = 0;
  while (iteration < 12) {
    iteration++;
    const view = await get<CodexView>(`/codex/runs/${run.id}`);

    // Approve any protected steps waiting
    const toApprove = view.steps.filter((s) => s.needsApproval && s.status === "pending");
    for (const step of toApprove) {
      log("codex", "yellow", `Approving: "${step.summary}"`);
      await post(`/codex/runs/${run.id}/approve-step`, { stepId: step.id });
      await wait(D.step);
    }

    // Execute next available step
    const executable = view.steps.find(
      (s) => s.status === "approved" || (!s.needsApproval && s.status === "pending"),
    );
    if (executable) {
      log("codex", "magenta", `Executing: "${executable.summary}"`);
      await post(`/codex/runs/${run.id}/execute-next`);
      await wait(D.step);
      continue;
    }

    // All steps done?
    const allDone = view.steps.length > 0 && view.steps.every((s) => s.status === "completed");
    if (allDone) break;

    // Nothing to do yet — wait
    await wait(500);
  }

  log("codex", "magenta", "Finalizing…");
  await post(`/codex/runs/${run.id}/finalize`, {
    summary: "Codex Worker completed all steps. Live demo.",
    changedFiles: ["apps/api/src/routes/demo.routes.ts", "apps/web/src/features/demo/Demo.tsx"],
    testEvidence: ["pnpm test:api passed", "pnpm typecheck passed"],
  });
  log("codex ✓", "green", "Run finalized — sprite disappears from canvas");
}

// ─── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log(bold(`\n🏢 Atellier Multi-Agent Live Flow`));
  console.log(`   Watch: ${clr("cyan", "http://localhost:5173/office")}\n`);

  // ── PHASE 0: Preflight ──────────────────────────────────────────────────
  phase(0, "Preflight");
  const health = await get<HealthStatus>("/health");
  log("health ✓", "green", `executor=${clr("yellow", health.executorMode)} model=${clr("yellow", health.executorModel)}`);
  if (health.executorMode === "openai") {
    console.log(clr("yellow", `  ⚠️  OpenAI execution active — agent runs consume tokens.`));
  }
  await wait(D.phase);

  // ── PHASE 1: Assemble team ───────────────────────────────────────────────
  phase(1, "Assemble team (6 agents)");
  log("info", "dim", "Creating all agents in parallel…");
  const [intake, wikiCurator, pm, builder, qa, designer] = await Promise.all([
    createAgent("Ivan Intake",    "intake"),
    createAgent("Wiki Walter",    "wiki-curator"),
    createAgent("Pepe PM",        "pm"),
    createAgent("Bruno Builder",  "builder"),
    createAgent("Qara QA",        "qa"),
    createAgent("Diana Designer", "designer"),
  ]);
  log("team ✓", "green", `${6} agents online — watch the sprites populate the office`);
  await wait(D.phase);

  // ── PHASE 2: Seed context ───────────────────────────────────────────────
  phase(2, "Seed context (wiki + tasks, parallel)");
  await Promise.all([
    post("/wiki/ingest", {
      title: "Sprint goal: live dashboard",
      content: "Next steps: implement real-time agent dashboard with pixel office view. Add codex worker integration. Ensure all agents surface state in the pixel office canvas.",
      sourceType: "note",
    }).then(() => log("wiki ✓", "green", "Ingested sprint goal")),

    post("/wiki/ingest", {
      title: "Tech constraints",
      content: "Stack: React + Vite + Tailwind v4. API: Fastify + in-memory store. Agents must persist messages. Codex worker uses approved_step mode by default.",
      sourceType: "note",
    }).then(() => log("wiki ✓", "green", "Ingested tech constraints")),

    post("/tasks", { title: "Wire Codex Worker to Pixel Office",    priority: "high"   }).then(() => log("task ✓", "green", "Task 1 created")),
    post("/tasks", { title: "Add multi-agent handoff visualization", priority: "high"   }).then(() => log("task ✓", "green", "Task 2 created")),
    post("/tasks", { title: "Write Playwright E2E tests",            priority: "medium" }).then(() => log("task ✓", "green", "Task 3 created")),
  ]);
  await wait(D.phase);

  // ── PHASE 3: Codex Worker + Intake (concurrent) ─────────────────────────
  phase(3, "Codex Worker + Intake [CONCURRENT]");
  log("info", "cyan", "Both start simultaneously — watch 2 sprites activate at once");
  await wait(800);

  await Promise.all([
    runCodexWorker("Wire Codex Worker state to Pixel Office canvas"),
    runAgent(intake, "Summarize the sprint goal and tech constraints from the wiki. Identify the top 3 action items.", {
      context: "Sprint planning session. Keep it short.",
    }),
  ]);
  await wait(D.phase);

  // ── PHASE 4: PM → Builder chain (with handoff) ──────────────────────────
  phase(4, "PM → Builder handoff chain");
  log("info", "cyan", "PM plans, then auto-hands off to Builder — watch the connection line appear");
  await runAgent(pm, "Review pending tasks. Define the next implementation slice in 2 sentences.", {
    handoffAgentId: builder.id,
    handoffInstruction: "PM finished planning. Describe the implementation path for the pixel office integration in 2 sentences.",
    context: "Sprint cycle. Be concise.",
  });
  await wait(D.phase);

  // ── PHASE 5: Designer + QA (concurrent) ────────────────────────────────
  phase(5, "Designer + QA [CONCURRENT]");
  log("info", "cyan", "Both run simultaneously — watch two sprites at their work zones");
  await Promise.all([
    runAgent(designer, "Write a 2-sentence design brief for the pixel office agent status colors.", {
      context: "UI design sprint. Be concise.",
    }),
    runAgent(qa, "Review the builder output. Return APPROVED or a 1-sentence defect note.", {
      context: "QA cycle after builder handoff.",
    }),
  ]);
  await wait(D.phase);

  // ── PHASE 6: Wiki Curator sweep ─────────────────────────────────────────
  phase(6, "Wiki Curator final sweep");
  log("info", "cyan", "Walter consolidates all run memory into the wiki");
  await runAgent(wikiCurator, "Append a timestamped summary of this sprint session to the wiki log. Keep it under 3 sentences.", {
    context: "End of live demo session.",
  });
  await wait(D.phase);

  // ── PHASE 7: Verification ───────────────────────────────────────────────
  phase(7, "Verification");
  const [runs, wikiLog] = await Promise.all([
    get<Run[]>("/runs"),
    get<WikiPage>("/wiki/log"),
  ]);

  const completed  = runs.filter((r) => r.status === "completed").length;
  const agentRuns  = runs.filter((r) => r.type === "agent").length;
  const codexRuns  = runs.filter((r) => r.type === "build").length;

  log("runs ✓", "green",  `Total: ${bold(String(runs.length))}  completed: ${bold(String(completed))}  agent: ${agentRuns}  codex: ${codexRuns}`);
  log("wiki ✓", "green",  `Log has ${bold(String(wikiLog.content.split("\n").length))} lines`);

  const hasCodexEntry  = wikiLog.content.includes("Codex worker run finalized");
  const hasRunEntry    = wikiLog.content.includes("run_completed");
  log("events", hasCodexEntry ? "green" : "yellow", `codex finalize entry: ${hasCodexEntry ? "✓" : "✗"}`);
  log("events", hasRunEntry   ? "green" : "yellow", `agent run_completed entry: ${hasRunEntry ? "✓" : "✗"}`);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n${bold(clr("green", `✅ Flow complete in ${elapsed}s.`))} Check the wiki at ${clr("cyan", "http://localhost:5173")} → Wiki.\n`);
}

main().catch((err) => {
  console.error(`\n${clr("red", "❌ Flow failed:")}`, err instanceof Error ? err.message : err);
  process.exit(1);
});
