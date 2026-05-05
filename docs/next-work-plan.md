# Next Work Plan

This plan combines `docs/current-state-and-next-steps.md`, Claude's Tailwind handoff, and the Karpathy agentic-system synthesis from `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.

## Decision

Keep moving Atellier toward a private operating system for memory, execution, review, and deliverables.

The next cycle should not be another visual pass. The pixel office and Tailwind migration are useful, but the highest leverage work is making agent execution safer, more inspectable, and more wiki-native.

## Priority 1 - Executor And Model Safety Visibility

Why now:

- Current runtime can execute real OpenAI-backed runs.
- The user has already seen quota/cost risk.
- Karpathy-style autonomy needs explicit permissions and a visible autonomy slider.

Target outcome:

- `/health` exposes executor mode, model, and ideally model profile.
- UI shows executor mode/model before the operator starts runs.
- Real OpenAI mode has a clear warning.
- Mock mode remains easy to enable.
- Model profile language is explicit: `cheap`, `standard`, `deep`.

Good first slice:

- Add health response fields if missing.
- Add a compact dashboard/office badge for mode and model.
- Add tests for API health and UI rendering.

## Priority 2 - Wiki Brain MVP

Why now:

- The LLM Wiki principle is documented, but not yet first-class as product behavior.
- The source/input -> wiki update -> task loop should become operational, not only a convention.

Target outcome:

- `POST /wiki/ingest`
- `POST /wiki/query`
- `POST /wiki/lint`

Initial implementation can be deterministic and non-LLM.

Required behavior:

- preserve raw source references
- create/update source summaries
- update index and log
- detect simple contradictions or stale links
- propose tasks when source material implies work
- keep outputs in Markdown, not only MongoDB

## Priority 3 - Codex Worker Design Doc

Why now:

- Atellier has Codex rules and skills, but no controlled in-app Codex Worker.
- Building it without a design pass would risk unsafe command execution and vague permissions.

Create:

- `docs/codex-worker.md` or similar design doc

Cover:

- command execution model
- sandbox and approval policy
- model profiles
- logging into runs
- human review before risky changes
- test doubles and no real Codex calls in tests
- UI controls for approval, cancel, retry, inspect logs

## Priority 4 - Orchestration Reliability

Why now:

- Skill orchestration exists and should stay readable as workflows grow.
- Hard-coded templates are fine for MVP but should not become a large service tangle.

Target outcome:

- Keep orchestration templates small and explicit.
- Move templates to their own module only when adding more workflows.
- Link parent orchestration runs to child runs in UI when useful.

## Priority 5 - Tailwind Remainder Only When It Unblocks Work

Claude's Tailwind migration is mostly successful, but the remaining legacy CSS is not the next product bottleneck.

Deferred:

- `OfficeView.tsx`
- `AgentDetailPanel.tsx`
- `MobileView.tsx`

Touch these when:

- a real feature needs those surfaces
- CSS drift blocks maintainability
- tests or layout regressions appear

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
Add executor/model safety visibility before expanding agent autonomy.

Tasks:
1. Verify /health exposes executor mode and model; add fields if missing.
2. Add a visible UI badge for executor mode and model.
3. Add clear warning copy or state when OpenAI-backed execution is active.
4. Keep mock mode easy to identify and use.
5. Add focused API/web tests for the changed behavior.

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
