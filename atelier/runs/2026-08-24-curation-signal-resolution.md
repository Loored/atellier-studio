# Run Log - Curation Signal Resolution

- Date: 2026-08-24
- Branch: `codex/curation-signal-resolution`
- Outcome: completed and live-validated

## Goal

Close approved role-learning signals with an explicit, durable operator decision while preserving history and leaving the target Wiki page untouched.

## Delivered

- Added `POST /runs/:id/resolve-learning-signal` with `resolved` and `dismissed` outcomes plus a required note.
- Persisted resolution under `Run.memory.learning.resolution` and in the Mongo schema.
- Appended a human-readable resolution and a machine-readable marker to the existing role-memory Markdown page.
- Removed only exact signal/path matches with durable resolution from active Wiki lint.
- Added total, open, and resolved signal counts to role memory and Knowledge Inspector.
- Added Review controls, daily-loop signal state, API invalidation, alerts, and idempotent replay behavior.
- Reused the irreversible-effect ledger with `run-learning-resolution:<runId>` and rejected conflicting second resolutions.

## Validation

- Focused API tests passed: 3/3 in `review-learning.test.ts`.
- Focused frontend tests passed: 19/19 across `App.test.tsx` and `KnowledgeInspector.test.tsx`.
- Full deterministic suite passed: API 120/120 and Web 25/25; 3 opt-in Mongo tests were skipped.
- Monorepo typecheck and production build passed across Shared, API, Web, and MCP server.
- Vite retained the existing large-chunk advisory.
- Browser review against the user's real local Mongo data confirmed the open signal form, disabled/enabled note behavior, responsive card layout, and a clean console.
- Read-only real Wiki lint preserved exactly one open `stale` finding until the operator resolved it.
- The operator dismissed the real signal with the note `missing expected pages`; Review confirmed `wiki/role-memory/wiki-curator.md`, and subsequent Wiki lint runs reported no issues.
- No external LLM, Codex, or MCP execution was used by automated tests.

## Operational notes

- The user's live source, synthesis, role-memory page, Wiki updates, deliverables index, and graph snapshots were preserved as user-owned runtime artifacts.
- Visual QA remained read-only; the operator then completed the resolution from Review and confirmed the success state.
- Failed or partial irreversible effects remain fail-closed and require inspection of the effect ledger, run metadata, role-memory page, and Wiki log before recovery.
