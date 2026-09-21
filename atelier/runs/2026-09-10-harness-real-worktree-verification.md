# Harness consolidation — real supervised worktree verification

**Completed:** 2026-09-10T07:11:00Z  
**Scope:** make the supervised code worktree reproducible, cancellable, mutually exclusive with discard, and verifiable against the real Atellier dependency graph.

## Delivered

- Worktrees are created from the exact resolved Git SHA rather than a second mutable `HEAD` lookup.
- Each disposable checkout prepares dependencies with fixed `pnpm install --offline --frozen-lockfile --ignore-scripts --package-import-method=copy`. No lifecycle scripts or network dependency resolution are allowed.
- Verification commands now report `completed`, `timed-out`, or `cancelled`. Cancellation terminates the command process group and persists a failed receipt with the termination reason.
- Verify and discard are mutually exclusive for the same worktree. Settings disables discard during verification and displays timeout/cancellation evidence.
- Discard handles Git's partial-removal behavior: after confirming the worktree is no longer registered, it removes only the previously canonicalized destination under the dedicated worktree parent.

## Real validation

A temporary local clone of Atellier prepared its complete dependency graph offline, ran the real API typecheck from a detached worktree, and discarded the worktree successfully.

- Base revision: `658ee67e1d7373650a14aea573f04775a6490af4`
- API typecheck: exit `0`, termination `completed`, 5.8 seconds
- Temporary clone and worktree: removed after validation

The first real discard exposed a residual `node_modules` directory after Git had already unregistered the worktree. The cleanup logic was corrected and the complete validation then passed.

## Automated validation

- Full API suite: 240 passed; 5 opt-in Mongo tests skipped by design.
- Full web suite: 30 passed.
- Recursive typecheck passed.
- The real Git fixture covers successful, failed, and cancelled fixed commands plus exact base-SHA binding.
- The route fixture covers verify/discard exclusion.

## Next

Add restart reconciliation for document writes and supervised worktrees so an interruption between filesystem action, effect receipt, and Wiki event can be recovered deterministically.
