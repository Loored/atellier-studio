# Roadmap

**Last updated:** 2026-08-24 — Review-to-memory learning loop completed on `codex/review-memory-learning-loop`.
**Active plan:** Use the complete local workflow daily, resolve real curation signals, and collect evidence before selecting another feature slice.

## Strategic stance

Atellier is **the model of *your* work** — wiki, runs, tasks, deliverables, review — running on top of platform primitives (Claude / OpenAI executors, MCP, scheduled tasks). Not a competitor to Cowork. Not a SaaS. Personal and local-first.

## Completed foundation

- Local MongoDB
- Fastify API
- Agents, tasks, runs, run logs
- Skill-triggered orchestration runs (`atellier-build-loop`, `llm-wiki-ingest-loop`, `wiki-dream-loop`)
- Wiki Brain MVP routes (`/wiki/ingest`, `/wiki/query`, `/wiki/lint`, `/wiki/page`, `/wiki/append-log`)
- Deliverable generation, preview, promotion, unlink, review states
- Dashboard + 7 views
- Pixel office visualization layer
- Tailwind CSS v4 dashboard/shell migration
- Executor safety visibility (`/health` exposes `executorMode`, `executorModel`, `modelProfile`, and optional `executorRoleOverrides`)
- OpenAI cost-warning patterns across orchestration, runs, office live mode, codex worker
- Codex Worker control-plane v1 (create/plan/approve/execute/cancel/finalize, guardrails, durable finalize logs, web + API tests)
- Codex Worker evidence pass groundwork (commits 9adfcd8, 8d68eed)
- Durable Mongo-backed orchestration runtime (queued execution envelopes, leases, retries, cancellation, replayable events, separate worker, UI rehydration)

## Shipped 2026-05-10/11 — P1–P4 from the 2026-05-06 plan

All four post-keynote priorities landed on `feat/multi-provider-executors`. Tests: 71 api + 11 web. Validated live against Ollama (llama3.1:8b on M3 Pro): `atellier-build-loop` 7/7, `llm-wiki-ingest-loop` 5/5, `wiki-dream-loop` 4/4. Documented per area in `docs/mcp-server.md`, `docs/wiki-dream.md`, `docs/skills.md`.

- **P1 — MCP server wrapper.** New package `apps/mcp-server` exposes the Atellier REST API as an MCP server over stdio. 9 tools: `wiki_query`, `wiki_ingest`, `wiki_page_read`, `wiki_page_write`, `wiki_log_append`, `orchestration_skills_list`, `orchestration_run`, `orchestration_status`, `runs_list`. Wired for Claude Code / Cowork via `~/.claude.json`.
- **P2 — Wiki Dream loop.** New orchestration skill `wiki-dream-loop` (audit → propose-changes → draft-report → task-followup, all read-only at the LLM layer). Produces a *proposed* dream report; the operator persists it manually via `wiki_page_write`. No silent merges.
- **P3 — Multi-provider executors.** `OpenAiCompatibleAgentExecutorService` base + `OpenAi`, `Anthropic` (with `cache_control: ephemeral`), `Groq` (free cloud tier), `Ollama` (local, no key). Plus **P3.c** per-agent-role routing for Ollama via `OLLAMA_MODEL_<ROLE>` env vars (e.g. `qwen2.5-coder:7b` for `builder`, `llama3.1:8b` for the rest).
- **P4 — Skills 2.0 alignment.** Audit landed: the 8 skills in `.agents/skills/` already satisfy Skills 2.0 minimum (folder + `SKILL.md` with `name`/`description` frontmatter). No migration required; future enhancements (`allowed-tools`, `scripts/`, `references/`, `templates/`) noted in `docs/skills.md`.
- **P2.b — Wiki Dream grounding.** The `audit` step now receives backend-grounded context: `wiki.lint()` output and the current real markdown path list under `atelier/wiki`. Curator reports should use listed paths only and mark anything else as unverified.
- **P2.c — Wiki Dream UI surface.** Wiki panel now exposes `Dream now`, tracks the orchestration, previews the `draft-report` output, and saves approved reports under `wiki/dreams` via the safe write route.

## Completed 2026-05 — product-memory expansion

Ordered by leverage after the Wiki Dream validation runs and the 2026-05-12 Knowledge Graph product direction.

### P0 — Memory artifact hygiene ✅ shipped 2026-05-15

The working tree contains many generated run/deliverable artifacts from earlier validation. Curate which files are durable memory, which should be ignored/generated, and which belong in a later commit. Do this before another feature branch gets larger.

Policy started in [`docs/memory-artifact-hygiene.md`](memory-artifact-hygiene.md). UUID-prefixed generated deliverables are now ignored like ObjectId-prefixed generated deliverables.

