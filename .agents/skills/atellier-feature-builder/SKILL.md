---
name: atellier-feature-builder
description: Use when implementing a new Atellier Studio feature end-to-end across shared types, API routes, services, frontend API hooks, feature hooks, and components.
---

# Atellier Feature Builder Skill

Use vertical slices.

Do not build isolated UI with no backend.
Do not build backend endpoints with no frontend usage.

## Workflow

1. Read `AGENTS.md`.
2. Read relevant app-specific `AGENTS.md`.
3. Identify affected layers.
4. Add or update shared types first.
5. Add or update backend model/service/route.
6. Add or update frontend service/API hooks.
7. Add or update feature hook.
8. Add or update visual component.
9. Add tests for critical behavior.
10. Run typecheck/tests.
11. Update docs if scripts or setup changed.

## Definition of done

- Types are shared when appropriate.
- No duplicated status enums.
- API route works.
- Frontend consumes route through API hooks.
- Component does not call HTTP directly.
- Tests pass.
- README/docs updated if needed.
