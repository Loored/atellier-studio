# Run Log - Role Memory Overlay In Graph

- Date: 2026-05-15
- Scope: Add role-memory visual overlay signals directly in Knowledge Graph canvas.

## Implemented

- Extended `useKnowledgeGraphPanel` to load and expose `roleMemoryByRole` from `useKnowledgeRoleMemoryApi`.
- Added graph control toggle in `KnowledgeGraphView`:
  - `Role overlay on/off`
- Extended `ForceGraphCanvas` to render role-memory badges on:
  - `role` nodes
  - `agent` nodes (using agent role)
- Badge color semantics:
  - red: blocked/failed > 0
  - amber: pending review > 0
  - green: no active risk signals

## Validation

- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/web test` ✅ (21/21)
- `pnpm --filter @atellier/api test` ✅ (83/83)

## Notes

- Overlay is visual-only and toggleable, so it does not alter filtering semantics or graph topology.
