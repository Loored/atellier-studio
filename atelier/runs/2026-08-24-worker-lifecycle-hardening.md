# Worker Lifecycle Hardening

- Date: 2026-08-24
- Branch: `codex/worker-lifecycle-hardening`
- Base: `dev/1.0.0` at merge commit `7ae5b3d`
- Executor: mock only

## Goal

Make standalone worker state inspectable and ensure process signals never disconnect Mongo underneath active orchestration work.

## Changes

- Added explicit worker states: `idle`, `polling`, `running`, `stopping`, and `stopped`.
- Added structured lifecycle events for startup, claims, settlement, errors, shutdown start, and shutdown completion.
- Added diagnostic snapshots with worker ID, active run, processed count, latest error, timestamps, lease duration, and poll duration.
- Deduplicated overlapping `runOnce()` calls within one worker instance.
- Made idle poll delays abortable so shutdown does not wait for the polling interval.
- Made shutdown wait for active run/poll/drain promises before Mongo disconnects.
- Kept the active run heartbeat alive during cooperative shutdown.

## Validation

- Focused lifecycle suite passed: 3/3.
- Normal API suite passed: 90/90; the 3 opt-in Mongo tests remained skipped as designed.
- API typecheck and production build passed.
- Live isolated-Mongo worker check emitted `started -> stopping -> stopped` and exited immediately after `SIGINT` while idle.
- Temporary Mongo database was dropped after the live check.

## Remaining boundary

Graceful shutdown waits for an in-flight provider request; it does not abort that request. Provider cancellation and idempotency requirements for irreversible tools remain the next v1.1 block.
