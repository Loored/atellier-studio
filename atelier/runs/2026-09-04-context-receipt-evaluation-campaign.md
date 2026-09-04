# Context Receipt evaluation campaign — 2026-09-04

## Scope

Ten real, sequential local `atellier-build-loop` evaluations were executed against durable tasks and sources. Each orchestration was allowed to finish through its bounded validation and repair paths. This is an operational measurement, not a synthetic unit-test result.

## Results

| Measure | Result |
| --- | --- |
| Terminal orchestrations | 10 / 10 |
| Automatic Context Receipt: supported | 7 |
| Automatic Context Receipt: partial | 1 |
| Automatic Context Receipt: unverified | 2 |
| QA format retries exhausted | 3 |
| Explicit QA verdict but incomplete checklist evidence | 5 |
| Structured QA accepted without a format retry | 2 |
| Semantic repair entered | 3 |
| Ready for human review | 0 |

## Evidence

| # | Orchestration | Context receipt | Terminal observation |
| --- | --- | --- | --- |
| 1 | `6a98f7bbb36aadc1c8145938` | unverified | QA format retries exhausted. |
| 2 | `6a98fe55b36aadc1c8145945` | supported | Explicit verdict, but no complete checklist evidence. |
| 3 | `6a99045ab36aadc1c8145952` | supported | Explicit verdict, but no complete checklist evidence. |
| 4 | `6a99d8c5b36aadc1c8145967` | partial | Explicit verdict, but no complete checklist evidence. |
| 5 | `6a99ef3cb36aadc1c8145974` | unverified | Semantic repair entered; QA recheck format retries exhausted. |
| 6 | `6a99f36f4472df3583e7a6b8` | supported | Structured QA was accepted; semantic feedback remained unresolved. |
| 7 | `6a9a184f4472df3583e7a6c5` | supported | Explicit verdict, but no complete checklist evidence. |
| 8 | `6a9a19cc4472df3583e7a6d2` | supported | Explicit verdict, but no complete checklist evidence. |
| 9 | `6a9a1b2e4472df3583e7a6df` | supported | QA format retries exhausted. |
| 10 | `6a9a1f154472df3583e7a6ef` | supported | Structured QA was accepted; semantic repair did not close the required artifact sections. |

## Interpretation

The citation contract works materially better than the preceding historical backfill: seven runs supplied enough explicit, relevant source references for a supported automatic receipt. The two unverified outcomes demonstrate that the contract cannot make a weak or truncated artifact traceable by itself; the source list must survive in the produced artifact.

The principal remaining constraint is QA fidelity, not retrieval. The localized verdict and acceptance-criteria parsing removed needless retries when the model supplied recognizable Spanish structure. However, most QA outputs still omit the full criterion-by-criterion evidence contract. The system safely routes those runs to human review rather than guessing approval. The two structured QA cases reached semantic repair correctly, but the builder did not fully address the substantive feedback.

## Recommended next slice

Make the QA handoff mechanically checkable before another broad campaign:

1. Preserve the frozen acceptance criteria as an explicit checklist template in the QA prompt and validate one evidence line per criterion.
2. When a structured QA response is incomplete, request only the missing checklist entries rather than regenerating the entire report.
3. Ensure semantic repair prompts include the original requested artifact sections and the exact unresolved criteria, then measure whether a repair closes them.

This keeps the safety boundary intact while targeting the observed failure mode directly.
