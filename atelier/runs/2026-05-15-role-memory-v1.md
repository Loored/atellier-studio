# Run Log - Role Memory v1

- Date: 2026-05-15
- Scope: First curated role-memory surface connected to the existing Knowledge Graph workflow.

## Implemented

- Added API endpoint:
  - `GET /knowledge/role-memory`
- Added role-memory read model in `KnowledgeGraphService`:
  - groups by role
  - per-role stats (`agents`, `tasks`, `runs`, `completed`, `blocked`, `failed`, `pendingReview`)
  - recent runs (top 5 by `updatedAt`)
  - blocker signal extraction from run logs/status
  - deterministic focus suggestions per role
- Added shared contracts in `packages/shared`:
  - `RoleMemoryResponse`
  - `RoleMemoryEntry`
  - `RoleMemoryRunSummary`
- Added frontend API chain:
  - service: `knowledgeService.readRoleMemory()`
  - query key: `queryKeys.knowledge.roleMemory`
  - hook: `useKnowledgeRoleMemoryApi()`
- Added UI surface:
  - `KnowledgeInspector` now renders Role Memory when selected node type is `role`.

## Validation

- `pnpm --filter @atellier/shared typecheck` ✅
- `pnpm --filter @atellier/api typecheck` ✅
- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/api test` ✅ (81/81)
- `pnpm --filter @atellier/web test` ✅ (21/21)

## Notes

- While running tests, an initial attempt used `--runInBand` (Jest-style flag), which Vitest does not support in this workspace. Re-ran with standard `vitest run`.
