# Harness governance — Slice 6 supervised code worktrees

**Completed:** 2026-09-10  
**Scope:** execute an approved code preview only in an isolated worktree, run a fixed server-side verification plan, and retain an operator-visible lifecycle.

## Delivered

- A new explicitly opt-in supervised-code-change service accepts only an approved preview under `apps/` or `packages/`. It creates a detached disposable Git worktree alongside the repository, applies the preview there, and never writes or merges the primary checkout.
- Verification uses fixed `shell: false` command envelopes: API or web typecheck plus the matching API or web test suite; package previews receive all four. The operator and models cannot supply commands, arguments, paths, branches, or a merge target.
- Each prepare, verification, and discard action is effect-idempotent. Server output is bounded, persisted under `atelier/runs/artifacts`, and linked from append-only Wiki verification receipts.
- Settings now exposes the supervised-worktree lifecycle: prepare an approved code preview, run the bounded server checks, inspect passed-check counts and base revision, then discard the worktree. Failed verification remains evidence; it requires a new reviewed preview rather than an invisible retry.

## Boundary retained

- `ATELLIER_SUPERVISED_CODE_CHANGES_ENABLED` defaults to `false`.
- No arbitrary commands, input-controlled working directories, package installation, branch creation, commits, merges, network action, or primary-checkout write was added.
- The existing direct reversible-write path remains separate and disabled by default. This worktree flow cannot activate routing, tools, model budgets, scheduler autonomy, or the Codex Worker.

## Validation

- Focused supervised worktree route tests: 2 passed, including disabled default, primary-checkout isolation, durable server receipts, reuse, and discard.
- A real Git integration test creates a temporary repository and detached sibling worktree, mutates only that worktree, confirms the primary checkout is unchanged, and confirms `git worktree remove` removes it.
- Full API suite: 236 passed; 5 Mongo integration tests skipped by design.
- Full web suite: 30 passed.
- Recursive typecheck and production build passed.
- `git diff --check` passed.
- Vite retains its existing advisory for a web JavaScript chunk above 500 kB; no build error occurred.

## Next

Use the new evidence boundary in the next hardening pass: inspect route/input validation and MCP retrieval-policy parity, then add deterministic CI checks. Do not connect the worktree result to automatic merge or agent-controlled command execution.
