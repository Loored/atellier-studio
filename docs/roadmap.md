# Roadmap

**Last updated:** 2026-05-06 — realigned after the *Code with Claude 2026* keynote.
**Active plan:** [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md)

## Strategic stance

Atellier is **the model of *your* work** — wiki, runs, tasks, deliverables, review — running on top of platform primitives (Claude / OpenAI executors, MCP, scheduled tasks). Not a competitor to Cowork. Not a SaaS. Personal and local-first.

## Completed foundation

- Local MongoDB
- Fastify API
- Agents, tasks, runs, run logs
- Skill-triggered orchestration runs (`atellier-build-loop`, `llm-wiki-ingest-loop`)
- Wiki Brain MVP routes (`/wiki/ingest`, `/wiki/query`, `/wiki/lint`, `/wiki/page`)
- Deliverable generation, preview, promotion, unlink, review states
- Dashboard + 7 views
- Pixel office visualization layer
- Tailwind CSS v4 dashboard/shell migration
- Executor safety visibility (`/health` exposes `executorMode`, `executorModel`, `modelProfile`; UI badge)
- OpenAI cost-warning patterns across orchestration, runs, office live mode, codex worker
- Codex Worker control-plane v1 (create/plan/approve/execute/cancel/finalize, guardrails, durable finalize logs, web + API tests)
- Codex Worker evidence pass groundwork (commits 9adfcd8, 8d68eed)

## Next 1 — MCP server wrapper over the REST API

**Why:** Cowork is the desktop client we no longer have to build. Wrapping the existing REST API as an MCP server makes Atellier callable as a tool from Cowork *and* Claude Code.

- Expose `wiki/query`, `wiki/ingest`, `wiki/page`, `orchestrations/skills/:id/run`, `runs/list`, `runs/get`
- Local-only auth (loopback / token in env)
- Document install + Cowork connection in `docs/mcp-server.md`
- Out of scope: remote hosting, rate limiting

## Next 2 — Wiki Dream loop

**Why:** Auto Dream in Claude Code validates the pattern. Atellier's wiki is structured (sources, notes, contradictions, links), so a Dream loop tailored to that structure compounds memory in a way flat-file Auto Dream can't.

- Scheduled `wiki-curator` run via scheduled tasks: prune stale, resolve contradictions (via existing `/wiki/lint`), link orphans, reorganize index
- Output: a "dream report" wiki entry per run for operator audit
- Manual trigger button in Wiki view
- v1 produces *proposed* changes that the operator approves — no silent rewrites

## Next 3 — Anthropic executor mode

**Why:** Today the executor supports `mock` and `openai`. Adding `anthropic` gives Opus 4.7, native prompt caching (significant cost reduction), and avoids vendor lock-in.

- New executor class alongside existing OpenAI executor
- New env: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` (default `claude-opus-4-7`), `ANTHROPIC_MODEL_PROFILE`
- `/health` exposes mode + model for the new path
- Reuse existing OpenAI cost-warning pattern
- Default executor stays `mock`. Switching is env-only in v1; per-run override deferred.

## Next 4 — Skills 2.0 alignment

**Why:** Anthropic's Skills 2.0 (scripts + templates + reference materials) is close to where `.agents/skills/` was heading. Aligning early avoids divergence.

- Audit `.agents/skills/` against Skills 2.0 schema
- Migrate `atellier-build-loop` and `llm-wiki-ingest-loop` to the new format if compatible
- Document the format in `docs/skills.md`

## Next 5 — Codex Worker Evidence Pass v1.1 (deferred from previous P1)

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
