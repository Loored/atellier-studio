# Run Log - Graph Snapshot Diff View

- Date: 2026-05-15
- Scope: Snapshot comparison for Knowledge Graph auditing.

## Implemented

- Added shared response contract:
  - `KnowledgeGraphSnapshotDiffResponse`
- Added API diff capability:
  - service method in `KnowledgeGraphService` to compare two snapshots by id
  - route: `GET /knowledge/graph/diff?base=<id>&head=<id>`
- Added frontend API chain:
  - query key: `queryKeys.knowledge.diff(baseId, headId)`
  - service call: `knowledgeService.readSnapshotDiff(baseId, headId)`
  - hook: `useKnowledgeSnapshotDiffApi(baseId, headId)`
- Added UI panel in `KnowledgeGraphView`:
  - base/head snapshot selectors
  - node and edge +/− counters
  - sample lists of added/removed node ids and edge ids

## Validation

- `pnpm --filter @atellier/shared typecheck` ✅
- `pnpm --filter @atellier/api typecheck` ✅
- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/api test` ✅ (82/82)
- `pnpm --filter @atellier/web test` ✅ (21/21)

## Notes

- Snapshot creation remains throttled (1/hour), so API tests validate diff behavior using a valid snapshot pair that is deterministic under throttling.
