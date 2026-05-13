# Roadmap

**Last updated:** 2026-05-12 — Knowledge Graph direction added.
**Active plan:** [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md) (P1–P4 complete; current candidates under "Now planning" below).

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

## Shipped 2026-05-10/11 — P1–P4 from the 2026-05-06 plan

All four post-keynote priorities landed on `feat/multi-provider-executors`. Tests: 71 api + 11 web. Validated live against Ollama (llama3.1:8b on M3 Pro): `atellier-build-loop` 7/7, `llm-wiki-ingest-loop` 5/5, `wiki-dream-loop` 4/4. Documented per area in `docs/mcp-server.md`, `docs/wiki-dream.md`, `docs/skills.md`.

- **P1 — MCP server wrapper.** New package `apps/mcp-server` exposes the Atellier REST API as an MCP server over stdio. 9 tools: `wiki_query`, `wiki_ingest`, `wiki_page_read`, `wiki_page_write`, `wiki_log_append`, `orchestration_skills_list`, `orchestration_run`, `orchestration_status`, `runs_list`. Wired for Claude Code / Cowork via `~/.claude.json`.
- **P2 — Wiki Dream loop.** New orchestration skill `wiki-dream-loop` (audit → propose-changes → draft-report → task-followup, all read-only at the LLM layer). Produces a *proposed* dream report; the operator persists it manually via `wiki_page_write`. No silent merges.
- **P3 — Multi-provider executors.** `OpenAiCompatibleAgentExecutorService` base + `OpenAi`, `Anthropic` (with `cache_control: ephemeral`), `Groq` (free cloud tier), `Ollama` (local, no key). Plus **P3.c** per-agent-role routing for Ollama via `OLLAMA_MODEL_<ROLE>` env vars (e.g. `qwen2.5-coder:7b` for `builder`, `llama3.1:8b` for the rest).
- **P4 — Skills 2.0 alignment.** Audit landed: the 8 skills in `.agents/skills/` already satisfy Skills 2.0 minimum (folder + `SKILL.md` with `name`/`description` frontmatter). No migration required; future enhancements (`allowed-tools`, `scripts/`, `references/`, `templates/`) noted in `docs/skills.md`.
- **P2.b — Wiki Dream grounding.** The `audit` step now receives backend-grounded context: `wiki.lint()` output and the current real markdown path list under `atelier/wiki`. Curator reports should use listed paths only and mark anything else as unverified.
- **P2.c — Wiki Dream UI surface.** Wiki panel now exposes `Dream now`, tracks the orchestration, previews the `draft-report` output, and saves approved reports under `wiki/dreams` via the safe write route.

## Now planning — next iteration sequence

Ordered by leverage after the Wiki Dream validation runs and the 2026-05-12 Knowledge Graph product direction.

### P0 — Memory artifact hygiene

The working tree contains many generated run/deliverable artifacts from earlier validation. Curate which files are durable memory, which should be ignored/generated, and which belong in a later commit. Do this before another feature branch gets larger.

Policy started in [`docs/memory-artifact-hygiene.md`](memory-artifact-hygiene.md). UUID-prefixed generated deliverables are now ignored like ObjectId-prefixed generated deliverables.

### P1 — Knowledge Graph read model ✅ first slice landed 2026-05-12

Add a local read model that derives nodes and edges from the existing Atellier spine: wiki pages, sources, tasks, agents, roles, runs, deliverables, reviews, decisions, contradictions, dream reports, and synthesis pages. This should be computed from existing local state first, not backed by a new external graph database.

See [`docs/knowledge-graph.md`](knowledge-graph.md) for the first design note.

### P2 — Graph View MVP ✅ first slice landed 2026-05-12

Add a new app page for visualizing the woven knowledge network that agents are building. The initial view should show the graph as operational memory, not decoration: filters by agent, role, node type, status, review state, recency, and knowledge quality.

Next graph work: browser screenshot review, better layout against real local data, richer wiki link extraction, and dream proposal decision nodes.

### P3 — Dream report review trail and graph curation

When the operator applies a proposed dream action, record whether the proposal was accepted, rejected, or deferred. Use those decisions to improve the graph: link orphan pages, flag contradictions, identify stale nodes, and create follow-up tasks.

### P4 — Role memory

Give each agent role a curated memory surface derived from the graph: builder implementation patterns, QA blockers, wiki-curator maintenance themes, PM decisions, and recurring handoff/cohesion issues.

### P5 — Per-run executor override

Today the executor is env-only; switching requires restarting the API. A Settings UI toggle (and a per-run override on orchestration start) was deferred in the original plan. Worth revisiting now that 4 providers exist.

### P6 — Codex Worker Evidence Pass v1.1

Still useful, and it becomes more valuable once evidence can appear as graph nodes/edges. Persist richer per-step evidence metadata, render step + finalize evidence in the Codex Worker panel, strengthen finalize summary structure and counts, and keep the fake executor for now.

### Later candidate — auto-persist toggle for the dream report

Optional env flag `WIKI_DREAM_AUTO_PERSIST=true` that saves the draft report to `wiki/dreams/<YYYY-MM-DD>-dream-report.md` automatically. Opt-in only — default stays manual to preserve the approval pattern.

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
