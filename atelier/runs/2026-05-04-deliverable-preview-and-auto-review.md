# Run: Deliverable Preview and Auto Review Defaults

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `packages/shared`, `atelier/wiki`
- Trigger: Continue parallel completion of operational workflow: preview deliverables and automate review-state transitions.

## Actions

- Added secure wiki page read endpoint:
  - `GET /wiki/page?path=<relative-path>`
  - path is resolved and constrained to `atelier/` root to prevent traversal.
- Added deliverable preview flow:
  - Web wiki client + query hook for page reads.
  - Deliverables panel now lets operators select a `deliverablePath` and preview markdown content inline.
- Added automatic review-state defaults on completion:
  - non-review runs default to `pending`
  - `review` runs default to `approved`
  - explicit provided review status still overrides defaults.
- Expanded dashboard metrics:
  - `needs-human` agent count
  - `blocked` agent count
  - `pending` review run count
- Added API tests for:
  - default review transition behavior
  - wiki page read route.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Atellier now closes the run loop more cleanly: completed runs enter predictable review states automatically, deliverables can be inspected from the dashboard, and critical operational queues are visible at a glance.
