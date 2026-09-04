# Run Log - Dream Decisions and Persisted Graph Snapshots

- Date: 2026-05-13
- Scope: Task 1 (slice closure + docs/memory hygiene), Task 2 (persisted graph snapshots), and consolidation of Dream decision curation in graph/UI/tests.

## Implemented

- Added `POST /wiki/dream-decisions` to record `accepted/rejected/deferred` decisions for Dream proposals.
- Persisted Dream decision records to `wiki/decisions/*.md` and appended decision events into `wiki/log.md`.
- Extended Knowledge Graph model with:
  - node type: `dream-decision`
  - edge type: `dream_decision_for_report`
- Added Dream proposal action buttons in Wiki panel (`Accept`, `Reject`, `Defer`).
- Added decision filters and counters in Graph view plus report-path navigation from inspector.
- Added persisted graph snapshots:
  - path: `atelier/_runtime/graph-snapshots/*.json`
  - ring size: 48
  - throttle: 1/hour
  - startup reload via `KnowledgeGraphService.initialize()`.

## Validation

- API:
  - `pnpm test:api` passed with expanded coverage (75 tests total).
  - Added assertions for:
    - Dream decision metadata contract
    - quality mapping (`accepted -> verified`, `deferred -> proposed`, `rejected -> contradicted`)
    - edge creation behavior when report exists / does not exist
    - snapshot reload after server restart
- Web:
  - `pnpm test:web` passed (20 tests total).
  - Added tests for inspector navigation and Dream decision filter counters.
  - Removed stale warning noise for `knowledge/snapshots` query in `App.test.tsx`.

## Follow-up

1. Replace graph polling with WebSocket push updates.
2. Add graph annotations and saved filter presets.
3. Build role-memory surfaces from graph decisions and run evidence.
