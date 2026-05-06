# Next Work Plan

This plan combines `docs/current-state-and-next-steps.md`, Claude's Tailwind handoff, and the Karpathy agentic-system synthesis from `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.

## Decision

Keep moving Atellier toward a private operating system for memory, execution, review, and deliverables.

The next cycle should not be another visual pass. The pixel office and Tailwind migration are useful, but the highest leverage work is making agent execution safer, more inspectable, and more wiki-native.

## Status Snapshot (2026-05-06)

Done in this cycle:

- Executor safety visibility is now in place across app shell and execution surfaces.
- `/health` now exposes `executorMode`, `executorModel`, and `modelProfile`.
- OpenAI confirmation/warning states exist for orchestration, runs, office live mode, and codex worker run creation.
- Wiki Brain MVP routes are implemented and tested:
  - `POST /wiki/ingest`
  - `POST /wiki/query`
  - `POST /wiki/lint`
- Safe wiki page write/update route is now merged and available:
  - `POST /wiki/page`
- `docs/codex-worker.md` exists and Codex Worker control-plane v1 is implemented with:
  - create / plan / approve-step / execute-next / cancel / finalize
  - guardrails for invalid transitions
  - durable finalize run log + wiki event
  - web + API coverage

## Priority 1 - Codex Worker Evidence Pass (v1.1)

Why now:

- Control-plane safety exists, but operator confidence depends on better execution evidence.
- This is the shortest path to a usable private operating system loop before real command adapters.

Target outcome:

- Per-step evidence is inspectable, not only step status.
- Finalize includes stronger review payload before close.
- UI makes approval and unresolved states obvious without reading logs manually.

Scope:

- persist richer step evidence metadata in codex worker run output
- expose per-step evidence in codex worker panel
- strengthen finalize summary/evidence structure and counts
- keep fake executor; no real Codex CLI integration yet

## Priority 2 - Wiki Brain v2 (Write Path Safety + Reuse)

Why now:

- Ingest/query/lint are done, but writeback and reuse loops are still thin.
- This is where memory quality starts compounding over time.

Target outcome:

- safe wiki page write/update route with path controls
- stronger contradiction/stale-link reporting workflow
- query results can be promoted into reusable wiki notes intentionally

## Priority 3 - Orchestration Reliability

Why now:

- Skill orchestration exists and should stay readable as workflows grow.
- Hard-coded templates are fine for MVP but should not become a large service tangle.

Target outcome:

- Keep orchestration templates small and explicit.
- Move templates to their own module only when adding more workflows.
- Link parent orchestration runs to child runs in UI when useful.

## Priority 4 - Tailwind Remainder Only When It Unblocks Work

**Status: mostly done (2026-05-05)**

- ✅ `OfficeView.tsx` — rebuilt with Tailwind in 2026-05-05 redesign session.
- ✅ `AgentDetailPanel.tsx` — superseded by `AgentSidePanel.tsx` (Tailwind).
- ⏳ `MobileView.tsx` — still deferred, not blocking anything.

Touch `MobileView.tsx` when:

- a real feature needs the mobile surface
- CSS drift blocks maintainability
- layout regressions appear

## Not Now

- MCP
- auth
- cloud deploy
- multiplayer
- more pixel polish
- broad autonomy without approvals

## Practical Next Prompt

```txt
Read AGENTS.md, CODEX_MEMORY.md, docs/current-state-and-next-steps.md, and docs/next-work-plan.md.

Goal:
Finish Codex Worker evidence pass v1.1.

Tasks:
1. Persist richer per-step evidence metadata in Codex Worker run output.
2. Render step evidence and finalize evidence in the Codex Worker panel.
3. Keep transition guardrails and finalize checks strict.
4. Add focused API/web tests for evidence rendering and finalize payload behavior.

Do not:
- add MCP
- add auth/cloud/multiplayer
- polish pixel UI
- call real OpenAI/Codex in tests
- use dangerous Codex flags

Run:
- pnpm typecheck
- pnpm test:api if API changed
- pnpm test:web if web changed
```
