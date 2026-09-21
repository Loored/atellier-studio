# Durable cancellation and exhausted-attempt recovery

- Date: 2026-09-14
- Scope: durable orchestration worker recovery
- Result: verified

## Problem

A parent orchestration and its active child could remain `running` after a worker restart when cancellation had already been requested or the durable attempt budget had been exhausted. Cancellation-pending runs were intentionally excluded from normal claims, but no restart reconciler owned their terminal transition. Expired runs could also be reclaimed without enforcing `maxAttempts` at the claim boundary.

## Change

- The worker reconciles expired executions before claiming new work.
- An expired cancellation-pending parent becomes `cancelled` and its active children become `cancelled`.
- An expired parent at `maxAttempts` becomes `failed` and its active children become failed/superseded.
- Lease fields are cleared, one terminal parent event/evaluation is recorded, and an agent is reset to `idle` only when the interrupted child is still its `lastRunId` and it is still `executing`.
- The claim selector independently rejects expired runs whose attempt budget is exhausted.
- All recovery transitions are conditional and idempotent in Mongo and memory storage.

## Verification

- Focused memory recovery tests passed.
- Durable worker lifecycle tests passed.
- Mongo opt-in recovery/concurrency tests passed, including cancellation and max-attempt cases.
- Historical parent `6aa79ebbe1ab2302e3bcb40a` reconciled to `cancelled`.
- Historical child `6aa79f7ec47d0c13607539da` reconciled to `cancelled`.
- Local health reported `activeRuns: 0` after recovery.

## Operator view

Runs now derives an explicit recovery notice from durable evidence instead of inventing a parallel status field:

- cancellation requested while the active lease remains valid;
- cancellation waiting for a recovery worker after lease expiry;
- parent cancellation recovered after worker interruption;
- parent failed after durable attempts were exhausted;
- child cancelled or superseded with the recovery timestamp.

Recovery titles, details, and server timestamps are searchable in the Runs timeline. The presentation uses text and icons in addition to color so the state remains accessible.

## Safety boundary

No direct Mongo mutation was used to repair production-like local state. The restarted worker applied the same server-owned reconciliation path covered by the tests.
