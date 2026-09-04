# QA acceptance-contract recovery

- Date: 2026-09-03
- Goal: stop QA from validating against a generic fallback when the PM has already emitted a concrete acceptance contract in Spanish.

## Evidence

The scope run `6a99ef4bbe27fd16f1e4b010` produced `## 3. Criterios de Aceptación` with four concrete criteria. The parser accepted only unnumbered English `Acceptance Criteria`, so it rejected the PM output and supplied a generic fallback to QA. This caused QA coverage to appear incomplete even when it returned detailed evidence.

## Change

- Acceptance-criteria extraction accepts English and Spanish headings, including numbered Markdown headings.
- PM validation uses the same extraction result rather than an English-only text check.
- QA therefore receives the frozen PM criteria exactly as issued; it is still prohibited from auto-approving incomplete evidence.

## Validation

- `CI=true corepack pnpm --filter @atellier/api exec vitest run src/test/agent-response-validator.test.ts src/test/daily-use-loop.test.ts` — 41 tests passed.
- `CI=true corepack pnpm --filter @atellier/api typecheck` — passed.
