# Tool Effect Idempotency

Atellier classifies tool effects before execution:

- `read`: no persistent side effect
- `reversible`: persistent effect with an explicit recovery path
- `irreversible`: effect that cannot be safely repeated or rolled back

Read and reversible operations execute normally. Irreversible operations must go through `EffectIdempotencyService` with:

- a stable, non-empty `idempotencyKey` for the specific approved attempt
- a deterministic `fingerprint` of the tool, arguments, target, and relevant execution policy

## Durable behavior

The first caller atomically claims the key before performing the effect. Mongo uses a unique index on `idempotencyKey`; memory mode provides the same process-local contract for tests and lightweight review.

Subsequent calls behave deterministically:

- same key and fingerprint, completed: reuse the persisted result
- same key and fingerprint, running: report `in-progress` without executing again
- same key and fingerprint, failed: return the persisted failure without executing again
- same key with another tool or fingerprint: reject as a conflict

The ledger records the attempt, status, result or error, and start/completion/failure timestamps.

## Integration rule

Any adapter that can create an irreversible external or workspace effect must call the service instead of invoking the operation directly. A missing key or fingerprint fails closed before the operation begins.

Retries that intentionally represent a new approved attempt must receive a new key. They must not silently recycle the failed attempt's key.

The controlled Codex Worker adapter is the first consumer of this contract. Future publishing, messaging, billing, or destructive tool integrations must follow the same boundary.
