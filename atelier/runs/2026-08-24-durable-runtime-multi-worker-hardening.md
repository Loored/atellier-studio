# Durable Runtime Multi-Worker Hardening

- Date: 2026-08-24
- Branch: `codex/runtime-multi-worker-hardening`
- Base: `dev/1.0.0` at merge commit `02d4be6`
- Storage: isolated database on the local Mongo 7 container
- Executor: none; the integration tests exercise deterministic queue/event services only

## Goal

Verify the Mongo invariants that make multiple local workers safe before adding more execution authority.

## Changes

- Added an opt-in Mongo integration suite with independent worker-facing queue/service instances over shared state.
- Verified exactly one worker claims a queued run during contention.
- Verified exactly one worker reclaims an expired lease and the former owner can no longer heartbeat.
- Bound heartbeats, worker-owned transitions, and step-event sequence allocation to a matching, unexpired lease, rejecting late activity from paused or reclaimed workers.
- Guarded parent progress and completion writes with the same lease fence so a stale worker cannot overwrite the active attempt.
- Verified concurrent event appends receive a complete ordered sequence with no duplicates.
- Verified Mongo's unique `(runId, sequence)` index rejects a forced duplicate.

## Operation

```bash
pnpm test:api:mongo-runtime
```

The suite creates a uniquely named database and drops it after completion. Normal API tests skip it and require no Mongo process.

## Validation

- Dedicated Mongo integration suite passed: 3/3.
- Normal API suite passed: 87/87, with the 3 opt-in Mongo tests skipped as designed.
- API typecheck and production build passed.
- Final diff review found no remaining blockers or important fixes.

## Next

- Add worker lifecycle diagnostics and graceful shutdown behavior.
- Define provider abort and idempotency requirements before irreversible tool execution.
