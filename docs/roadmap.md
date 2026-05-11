# Roadmap

**Last updated:** 2026-05-11 — P1–P4 from the 2026-05-06 plan landed.
**Active plan:** [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md) (P1–P4 marked complete; new candidates under "Now planning" below).

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

## Now planning — candidates for the next iteration

Ordered by leverage based on what the validation runs uncovered.

### P2.b — Wiki Dream grounding (recommended next)

The live smoke test showed `wiki-dream-loop` running clean but the Wiki Curator (llama3.1:8b) alucinating page paths because the skill does not pre-load real wiki state into the prompt. Pre-load `POST /wiki/lint` output and a fresh listing of `atelier/wiki/*` paths into the `audit` step's context. Skill structure stays unchanged; only the orchestration call site grows.

### P2.c — UI surface for the Wiki Dream

- "Dream now" button in the Wiki view that fires `orchestration_run skillId: wiki-dream-loop`.
- Inline preview of the latest dream report, with a one-click "save as wiki page" action that calls `POST /wiki/page` using the suggested filename.
- Keeps the no-silent-merges invariant — the click *is* the explicit approval.

### Open question #1 from the plan — per-run executor override in Settings

Today the executor is env-only; switching requires restarting the API. A Settings UI toggle (and a per-run override on orchestration start) was deferred in the original plan. Worth revisiting now that 4 providers exist.

### Auto-persist toggle for the dream report

Optional env flag `WIKI_DREAM_AUTO_PERSIST=true` that saves the draft report to `wiki/dreams/<YYYY-MM-DD>-dream-report.md` automatically. Opt-in only — default stays manual to preserve the approval pattern.

## Next 5 — Codex Worker Evidence Pass v1.1 (deferred from the previous plan)

- Persist richer per-step evidence metadata in run output
- Render step + finalize evidence in the Codex Worker panel
- Strengthen finalize summary structure and counts
- Keep fake executor; no real Codex CLI integration yet

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
