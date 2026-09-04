# Run Log - Office Sub-tabs With Knowledge Graph

- Date: 2026-05-15
- Scope: Embed Knowledge Graph as a native tab inside Office view.

## Implemented

- Updated `OfficeView` with local tabs:
  - `Office`
  - `Grafo`
- `Grafo` tab now renders `KnowledgeGraphView` directly inside the Office surface.
- `Office` tab preserves existing office interactions:
  - status filters
  - live orchestration toggle
  - pixel office canvas
  - live processes panel
  - agent side panel
  - bottom action bar
- Selecting `Grafo` clears selected side-panel agent to avoid panel overlap and keep graph workspace clean.
- `KnowledgeGraphView` return action now maps back to Office tab (`onNavigate={() => setActiveTab("office")}`) inside this embedded context.

## Validation

- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/web test` ✅ (21/21)

## Notes

- This keeps the original global `knowledge` view intact while enabling an in-context graph workflow from Office.
