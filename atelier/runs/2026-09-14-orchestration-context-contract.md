# Central orchestration context contract

- Date: 2026-09-14
- Scope: context and generation budgets
- Result: implemented and verified

## Change

The orchestration context contract now lives in one module with explicit versioning and units:

- prior-step aggregate: 24,000 characters;
- ordinary step response: 1,200 characters;
- artifact step response: 16,000 characters;
- QA artifact handoff: 7,000 characters;
- artifact-builder output: 2,048 tokens;
- semantic-repair output: 1,024 tokens.

The module owns the stable truncation marker, structured-reference rendering, newest-first bounded selection, and artifact lookup. Execution retry limits remain in the orchestrator because they are control policy rather than context policy.

## Correctness improvement

The aggregate selector now accounts for the two-character separator between entries and for the truncation marker itself. Its output cannot exceed the published 24,000-character budget, including the smallest remaining-budget edge case.

## Verification

- Four direct contract tests cover published values, rendering, metadata-based artifact selection, and exact bounded truncation.
- All 17 daily-use loop tests pass with the same model-facing context behavior.
- API typecheck and diff hygiene pass.
