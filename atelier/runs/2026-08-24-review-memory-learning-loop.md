# Run Log - Review-to-memory Learning Loop

- Date: 2026-08-24
- Branch: `codex/review-memory-learning-loop`
- Outcome: completed

## Goal

Close the daily-use loop by promoting explicitly approved outcomes into durable role memory and actionable Wiki quality signals, without silent autonomous writes.

## Delivered

- Added shared contracts and Mongo persistence for structured review learning.
- Added `POST /runs/:id/curate-learning` with completed/approved/memory gates and irreversible-effect idempotency.
- Added human-readable role-memory Markdown under `wiki/role-memory/<role>.md` and made it the durable source for the role-memory read model.
- Added optional `contradiction`, `stale`, and `needs-review` signals to deterministic Wiki lint and Knowledge Graph quality.
- Kept generic memory capture and role-learning curation as two explicit operator actions.
- Added the full frontend API chain, Review controls, daily-loop status, and Knowledge Inspector learning details.
- Rejected conflicting second curation attempts while reusing identical retries.

## Validation

- Focused API tests passed: 2/2 in `review-learning.test.ts`.
- Focused frontend tests passed: 18/18 across `App.test.tsx` and `KnowledgeInspector.test.tsx`.
- Full deterministic suite passed: API 119/119 and Web 24/24; 3 opt-in Mongo tests were skipped.
- Monorepo typecheck passed across Shared, API, Web, and MCP server.
- Production build passed across Shared, API, Web, and MCP server; Vite retained the existing large-chunk advisory.
- Read-only Wiki lint passed with zero issues.
- No external LLM, Codex, or MCP execution was used by tests.

## Operational notes

- Role learning is one immutable approved record per run in v1; corrections require an explicit future curation workflow rather than silent overwrite.
- Curation signals are findings, not mutations. The existing Wiki/Dream review surfaces remain responsible for resolution.
- Local runtime graph snapshots and the pre-existing runtime Wiki stash were preserved and excluded from this work.
