---
name: atellier-api-layer
description: Use when adding or modifying frontend API calls, TanStack Query hooks, services, mutations, query keys, API alerts, or feature coordinators.
---

# Atellier API Layer Skill

All frontend API access must follow:

service function -> API hook -> feature hook/coordinator -> visual component

## Rules

- Components must not call axios or fetch directly.
- Services must only perform HTTP requests.
- API hooks must own TanStack Query behavior.
- Mutations that need default invalidation or alerts must use hook callbacks.
- Query keys must be centralized in `src/api/query/queryKeys.ts`.
- Consumers must rename generic fields.

## Mutation workflow

1. Call the service function.
2. In hook callbacks, invalidate relevant query keys.
3. Trigger default success alert if appropriate.
4. In hook callbacks, trigger default error alert.
5. Allow consumer callbacks to handle UI-specific behavior.

## Tests

Add or update tests for service call shape, hook invalidation behavior, or feature component behavior when useful.
