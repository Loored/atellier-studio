# Compact human calibration review — v1

Status: **pending operator adjudication**. This is not an approval of a model, campaign, memory promotion, or runtime policy.

## What is already checked by code

The deterministic evaluator replays all 24 fixtures in `scripts/evaluations/quality-calibration-v1.json` in API tests. It checks the 18 non-subjective outcomes: required blank-template structure, fact-report receipt availability, unsupported current operational identifiers, and self-referential/evidence failures.

## The only six human judgments needed

For each case below, answer only whether the artifact is a legitimate response to the stated goal even though the current deterministic evaluator correctly abstains (`unverified`). Mark **accept**, **reject**, or **needs revision**, followed by an optional one-line rationale.

| Case | Goal family | Proposed label | Operator decision | Rationale |
| --- | --- | --- | --- | --- |
| `procedure-valid-1` | Future procedure | legitimate / unverified | pending | |
| `procedure-valid-2` | Future procedure (Spanish) | legitimate / unverified | pending | |
| `procedure-valid-3` | Future procedure | legitimate / unverified | pending | |
| `proposal-valid-1` | Test proposal | legitimate / unverified | pending | |
| `proposal-valid-2` | Test proposal (Spanish) | legitimate / unverified | pending | |
| `proposal-valid-3` | Test proposal | legitimate / unverified | pending | |

## Freeze rule

After the six decisions are recorded, create a new immutable calibration revision with the operator decision, timestamp, and hash of the exact fixture file. Do not alter a fixture or its expected result to make a model pass. A disputed or revised item is excluded from the first calibration threshold rather than silently relabeled.

## Sealed-case protocol

The eight future campaign cases have deliberately **not** been authored yet. They must be authored only after this calibration revision and implementation are frozen. Their private rubric, expected response and audit must remain under the protected evaluation boundary; the evaluated Build Loop receives only its goal and permitted evidence. Any case opened during tuning is diagnostic-only and cannot be counted as holdout evidence.
