# 2026-05-13 — Orchestration executor override + Codex Worker evidence v1.1

## Summary

Implemented both requested tracks:

1. Orchestration-level executor override.
2. Codex Worker Evidence Pass v1.1 hardening.

## 1) Orchestration-level executor override

- Shared input contract:
  - `packages/shared/src/types/orchestration.ts`
  - Added optional `executorModeOverride`.
- API route validation:
  - `apps/api/src/routes/orchestrations.routes.ts`
  - Validates enum mode and session availability (`services.executor.availableModes`).
- Runtime propagation:
  - `apps/api/src/services/skill-orchestration.service.ts`
  - Stores override in orchestration run input.
  - Propagates override to each step run via `agentRuns.run(...executorModeOverride)`.
- Frontend orchestration UI:
  - `apps/web/src/features/orchestrations/hooks/useSkillOrchestrationPanel.ts`
  - `apps/web/src/features/orchestrations/components/SkillOrchestrationPanel.tsx`
  - Added selector: env default or explicit available override.

## 2) Codex Worker Evidence Pass v1.1

- Shared evidence schema enrichments:
  - `packages/shared/src/types/codex-worker.ts`
  - Step evidence: optional `durationMs`.
  - Artifact evidence: optional `byteSize`.
  - Finalize evidence: optional `failedSteps`, `blockedSteps`, `totalDurationMs`, `artifactCount`.
- Backend evidence capture:
  - `apps/api/src/services/codex-worker.service.ts`
  - Captures per-step duration and artifact byte sizes.
  - Finalize computes and persists extra evidence counters and durations.
  - Run log "Evidence" section expanded with failed/blocked/duration/artifact totals.
- Frontend finalize payload + display:
  - `apps/web/src/api/services/codex-worker.service.ts`
  - `apps/web/src/api/hooks/codex/useCodexWorkerApi.ts`
  - `apps/web/src/features/codex/hooks/useCodexWorkerPanel.ts`
  - `apps/web/src/features/codex/components/CodexWorkerPanel.tsx`
  - Finalize now sends derived `testEvidence` and `changedFiles` lists.
  - Panel now renders duration and artifact sizes per step plus richer finalize counters.

## Tests and verification

- API coverage added:
  - `apps/api/src/test/operational-spine.test.ts`
  - New tests for orchestration override accepted/rejected paths.
- Web test adjustment:
  - `apps/web/src/App.test.tsx`
  - Updated one assertion to tolerate duplicate `openai` text due to new selector option.

Validation run:

- `pnpm --filter @atellier/api typecheck` ✅
- `pnpm test:api` ✅ (81/81)
- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm test:web` ✅ (20/20)
