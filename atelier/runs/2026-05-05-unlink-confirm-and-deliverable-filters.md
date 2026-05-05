# Run: Unlink Confirmation and Deliverable Filters

- Date: 2026-05-05
- Operator: Codex
- Scope: `apps/web`, `apps/api`, `atelier/wiki`
- Trigger: Continue UX hardening for deliverable lifecycle and filtering ergonomics.

## Actions

- Added confirmation guard for unlink action:
  - `RunsTimeline` now prompts confirmation before unlinking deliverables.
  - Prevents accidental file removal from `wiki/deliverables`.
- Added deliverables filtering controls:
  - `DeliverablesPanel` now supports filter by `Run type` and `Review status`.
  - Includes empty-state feedback when no deliverables match filters.
- Kept run timeline action behavior:
  - `Promote` appears when a completed run has no deliverable.
  - `Unlink` appears when a completed run already has one.
- Added and fixed test coverage:
  - Web tests now include deliverables filter behavior.
  - Web tests validate unlink action path and confirmation-backed flow.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Deliverable operations are safer in daily use, and deliverables are easier to inspect with targeted filtering by operational dimensions.
