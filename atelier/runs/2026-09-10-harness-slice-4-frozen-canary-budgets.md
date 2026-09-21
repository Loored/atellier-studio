# Harness governance — Slice 4 frozen canary budgets

**Completed:** 2026-09-10T05:00:00Z  
**Scope:** bind an approved canary to a frozen bundle snapshot and issue deterministic per-run budget receipts.

## Delivered

- A planned canary now freezes the exact proposal, approval, bundle fingerprint, model profile map, limits, and allowed tools into its own fingerprinted record.
- A named run can receive a budget receipt only through that frozen canary. The server derives a stable 0–99 bucket from the canary fingerprint and run ID, then admits only runs inside the approved sample percentage.
- The reservation rejects rolled-back canaries, expired approvals, runs outside the sample, values above local timeout/retry/context ceilings, and tools outside the existing bounded read-only catalog.
- Each reserved or blocked decision is an immutable receipt visible in Settings. A rollback stops new reservations but preserves prior receipts as audit evidence.

## Boundary retained

These receipts freeze and enforce assignment authority before execution; they do not change the active executor, global model routing, scheduler autonomy, or workspace-write policy. Applying a receipt to a running worker remains a later, separately reviewed integration.

## Validation

- `corepack pnpm -r typecheck`
- Focused API Tool Harness suite — 12 passed, including selected/non-selected deterministic budget outcomes and post-rollback blocking.
- Focused Settings suite — 1 passed.

## Next

Slice 5 must replace diagnostic workspace writes with atomic document writes, effect-idempotency, durable apply/rollback state, and rollback handles.
