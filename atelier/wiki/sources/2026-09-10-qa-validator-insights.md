# QA Validator Measurement Insights

- Source: `raw/2026-09-10-qa-validator-insights.md`
- Type: engineering review
- Date: 2026-09-10
- Trust: evidence-only external review, verified against repository code

## Summary

The QA validator conflated three states: a criterion paraphrased by the model, a genuinely omitted criterion, and a present criterion lacking evidence. This inflated apparent `qwen3.5:4b` adherence failures and could spend the one targeted completion attempt unnecessarily.

## Repository verification

- Exact normalized string-set comparison was present in criterion coverage.
- Checklist entries without evidence were discarded during parsing.
- An explicit `FAIL` without evidence could bypass evidence completion and enter semantic repair.

## Resolution

- New QA prompts assign stable `AC-N` identifiers and require their reproduction.
- Legacy/no-ID responses use conservative token matching with exact numeric and negation guards.
- Missing-evidence lines remain in the parsed checklist.
- Omitted criteria and criteria without evidence are persisted separately.
- A verdict is usable only when the required matched entries have evidence; evidence-free failures receive the bounded completion step first.

## Boundary

This does not loosen approval. Evidence remains mandatory, IDs cannot cross-match, numeric differences and negation differences fail closed, and one checklist entry cannot satisfy multiple criteria.
