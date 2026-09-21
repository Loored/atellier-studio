# Lightweight QA Measurement Fix

- Date: 2026-09-10
- Result: completed
- Source: `raw/2026-09-10-qa-validator-insights.md`
- External model calls: none

## Outcome

The QA contract now distinguishes conservative paraphrase matches, actual omissions, and present criteria without evidence. Stable `AC-N` identifiers are the primary matching contract; bounded semantic matching exists only for prior/no-ID responses.

## Safety properties

- Each checklist item can match at most one frozen criterion.
- Explicit `AC-N` mismatches fail rather than falling back to text similarity.
- Numeric tokens and negation must agree.
- At least two meaningful tokens and a 0.60 containment score are required for legacy paraphrases.
- Evidence remains mandatory for an approved checklist or actionable changes-requested verdict.

## Validation

- `corepack pnpm test:api`: 247 passed, 5 Mongo opt-in skipped.
- `corepack pnpm test:web`: 30 passed.
- `corepack pnpm -r typecheck`: passed.
- Regression examples cover `The API endpoint returns a 200 status` versus `The API returns 200`, evidence absence, stable AC IDs, omission, and exact coverage.

## Review

- Blockers: none.
- Important fixes: the evidence-free `FAIL` path was corrected during review so it cannot skip checklist completion.
- Nice to have: run one representative real local 4B evaluation after step 5 runtime budget wiring, using the same frozen criteria and collecting the new telemetry.
