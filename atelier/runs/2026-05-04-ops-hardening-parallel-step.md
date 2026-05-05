# Run: Ops Hardening Parallel Step

- Date: 2026-05-04
- Operator: Codex
- Scope: `packages/shared`, `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Continue parallel optimization track to close reliability and daily-ops gaps.

## Actions

- Added persistent agent instructions end-to-end:
  - Shared type support for `agent.instructions`.
  - API support via `PATCH /agents/:id/instructions`.
  - Agent panel textarea + save action to update instructions without leaving the run view.
- Upgraded run completion metadata:
  - Added optional `reviewStatus` and `deliverablePath` fields for completed runs.
  - Persisted fields in memory and Mongo run storage.
  - Accepted new fields in `PATCH /runs/:id/complete`.
- Expanded health telemetry:
  - `/health` now returns storage mode, executor mode, Mongo connection state, agent/run counts, and process memory usage.
- Added human-loop visibility enhancements:
  - Browser notifications when agents newly transition to `needs-human`.
  - Mobile bottom-nav badge showing current `needs-human` count.

## Validation

- `pnpm typecheck` passed
- `pnpm test` passed

## Outcome

Operational reliability and supervision ergonomics improved in parallel while preserving Milestone 0 architecture and test stability.
