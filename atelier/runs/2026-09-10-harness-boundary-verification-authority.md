# Harness boundary hardening — verification authority

**Completed:** 2026-09-10T06:52:08Z  
**Scope:** prevent client-authored verification from authorizing code writes and validate durable Control Bundle contents when read.

## Delivered

- The reversible workspace write path now applies only document previews. A preview below `apps/` or `packages/` is rejected before an effect claim can modify the primary checkout.
- The legacy client verification endpoint can no longer record a passing code result. Code validation authority belongs to the fixed server-run checks in the supervised worktree flow.
- Control Bundle reads validate the stored configuration shape, rebuild its canonical representation, recalculate its fingerprint, and verify that the record ID matches that fingerprint.

## Safety boundary

This hardening does not merge supervised worktrees or activate Control Bundles. Document writes still require the explicit local opt-in and a current approval. Code remains confined to the separately enabled supervised worktree lifecycle.

## Validation

- Focused API tests: 20 passed.
- Full API suite: 238 passed; 5 opt-in Mongo tests skipped by design.
- API typecheck passed.
- `git diff --check` passed.

## Next

Complete the real supervised worktree verification flow: make dependencies available without package installation, bind preparation to an explicit base revision, verify cancellation/verify-discard exclusion, and exercise both passing and failing fixed commands end to end.
