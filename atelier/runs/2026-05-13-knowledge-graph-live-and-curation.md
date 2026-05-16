# 2026-05-13 — Knowledge Graph live updates + curation presets

## Summary

Closed two roadmap items for Knowledge Graph v2 follow-up:

1. WebSocket live updates with polling fallback.
2. Graph annotations and saved filter presets.

This ships a true "sesion viva" path (push-first) and operator curation memory (notes/tags/presets) persisted in local runtime files.

## Scope shipped

### Task 3 — WebSocket live updates + fallback

- API live channel service:
  - `apps/api/src/services/knowledge-live.service.ts`
  - hooked in `apps/api/src/server.ts`
  - registered in `apps/api/src/services/app-services.ts`
- API dependency updates:
  - `apps/api/package.json` (`ws`, `@types/ws`)
- Web API hook and fallback:
  - `apps/web/src/api/hooks/knowledge/useKnowledgeApi.ts`
  - `apps/web/src/features/knowledge/hooks/useKnowledgeGraphPanel.ts`
- UI status in graph header:
  - `apps/web/src/features/knowledge/KnowledgeGraphView.tsx`
  - shows live session vs fallback mode.

### Task 4 — Annotations + filter presets

- Shared types for annotation/preset payloads:
  - `packages/shared/src/types/knowledge-graph.ts`
- API persistence + graph enrichment:
  - `apps/api/src/services/knowledge-graph.service.ts`
  - persisted files:
    - `atelier/_runtime/graph-annotations.json`
    - `atelier/_runtime/graph-filter-presets.json`
  - graph nodes now include annotation metadata (`annotationNote`, `annotationTags`, `annotationUpdatedAt`) when present.
- New routes:
  - `GET /knowledge/annotations`
  - `POST /knowledge/annotations`
  - `GET /knowledge/filter-presets`
  - `POST /knowledge/filter-presets`
  - file: `apps/api/src/routes/knowledge.routes.ts`
- Frontend API chain additions:
  - service: `apps/web/src/api/services/knowledge.service.ts`
  - query keys: `apps/web/src/api/query/queryKeys.ts`
  - API hooks: `apps/web/src/api/hooks/knowledge/useKnowledgeApi.ts`
  - feature coordinator: `apps/web/src/features/knowledge/hooks/useKnowledgeGraphPanel.ts`
  - UI integration:
    - `apps/web/src/features/knowledge/components/KnowledgeInspector.tsx`
    - `apps/web/src/features/knowledge/KnowledgeGraphView.tsx`
- Test coverage:
  - API: `apps/api/src/test/operational-spine.test.ts` (annotation/preset persistence and graph metadata assertions).

## Validation

- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm test:web` ✅ (20/20)
- `pnpm --filter @atellier/api typecheck` ✅
- `pnpm test:api` ✅ (77/77)

## Notes

- Fixed a transient web test/typecheck break where an annotation-sync `useEffect` had been left outside `KnowledgeInspector` component scope.
- Operational memory policy preserved: no raw source overwrite, no external LLM/MCP calls in tests.

## Suggested next focus

1. Per-run executor override decision and minimal implementation surface.
2. Role memory surfaces by role (Builder/QA/Wiki Curator/PM).
3. Codex Worker Evidence Pass v1.1 hardening.
