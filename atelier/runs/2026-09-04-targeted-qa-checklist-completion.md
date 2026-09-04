# Targeted QA checklist completion — 2026-09-04

## Goal

Reduce local QA false stops without weakening Atellier's approval boundary. When QA supplies an explicit verdict but misses one or more frozen acceptance-criterion evidence lines, request only those missing lines once.

## Implementation

- Added `findMissingQaCriteria` to compare the frozen PM acceptance contract with parsed QA evidence.
- QA section parsing now collects repeated `Acceptance Checklist` sections, allowing a completion response to be merged with the original QA report without losing its verdict or existing evidence.
- The build loop now executes at most one `qa-checklist-completion-1` step after an explicit but incomplete verdict. Its prompt lists only missing criteria and forbids a full re-evaluation or verdict change.
- The child run stores the composed QA record: original verdict and evidence plus the returned missing entries.
- If the combined checklist is complete, normal approval or semantic-repair logic resumes. If it remains incomplete, the run stays `needs-human`; no generic format retries or semantic repairs are consumed.
- Dynamic orchestration status includes the completion step.

## Validation

```bash
CI=true corepack pnpm --filter @atellier/api exec vitest run src/test/agent-response-validator.test.ts src/test/daily-use-loop.test.ts
CI=true corepack pnpm --filter @atellier/api typecheck
```

Both commands passed: 43 focused tests and API TypeScript validation.

## Real local validation

Four sequential Ollama runs were observed after the implementation, all with a linked immutable source and `cheap` local profile:

| Run | Source | Outcome | Observation |
| --- | --- | --- | --- |
| `6a9a26e913b5ea2d30dc3105` | 14-day plan | needs-human | QA returned no readable verdict after two bounded format retries. |
| `6a9a289213b5ea2d30dc3124` | technical constraints | needs-human | Same malformed-QA mode; QA produced a plan instead of its verdict contract. |
| `6a9a2a8c13b5ea2d30dc3144` | context evaluation brief | needs-human | The new `qa-checklist-completion-1` path ran. The model returned the fallback criterion with nested `- Evidence:`; this exposed a parser gap. |
| `6a9a2b74d83cea04c0267583` | context evaluation brief | needs-human | Confirmation after the parser fix: nested evidence was parsed. QA nevertheless recorded substantive FAIL evidence against the generic readiness criterion, so the system correctly remained blocked. |

The final parser adjustment accepts a Markdown-bulleted nested `Evidence:`/`Evidencia:` line. Validation after that adjustment passed with 44 focused tests and API typecheck.

Interpretation: the targeted completion mechanism executes and preserves the safety boundary. The dominant live limitation is now QA instruction adherence by the small local model: two runs ignored the QA output contract entirely, while the two structured cases were correctly evaluated and blocked for missing or failed substantive criteria.

## Safety boundary

This does not infer PASS evidence, replace a QA verdict, or automatically approve work. Approval remains possible only when the composed checklist covers every frozen criterion and has no FAIL entries.
