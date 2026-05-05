# Run: Promote Deliverable and Auto Index

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Continue with manual promotion for existing runs and deliverables index navigation.

## Actions

- Added run promotion endpoint:
  - `PATCH /runs/:id/promote-deliverable`
  - creates deliverable markdown for an existing run and stores `deliverablePath`.
- Added auto-refreshing deliverables index:
  - `wiki/deliverables/index.md` regenerates whenever a deliverable markdown file is written.
  - index lists file name, path, and update timestamp.
- Updated Runs Timeline UX:
  - completed runs without `deliverablePath` now show `Promote` action.
  - promote action triggers deliverable creation through API mutation and refreshes queries.
- Added tests:
  - API test for promote endpoint + index refresh verification.
  - Web test for promote button flow.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Existing runs can now be promoted into durable deliverables on demand, and deliverables are easier to browse thanks to an auto-maintained index file.
