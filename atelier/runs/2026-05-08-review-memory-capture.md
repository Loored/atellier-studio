# Run: Review Memory Capture Slice

- Date: 2026-05-08
- Operator: Codex
- Scope: `packages/shared`, `apps/api`, `apps/web`, `README.md`, `docs/next-work-plan.md`, `CODEX_MEMORY.md`, `atelier/wiki`
- Trigger: Continue next Atellier steps after local API startup was restored.

## Actions

- Added a run memory capture contract:
  - `CaptureRunMemoryInput`
  - `CaptureRunMemoryResponse`
- Added `POST /runs/:id/capture-memory`.
- Added `RunService.captureMemory` to write completed run review memory into `wiki/synthesis/`.
- Captured memory pages include:
  - run metadata
  - review status
  - deliverable path
  - latest logs
  - validation evidence
  - output snapshot
- Updated safe wiki page writes so non-deliverable wiki pages are upserted into `wiki/index.md`.
- Wired the frontend through the required API chain:
  - `runsService.captureMemory`
  - `useCaptureRunMemoryApi`
  - `useRunsTimeline`
  - `ReviewView`
- Added a `Capture memory` action to completed Review rows.
- Updated next-work docs and active memory to put Wiki Brain v2 + Review Inbox first.

## Validation

- `pnpm -r typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed
- API health checked at `http://127.0.0.1:4000/health`
- Web dev server started at `http://127.0.0.1:5173/`

## Notes

- Existing unrelated local/generated changes were already present before this slice, including `apps/api/src/test/operational-spine.test.ts`, wiki deliverables index/log entries, and Codex Worker evidence files.
- The API is currently reachable in `memory` storage mode with OpenAI executor visibility enabled.
