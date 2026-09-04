# Localized QA contract recovery

- Date: 2026-09-02
- Goal: preserve actionable local QA feedback when the Ollama model uses Spanish QA headings.

## Observation

The direct Context Receipt run `6a98aa85283b07ef880adea5` returned actionable Spanish QA output, including `Veredicto: CAMBIOS SOLICITADOS`, checklist evidence, and findings. The parser accepted English-only labels, so it treated the response as a format error, spent the bounded format retries, and blocked the parent despite usable feedback.

## Change

- QA verdict extraction accepts English and Spanish verdicts: `APPROVED` / `APROBADO` and `CHANGES REQUESTED` / `CAMBIOS SOLICITADOS`.
- It also accepts a verdict heading followed by its status on the next line, such as `## Veredicto` then `**CAMBIOS SOLICITADOS**`, which was observed in the first live validation after the initial localization fix.
- Checklist extraction accepts English or Spanish headings and `Evidence` / `Evidencia` labels.
- Repeated-feedback detection reads `Findings` or `Hallazgos`.
- The approval boundary remains unchanged: approval still requires a complete all-PASS checklist; malformed or ungrounded QA still stops safely as `needs-human` after bounded retries.
- When QA supplies a readable verdict but omits the required checklist evidence, the loop now skips format retries and reports the exact missing-evidence blocker as `needs-human`. This avoids treating a semantic evidence gap as a malformed verdict or producing two redundant QA calls.

## Validation

- `CI=true corepack pnpm --filter @atellier/api exec vitest run src/test/agent-response-validator.test.ts src/test/daily-use-loop.test.ts` — 40 tests passed.
- `CI=true corepack pnpm --filter @atellier/api typecheck` — passed.

## Next evidence

Run one short real local orchestration and confirm the standalone Spanish verdict form also reaches semantic repair/recheck without exhausting QA-format retries.
