# Harness governance — Slice 1 containment

**Completed:** 2026-09-10T03:16:06Z  
**Scope:** isolate governance routes and fail closed before any reversible workspace write can execute.

## Delivered

- Moved Control Bundle, proposal, canary, budget, and reversible-workspace HTTP routes out of the Runs route module.
- Added service-owned coordinators for the current Control Bundle and workspace-change boundaries.
- Made workspace `apply` and `rollback` disabled by default. They require the explicit local diagnostic setting `ATELLIER_REVERSIBLE_WORKSPACE_WRITES_ENABLED=true`.
- Restricted reversible previews to existing regular text files under `docs/`, `atelier/wiki/`, `atelier/tasks/`, `apps/`, and `packages/`.
- Rejected `atelier/raw`, runtime paths, hidden paths, symlinks, binary files, oversized files, traversal, stale previews, and orphan approvals.

## Boundary retained

Control Bundles, planned canaries, and budget receipts still do not alter model routing, tool policy, retries, context limits, or a running executor. Workspace writes remain a diagnostic opt-in only; this slice does not claim atomic writes, durable apply state, rollback handles, effect-idempotency, real test execution, or runtime canary assignment.

## Validation

- `corepack pnpm --filter @atellier/api typecheck`
- `corepack pnpm test:api` — 230 passed; 5 Mongo runtime tests skipped by opt-in policy.
- `git diff --check`

## Next

Implement Slice 2: canonical Control Bundle and workspace-change state machines, referential integrity, fingerprint-bound approvals, immutable durable records, and read/list operator endpoints. Do not enable normal workspace writes or runtime canaries first.
