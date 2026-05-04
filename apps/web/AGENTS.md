# apps/web/AGENTS.md

## Frontend conventions

All API access must follow:

service function -> API hook -> feature hook/coordinator -> visual component

Rules:

- Components must never call axios/fetch directly.
- Services only perform HTTP requests.
- API hooks own TanStack Query cache, invalidation, and alerts.
- Feature hooks coordinate UI state.
- Rename generic fields when consuming hooks:
  - `data` -> `taskList` / `agentList` / `runList`
  - `isFetching` -> `isFetchingTasks` / `isFetchingRuns`
  - `isPending` -> `isCreatingTask` / `isUpdatingRun`
- Use query keys from `src/api/query/queryKeys.ts`.
- Mutations with invalidation/alerts must use hook callbacks.
- Do not test styling details. Test behavior.
- Do not add pixel/Phaser UI yet unless explicitly requested.

## API layer structure

Prefer:

```txt
src/api/
  client/
  query/
  alerts/
  services/
  hooks/

src/features/
  tasks/
  agents/
  runs/
  wiki/
```
