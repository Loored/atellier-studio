# Real 4B QA Contract Recovery

- Date: 2026-09-10
- Result: artifact recovery hardened; QA model escalation remains
- Parent run: `6aa317d271b78524fc5c9851`
- Model profile: `standard` (`qwen3.5:4b`)

## Observed evidence

The real eight-step Build Loop completed its deterministic artifact repair in two attempts, but exhausted both QA format retries. The final repaired response contained a complete three-day artifact and passed deterministic validation. However, the light model introduced it with “Here is the corrected artifact” and omitted the exact `## Requested Artifact` heading. Validation accepted the response because the phrase appeared in prose, while final aggregation could not extract it and incorrectly reported both a missing artifact and missing validation evidence.

All three QA responses reproduced or summarized the artifact instead of emitting the required verdict and `AC-N` checklist. The system correctly refused to infer approval from narrative claims.

## Changes

- Artifact-builder responses now receive a conservative normalization before validation and persistence: only an explicit artifact introduction followed by a top-level Markdown title can gain the missing `## Requested Artifact` heading.
- Validation and completion aggregation therefore consume the same settled response.
- QA format retries now place a minimal, terminal output contract in the retry instruction, enumerate every frozen `AC-N`, and explicitly prohibit introductions, analysis, Day sections, artifact reproduction, and closing prose.
- Narrative phrases such as “Validation Status: PASSED” remain insufficient for approval.

## Verification

- API typecheck passed.
- Focused validator and daily-use tests passed: 51/51.
- Full `corepack pnpm ci:check` passed: API 252 passed / 5 Mongo opt-in skipped, web 31 passed, MCP 2 passed, and dev-local 7 passed; every workspace typecheck passed.

## Remaining runtime check

A second real run (`6aa31ba6863dfd4444f9630f`) loaded the reduced QA prompt. Builder needed one deterministic repair, but its complete response started directly with a Markdown plan title and no artifact-introduction phrase. That exposed a second heading-only variant, so normalization is now additionally allowed when the frozen goal requests N days and the response contains every explicit Day 1..N heading. The validator also rejects a missing extractable section even if “Requested Artifact” appears incidentally in prose. Focused verification after this hardening passed 52/52.

The same second run demonstrated that `qwen3.5:4b` ignored even the minimal terminal QA contract twice. This is now a genuine capability boundary: the next runtime experiment should route only structured QA to a stronger local profile (prefer `qwen3.5:9b`) or add provider-level constrained structured output. Do not increase unbounded retries or infer approval from narrative text.
