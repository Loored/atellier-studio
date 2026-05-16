# 2026-05-13 — Per-run executor override (Task 5)

## Summary

Implemented per-run executor override for manual agent runs, keeping the existing env-driven default behavior intact.

## What shipped

- Added shared executor mode constant:
  - `packages/shared/src/types/health.ts`
  - `EXECUTOR_MODES` + `availableExecutorModes` on `HealthStatus`.
- Extended run input contract:
  - `packages/shared/src/types/agent-run.ts`
  - new optional `executorModeOverride`.
- Backend executor routing by mode:
  - `apps/api/src/services/agent-run.service.ts`
  - run now resolves executor per request (`override` or default mode).
  - selected mode is persisted in run input metadata.
  - handoff runs keep the same selected executor mode.
- Backend mode availability surfaced + validated:
  - `apps/api/src/services/app-services.ts` now exposes:
    - active mode
    - available modes for this API session (based on configured keys/models).
  - `apps/api/src/routes/agents.routes.ts` validates override:
    - allowed enum mode
    - mode available in current session.
  - `apps/api/src/routes/health.routes.ts` returns `availableExecutorModes`.
- Frontend manual-run control:
  - `apps/web/src/features/pixel-office/hooks/useAgentDetailPanel.ts`
  - `apps/web/src/features/pixel-office/AgentSidePanel.tsx`
  - added executor selector in "Send message" composer:
    - default: env mode
    - optional override from available modes list.

## Tests

- API:
  - Added operational-spine coverage for:
    - successful `executorModeOverride: "mock"`
    - rejection of unavailable mode override.
  - File: `apps/api/src/test/operational-spine.test.ts`
- Validation run:
  - `pnpm --filter @atellier/api typecheck` ✅
  - `pnpm test:api` ✅ (79/79)
  - `pnpm --filter @atellier/web typecheck` ✅
  - `pnpm test:web` ✅ (20/20)

## Notes

- This implementation is intentionally conservative:
  - no global Settings write path yet
  - no orchestration-level override yet
  - no environment mutation; only per-run request routing.
