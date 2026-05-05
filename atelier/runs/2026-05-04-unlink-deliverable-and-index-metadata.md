# Run: Unlink Deliverable and Index Metadata Upgrade

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Continue with safe rollback path for deliverables and richer deliverables index metadata.

## Actions

- Added deliverable unlink flow:
  - API route `PATCH /runs/:id/unlink-deliverable`.
  - Run service removes `deliverablePath` and deletes underlying deliverable file when present.
  - Timeline now shows `Unlink` for completed runs that already have deliverables.
- Upgraded deliverables index metadata:
  - `wiki/deliverables/index.md` now includes `Type` and `Review` columns.
  - Index builder extracts values from each deliverable markdown metadata block.
- Added safe delete helper in wiki service:
  - `deletePage(relativePath)` with same atelier-root boundary checks.
  - Deliverables index refreshes automatically after delete.
- Added test coverage:
  - API test for unlink route and index update behavior.
  - Web test for unlink action from timeline.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Operators can now revert accidental deliverable attachments safely, and deliverables index browsing is more informative for review workflows.
