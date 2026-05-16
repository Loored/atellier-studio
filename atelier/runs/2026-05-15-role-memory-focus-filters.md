# Run - 2026-05-15 - Role memory focus filters

## Summary

Added role-memory-driven focus filters in Knowledge Graph so operators can quickly isolate high-risk and pending-review clusters.

## Scope

- `apps/web/src/features/knowledge/KnowledgeGraphView.tsx`

## Changes

1. Added `roleMemoryFocusMode` UI state with modes:
   - `all`
   - `high-risk`
   - `pending-review`
2. Derived role sets from `roleMemoryByRole`:
   - high-risk roles from blocked/failed counts
   - pending-review roles from pending review counts
3. Built focused subgraph projection:
   - include matching role/agent nodes
   - expand one hop through connected edges
4. Wired focus controls in graph toolbar with live counters.
5. Switched canvas render inputs and local node/edge counters to projected graph.
6. Auto-clears selected node when it falls outside the focused subgraph.

## Validation

- `pnpm --filter @atellier/web typecheck`
- `pnpm --filter @atellier/web test`

## Result

Knowledge Graph now supports one-click operational focus presets backed by role memory signals, without changing backend contracts.
