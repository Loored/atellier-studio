# Run Log - Knowledge Graph Performance Hardening

- Date: 2026-05-15
- Scope: Frontend canvas performance pass for large graph states (>300 nodes).

## Implemented

- Updated `ForceGraphCanvas` with an automatic performance mode for large node sets:
  - activates when `nodes.length > 300`
- Reduced hot-path render work:
  - disabled animated pulse refresh loop for recently added nodes in performance mode
  - disabled radial halo gradient drawing in performance mode
  - simplified label painting in performance mode by skipping label background rectangle
  - raised label visibility threshold for dense states
- Optimized edge highlight lookup:
  - links now carry stable `id`
  - precomputed highlighted link id set for selected node
  - replaced repeated per-link source/target object extraction with O(1) id checks
- Optimized neighbor lookup:
  - built adjacency map once per edge set
  - derived selected neighborhood from adjacency map instead of scanning all edges repeatedly
- Tuned simulation defaults for large states:
  - `cooldownTicks`: `200 -> 120` in performance mode
  - `d3VelocityDecay`: `0.32 -> 0.42` in performance mode

## Validation

- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/web test` ✅ (21/21)
- `pnpm --filter @atellier/api test` ✅ (83/83)

## Notes

- This slice is intentionally conservative: behavior and UX controls remain intact, but expensive visual flourishes now scale down automatically for larger graphs.
