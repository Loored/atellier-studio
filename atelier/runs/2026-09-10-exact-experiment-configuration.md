# Exact Experiment Configuration Binding

- Date: 2026-09-10
- Scope: Evaluation Ledger pairing and Control Bundle proposal authority
- Result: completed
- External tools called: false

## Objective

Prevent experimental evidence from authorizing a configuration that was not actually tested, and prevent a terminal evaluation receipt from being counted more than once.

## Implemented

- Experiment-eligible Evaluation Ledger receipts carry an exact 64-character configuration fingerprint.
- Every evidence pair persists both baseline and shadow configuration fingerprints inside its canonical fingerprint.
- Baseline and shadow must be different configurations; all baseline pairs in one experiment must share one configuration and all shadow pairs must share one configuration.
- A run/evaluation receipt may belong to only one evidence pair across experiments.
- A Control Bundle proposal is accepted only when its bundle fingerprint exactly equals the consistent shadow configuration fingerprint.
- Existing receipts without configuration provenance remain valid historical evaluations but fail closed as experiment evidence.

## Safety boundary

This change governs evidence only. It does not activate a bundle, consume a canary budget, alter routing, or synthesize configuration provenance for old receipts. Runtime consumption will supply the fingerprint in the next slice.

## Validation

- `corepack pnpm --filter @atellier/api exec vitest run src/test/tool-harness.test.ts`
- `corepack pnpm -r typecheck`
- `corepack pnpm test:api` — 245 passed, 5 Mongo opt-in skipped
- `corepack pnpm test:web` — 30 passed
- `git diff --check`

## Next

Consume reserved canary budgets in the runtime so terminal evaluation receipts receive their configuration fingerprint from server-owned execution state rather than caller-authored test fixtures.
