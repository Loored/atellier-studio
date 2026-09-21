# Harness Restart Reconciliation

- Date: 2026-09-10
- Scope: reversible document changes and supervised code worktrees
- Result: completed
- External tools called: false

## Objective

Recover safely when a process stops after a bounded filesystem effect completed but before its effect ledger and Wiki evidence converged.

## Implemented

- The effect ledger can reconcile only an exact failed effect or an `in-progress` effect stale for at least 30 seconds. Tool name, idempotency key, and fingerprint must all match.
- Document apply and rollback compare the verified current file with the immutable preview before recovery. Matching contents without an exact recoverable ledger entry fail closed.
- An exact rollback handle remains valid after apply even if the original apply approval later expires; rollback is the safety path, not a new forward mutation.
- Supervised prepare recovers an existing registered worktree only when it contains the exact approved preview and has matching failed/stale prepare evidence.
- Supervised verification writes a bounded JSON recovery receipt beside stdout/stderr before the Wiki event. A retry can record that exact result without rerunning the completed command.
- Supervised discard is idempotent when the registered worktree was already removed but its Wiki receipt failed.
- Existing Wiki evidence opportunistically reconciles a matching failed ledger record when only the final log append was interrupted.

## Safety boundaries

- No arbitrary command, automatic merge, primary-checkout code write, external effect, or new autonomous permission was added.
- A manually edited document or manually created worktree cannot become trusted execution evidence without the exact ledger fingerprint.
- Fresh `in-progress` effects are never taken over; they retain a 30-second ownership window.
- Corrupt or mismatched recovery receipts fail closed.

## Validation

- `corepack pnpm --filter @atellier/api exec vitest run src/test/effect-idempotency.test.ts src/test/workspace-changes.routes.test.ts src/test/reversible-workspace.service.test.ts src/test/supervised-code-changes.routes.test.ts src/test/isolated-worktree.service.test.ts`
- `corepack pnpm --filter @atellier/api typecheck`
- `corepack pnpm test:api`

API result: 245 passed; 5 isolated Mongo tests skipped by their existing opt-in contract.

## Next

Harden MCP retrieval-policy parity, then bind canary budgets to exact runtime configuration and reject receipt reuse outside that configuration.