### P1 — Knowledge Graph read model ✅ shipped 2026-05-12

Local read model derives nodes/edges from wiki, raw assets, runtime logs, agents/tasks/runs, deliverables, and lint issues. Computed from existing state — no external graph DB, no embeddings. See [`docs/knowledge-graph.md`](knowledge-graph.md).

### P2 — Knowledge Graph v2 ✅ shipped 2026-05-13

Force-directed live map with layer clustering, inspector with markdown render, ⌘K search, URL-synced filters, sesión viva polling, time-travel slider with snapshot ticks, run timeline, mobile tab, Office↔Graph navigation. Four PRs (#29 #30 #31 #32) landed on `dev/1.0.0`. 90 tests (72 api + 18 web). See `docs/knowledge-graph.md` for the full feature inventory.

### Knowledge Graph follow-ups ✅ shipped 2026-05-15

The post-v2 gaps were delivered together in PR #35:

- WebSocket live updates with polling fallback.
- Persisted graph annotations and filter presets.
- Snapshot diff view with node/edge deltas.
- Office sub-tabs for Office/Knowledge Graph context.
- Performance hardening for graphs above 300 nodes.
- Role-memory overlays, inspector context, and high-risk/pending-review focus filters.
- Annotation and deferred/rejected Dream decision signals in deterministic Wiki lint.

### P3 — Dream report review trail and graph curation ✅ shipped 2026-05-13

When the operator applies a proposed dream action, record whether the proposal was accepted, rejected, or deferred. This now ships end-to-end: decisions persist under `wiki/decisions`, update `wiki/log`, and appear in the graph as `dream-decision` nodes with `dream_decision_for_report` edges plus UI filters.

### P4 — Role memory ✅ shipped 2026-05-15

Give each agent role a curated memory surface derived from the graph: builder implementation patterns, QA blockers, wiki-curator maintenance themes, PM decisions, and recurring handoff/cohesion issues.

### P5 — Per-run executor override ✅ shipped 2026-05-13

Manual agent runs now support `executorModeOverride` with backend availability validation and a UI selector in the Office agent composer. Default env-driven behavior is unchanged.

### P5.b — Orchestration-level executor override

Extend the same override concept to orchestration start flows so multi-step skills can run under an explicitly selected mode per orchestration run.

Status: ✅ shipped 2026-05-13. Orchestration start now accepts `executorModeOverride` with backend availability validation and frontend selector support.

### P6 — Codex Worker Evidence Pass v1.1

Still useful, and it becomes more valuable once evidence can appear as graph nodes/edges. Persist richer per-step evidence metadata, render step + finalize evidence in the Codex Worker panel, strengthen finalize summary structure and counts, and keep the fake executor for now.

Status: ✅ shipped 2026-05-13. Step-level evidence now includes durations and artifact sizes; finalize evidence now includes failed/blocked counts, artifact totals, and total step duration, and the dashboard panel renders the enriched view.

### Later candidate — auto-persist toggle for the dream report

Optional env flag `WIKI_DREAM_AUTO_PERSIST=true` that saves the draft report to `wiki/dreams/<YYYY-MM-DD>-dream-report.md` automatically. Opt-in only — default stays manual to preserve the approval pattern.

## Now planning — after Durable Local Runtime v1

### P0 — Post-merge durability drill ✅ completed 2026-08-24

Validate the merged runtime against an isolated local Mongo database and a real local Ollama executor:

- queue work while the worker is offline
- start, stop, and restart the worker around active work
- verify lease reclaim and completed-step reuse
- verify ordered event replay, cancellation, manual retry, and UI rehydration after refresh
- record observed limitations before expanding execution authority

Result: offline queueing, restart/reclaim, completed-step reuse, ordered replay, cancellation, manual retry, and refresh-safe UI rehydration passed against isolated Mongo plus local Ollama. The drill also shipped two bounded fixes: retry access from Runs history and cleanup of interrupted child runs when a parent orchestration is reclaimed.

### P1 — Durable Runtime hardening v1.1

- ✅ Add Mongo integration coverage for multi-worker claim contention and expired-lease reclaim.
- ✅ Verify event sequence ordering and duplicate protection under concurrent claims.
- ✅ Add explicit worker lifecycle diagnostics and graceful shutdown behavior.
- ✅ Add provider abort support where available; keep cooperative step-boundary cancellation as the fallback.
- ✅ Require provider/tool idempotency keys before irreversible side effects are allowed.

### P2 — Controlled real Codex Worker adapter ✅ completed 2026-08-24

Replace the fake Codex Worker executor only behind an explicit feature flag and the existing approval flow:

- ✅ keep planning and protected-step approval visible to the operator
- ✅ constrain working directories and allowed commands
- ✅ capture diffs, stdout/stderr, tests, artifacts, and durations as review evidence
- ✅ keep real Codex/external calls out of automated tests
- ✅ never enable dangerous bypass flags

### P3 — Complete daily-use operational loop ✅ completed 2026-08-24

Exercise one repeatable reference workflow end to end:

```txt
source/input -> wiki -> task -> durable run -> deliverable/change -> QA -> review -> memory
```

The milestone is complete when an interrupted run can recover, the operator can review the evidence, and approved reusable knowledge reaches the Wiki/role-memory surfaces without relying on chat history.

Result: Wiki ingest now creates source-linked tasks; durable orchestrations retain and ground every step with that task; task status follows execution and review; Review shows the full chain; and approved memory capture is persisted and idempotent. See [`docs/daily-use-operational-loop.md`](daily-use-operational-loop.md).

### P4 — Review-to-memory learning loop ✅ completed 2026-08-24

Make approved review outcomes feed curated role memory and contradiction/staleness signals. Keep writes inspectable and approval-driven; do not introduce silent autonomous edits.

Result: completed and approved runs with captured memory can promote one explicit lesson into durable `wiki/role-memory/<role>.md`. Optional contradiction, stale, and needs-review signals surface through Wiki lint and Knowledge Graph without changing the target page. Exact retries are idempotent and conflicting replacements are rejected. See [`docs/review-memory-learning-loop.md`](review-memory-learning-loop.md).

### P4.b — Curation signal resolution ✅ completed 2026-08-24

Close the feedback loop without deleting history or silently editing the signaled page.

Result: Review now resolves or dismisses an open learning signal with a required operator note. The decision is appended to role-memory Markdown, persisted on the run, logged in the Wiki, removed from active lint, and reflected in total/open/resolved role statistics. Exact retries are idempotent and conflicting replacements fail closed.

### P4.c — Local Dev Launcher v1 ✅ completed 2026-08-25

Resolve the repeated startup friction without introducing broader infrastructure. `./scripts/dev-local` now validates Node, pinned pnpm access, dependencies, ports, Docker/Compose, and Mongo; starts API, durable worker, and web on deterministic loopback URLs; waits for health; and shuts down only its own processes. It does not install packages, kill port owners, stop Mongo, or enable cloud/runtime authority.

### P4.d — Knowledge deliverable grounding ✅ completed 2026-08-25

The first real source-to-memory soak exposed path-only grounding, a code-shaped Runtime validator, duplicated Review alerts, and approval without the requested plan. Linked source contents are now loaded under bounded read-only context, vault paths participate in verification, Build/Fix and Runtime use step-specific contracts, the parent run persists a requested artifact plus final readiness evidence, and Review deduplicates aggregate validation. Live Ollama evidence then added deterministic N-day completeness checks, Markdown-safe artifact/verdict parsing, validation feedback propagation, and a 120-second local execution default.

### P4.e — Autonomous Repair Loop v1 ✅ completed 2026-08-25

Deterministic artifact failures now trigger up to three automatic Builder correction attempts before Runtime and QA. Every attempt has a stable persisted step ID, receives exact validation feedback, appears in orchestration status, and is reused during durable recovery. A passing artifact continues to final QA; exhaustion stops downstream work and records `readiness: needs-human` with concrete blockers. Human approval and memory capture remain explicit.

### Next — Daily-use soak and learning feedback

- Soak the bounded repair loop against the local Mongo worker and real Ollama artifacts; record which deterministic blocker classes are actually repairable.
- Evaluate a later semantic QA-to-repair loop only after repeated evidence; do not turn free-form QA findings into unbounded retries.
- Resolve captured curation signals explicitly from Review and verify the target-page decision remains useful over time.
- Record repeated friction and only then select the next bounded feature slice.
- ✅ Persist acceptance-criteria QA checklists, stop materially repeated feedback, and reject duplicate local workers before launch.
- ✅ Make the real smoke runner fail closed on parent validation/readiness and expose stable text/JSON outcomes.

## Later — Tailwind / Pixel polish

- `MobileView.tsx` Tailwind migration only when a real feature needs the mobile surface
- Pixel Office expansion is **not** a priority. Pixel Agents (VS Code extension by Pablo Deuca) shipped a pure-visualization version of the same idea — we already have the visual layer; double down on the work model instead.

## Explicitly NOT now

- Managed Agents Dreaming (research preview, gated — build local Dream first)
- Computer Use, Batch API, Citations API, Files API
- A separate desktop app (Cowork *is* the desktop)
- Auth, multi-user, SaaS, cloud deploy
- Creative connectors (Ableton, Blender, etc.)
- M365 add-ins, financial templates, health integrations
- Broad autonomy without approvals
