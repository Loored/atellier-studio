# Next Work Plan

This plan combines `docs/current-state-and-next-steps.md`, Claude's Tailwind handoff, and the Karpathy agentic-system synthesis from `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.

## Decision

Keep moving Atellier toward a private operating system for memory, execution, review, and deliverables.

The next cycle should not be another visual pass. The pixel office and Tailwind migration are useful, but the highest leverage work is making agent execution safer, more inspectable, and more wiki-native.

## Status Snapshot (2026-05-10)

Done up to this snapshot:

- Executor safety visibility across app shell and execution surfaces; `/health` exposes `executorMode`, `executorModel`, `modelProfile`.
- OpenAI confirmation/warning states for orchestration, manual runs, office live mode, and codex worker run creation.
- Wiki Brain MVP routes implemented and tested: `POST /wiki/ingest`, `POST /wiki/query`, `POST /wiki/lint`.
- Wiki query results surface related pages and possible contradictions.
- Safe wiki page write/update route: `POST /wiki/page`. Non-deliverable pages auto-upsert into `wiki/index.md`.
- `docs/codex-worker.md` exists and Codex Worker control-plane v1 is implemented with create / plan / approve-step / execute-next / cancel / retry-step / finalize, transition guardrails, durable finalize run log + wiki event, and full web + API coverage.
- Codex Worker evidence pass v1.1: per-step evidence (stdout/stderr paths, command, working directory, notes, artifacts) persisted on completed steps and rendered in the panel; finalize logs include per-step evidence and changed-file/test-evidence counts.
- Agent grounding validation v1.2: builder/QA outputs validated against verified repo files; review approval blocked on critical validation errors.
- Review memory capture lands: `POST /runs/:id/capture-memory` writes a `wiki/synthesis/` page; frontend chain `runs.service -> useRunsApi -> useRunsTimeline -> ReviewView` is wired.
- API test coverage expanded to 55 tests covering task/agent/run lifecycle, SSE typed events, both orchestration skill templates, codex worker approve guards, role-specific agent outputs, 404 guards, and same-agent handoff skip.

Active branch `feat/codex-worker-evidence-pass` is 4 commits ahead of `main` and ready for merge.

## Priority 1 - Review Queue Triage UI

Why now:

- The capture-memory API and frontend chain exist, but `ReviewView` does not yet make captured-memory state visible per run, and pending runs accumulate without grouping.
- Operator trust depends on quick evidence scanning, clear capture state, and review outcomes that surface validation blockers up front.

Target outcome:

- `ReviewView` groups runs by `pending / approved / changes-requested` with counts and filters.
- After a run is captured, its `wiki/synthesis/` path is surfaced inline so it is discoverable without leaving the review surface.
- Validation blockers and missing evidence are visible before approval; approval stays blocked until errors are cleared.

Scope:

- keep capture paths constrained to `wiki/synthesis/` (already enforced server-side)
- preserve the frontend API chain: service -> API hook -> feature hook -> visual component
- add focused web tests for grouping, capture-state rendering, and validation-blocked approvals

## Priority 2 - Codex Worker v1.2

Why now:

- Control-plane and evidence v1.1 are in place; review-memory capture is wired.
- Before integrating a real Codex CLI adapter, per-step evidence and approval audit metadata must be stronger so that human review can trust automated runs.

Target outcome:

- explicit command envelopes (command + args + working directory + risk level + expected signals)
- approval audit metadata across step transitions (who/when/why approved, retry history)
- richer changed-file and test evidence per step
- still no real Codex calls in tests

## Priority 3 - Wiki Brain v2 polish

Why now:

- Ingest/query/lint, safe writes, and review memory capture are working.
- The next gap is the quality and reusability of captured pages: templates, cross-links, and contradiction handling.

Target outcome:

- richer synthesis page templates (decision, retro, deliverable handoff)
- deterministic cross-linking from synthesis pages back to source/index
- contradiction notes flagged at capture time, not only at lint time

## Priority 4 - Orchestration Reliability

Why now:

- Skill orchestration exists and should stay readable as workflows grow.
- Hard-coded templates are fine for MVP but should not become a large service tangle.

Target outcome:

- Keep orchestration templates small and explicit.
- Move templates to their own module only when adding more workflows.
- Link parent orchestration runs to child runs in UI when useful.

## Priority 5 - Tailwind Remainder Only When It Unblocks Work

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
Surface review queue triage and captured-memory state in ReviewView.

Tasks:
1. Group runs in ReviewView by pending / approved / changes-requested, with counts and a search/filter affordance.
2. After a run is captured to wiki/synthesis/, show the captured page path inline on the run card so it is discoverable without leaving review.
3. Make validation blockers and missing evidence visible up front; keep approval blocked while critical validation errors remain.
4. Add focused web tests for grouping, capture-state rendering, and validation-blocked approval interactions.

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
