# Operator-goal authority contract and real soak

- Date: 2026-09-15
- Scope: numbered Build Loop artifacts, PM/QA authority, current-artifact evidence
- Runtime: local Mongo durable worker and sequential Ollama 4B/9B

## Contract

At enqueue, the parent input freezes a versioned, hashed acceptance contract derived only from the current operator goal. For numbered artifacts, it fixes the exact Day count, explicitly named per-Day fields, and standalone-deliverable scope. PM may propose criteria but cannot replace these server-owned criteria with retrieved-memory tasks. Builder, Runtime, QA, and final completion consume the same goal-derived criteria. A QA `APPROVED` is withheld before Wiki memory and fails terminal validation if any required AC is missing or PASS evidence is not recognizable in the current Requested Artifact.

The evidence check is deliberately conservative lexical corroboration, not a semantic proof; human review remains the final approval boundary. Unnumbered goals retain the prior PM-derived criteria path.

## Real runs

| Parent | Outcome | Child work | Repairs | Finding |
| --- | --- | ---: | --- | --- |
| `6aa9b6506a8685b9c6fc12ad` | `ready-for-human-review` | 5 / 304,434 ms | none | AC-1/2/3 matched the frozen goal and QA cited current Day headings/fields; 4B 267,961 ms, 9B 36,473 ms. |
| `6aa9b7ae6a8685b9c6fc12cf` | `needs-human` | 5 / 201,747 ms | deterministic 3/3 exhausted | 4B first returned a `TOOL_REQUEST` rather than an artifact; subsequent repairs exposed a parser false-reference from Markdown Day-field bullets after `Sources Used: - none`. QA did not run. |
| `6aa9b8d67fb3a546fc42fda8` | `needs-human` | 8 / 320,899 ms | semantic 3/3 exhausted | Post-parser-fix Builder passed without deterministic repair. QA rejected a self-referential validation plan; bounded semantic repair could not resolve it. 4B 101,108 ms, 9B 219,791 ms. |

Aggregate: 18 measured child runs / 827,080 ms summed execution time. 4B handled 12 runs / 570,816 ms; 9B handled 6 runs / 256,264 ms. No QA format or checklist-completion retry was used.

## Parser correction

An exact `- none` ends a declared no-file section. Any following Markdown heading also ends extraction before Day-field bullets. Explicit unverified paths remain fail-closed. This removed the false repair loop seen in the middle run; the post-fix Builder run reached Runtime and QA.

## Remaining risk

The lightweight Builder can still return a tool request or produce a self-referential plan. The new authority contract prevents off-goal approval but does not guarantee artifact quality or semantic-repair success. Next work should target first-pass 4B artifact/tool-request reliability and the quality of semantic correction, with human review retained.

## Verification

- API typecheck and 62 focused tests passed after the parser fix. A further 20 focused tests passed after moving the evidence gate before Wiki memory.
- Full CI passed: all workspace typechecks, 271 API tests, 34 web tests, 2 MCP tests, and 7 launcher tests; 7 opt-in Mongo tests remained skipped.
