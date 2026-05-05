# Run: Runs Review + Deliverables + Filters

- Date: 2026-05-04
- Operator: Codex
- Scope: `packages/shared`, `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Continue parallel completion of optimization steps for run supervision and deliverable workflow.

## Actions

- Added run review update flow:
  - Shared type `UpdateRunReviewInput`.
  - API route `PATCH /runs/:id/review`.
  - Run service support for updating `reviewStatus` in memory and Mongo modes.
- Extended run timeline operation:
  - Added review action controls (`approved`, `changes-requested`, `pending`) for completed runs.
  - Added filters for agent state (`all`, `needs-human`, `blocked`).
  - Added filters for review state (`all`, `pending`, `approved`, `changes-requested`).
- Added deliverables panel:
  - New `DeliverablesPanel` in dashboard.
  - Lists runs with `deliverablePath` plus current review state.
- Added tests:
  - API: review status patch route test.
  - Web: run review action test path from UI.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Runs can now move through explicit human review states, operators can filter operationally important queues fast, and deliverables are visible as first-class outputs in the dashboard.
