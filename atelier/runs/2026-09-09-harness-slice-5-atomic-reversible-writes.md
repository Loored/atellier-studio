# Harness governance — Slice 5 atomic reversible writes

**Completed:** 2026-09-09  
**Scope:** make the existing explicitly approved workspace-change path atomic, idempotent, durably recorded, and exactly rollbackable.

## Delivered

- Approved document applies and rollbacks now write a unique temporary file in the target directory and atomically rename it into place. The service re-validates the exact current contents immediately before that rename; it still rejects unsafe roots, traversal, hidden paths, symlinks, binary content, oversized files, and stale previews.
- Apply and rollback use deterministic internal idempotency keys and effect fingerprints. A repeated completed request reuses its durable result rather than performing a second filesystem effect; incomplete or durable failed effects return a conflict rather than retrying silently.
- Apply derives a deterministic rollback handle from the exact preview. Rollback requires that handle, so a request cannot revert a different preview or an unverified state.
- Append-only Wiki state events now retain the operation, idempotency key, effect fingerprint, rollback handle, and recorded time. Settings shows the compact rollback/effect receipt for the newest workspace changes.

## Boundary retained

Workspace writes remain disabled by default and require the existing explicit local opt-in, current approval, and code-verification gate for code paths. This slice does not grant agents arbitrary workspace writes, command execution, network access, live executor changes, or scheduler autonomy.

## Validation

- Focused API: 18 tests passed across reversible workspace, workspace routes, and effect idempotency.
- Focused Settings view: 1 test passed.
- Full API suite: 232 passed; 5 Mongo integration tests skipped by design.
- Full web suite: 30 passed.
- Production build passed. Vite retained its existing advisory that the web JavaScript chunk exceeds 500 kB.
- `git diff --check` passed.

## Next

Slice 6 should run only supervised code changes in isolated worktrees, record server-executed verification, and expose that lifecycle to the operator. It must consume the Slice 5 receipts rather than broaden the workspace-write authority.
