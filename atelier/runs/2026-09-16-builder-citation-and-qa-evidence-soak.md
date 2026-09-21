# Builder citation and QA evidence soak — 2026-09-16

## Goal and runtime

Four sequential local Ollama Build Loops used the same 3-day agent-run review plan goal as the 2026-09-15 reference. Mongo and the existing durable worker were live. Host-level API/Ollama checks succeeded; sandbox-local curl had incorrectly suggested the services were down. No workers were killed and no runs overlapped. The parent runs remain pending operator review; none was auto-approved by the human.

| Parent run | Builder first pass | Deterministic repair | Semantic repair | Parent outcome | Measured child duration |
| --- | --- | ---: | ---: | --- | ---: |
| `6aaa3f0c4a2d67773e7c785c` | Invalid Wiki workflow path citation | 1, resolved | 0 | `ready-for-human-review`, QA 3/3 PASS | 397,240 ms / 6 children |
| `6aaa40d24a2d67773e7c7892` | Same invalid path citation | 1, resolved | 0 | `ready-for-human-review`, QA 3/3 PASS | 289,100 ms / 6 children |
| `6aaa425e5b8818dbfd4bfd12` | Valid on first pass | 0 | 0 | `needs-human`: QA APPROVED 3/3 but lexical evidence matcher rejected AC-1 | 160,442 ms / 4 children |
| `6aaa4364d22bb1293350ad6a` | Valid on first pass | 0 | 0 | `ready-for-human-review`, QA 3/3 PASS | 234,487 ms / 5 children |

## Findings and bounded corrections

The initial two 4B Builder outputs named `wiki/workflows/daily-use-operational-loop.md` even though the frozen citation-eligible list contained only `raw/ingest/2026-08-31-context-pack-evaluation-brief.md`. The trusted Wiki excerpt was available for reasoning but not citation; the validator correctly rejected the path. The Builder source contract now says that paths anywhere in its response count, including Candidate Files and prose, and that memory paths missing from the eligible list must not be reproduced. Knowledge-only Candidate/Changed Files are explicitly `- none`. The third and fourth real Builder outputs passed on the first pass with zero invalid paths. This is a two-run observation, not a statistical guarantee.

The third run exposed a separate QA aggregation false negative. QA's AC-1 evidence cited the real `#### Day 1`, `#### Day 2`, and `#### Day 3` headings, but the evidence matcher filtered short `Day N` tokens and found insufficient long-word overlap. A narrowly scoped path now recognizes two or more distinct numbered Day references only when QA mentions headings/sections and each referenced Day is an actual Markdown heading in the current artifact. Off-artifact references and historical context-pack-only evidence remain rejected. The third parent properly stayed `needs-human`; it was not retroactively approved. The fourth run passed the parent evidence gate with the same QA header phrasing.

## Verification and limits

Focused 22 API tests and API typecheck passed; full `corepack pnpm ci:check` passed across API, web, MCP, launcher, and workspace typechecks. No real models are used in tests. None of these four live Builders made a tool request, so the post-tool completion branch remains mock-tested only. The fourth artifact is ready for the operator to inspect, not automatically accepted as durable learning. Future measurement should sample varied goals and count first-pass validity, QA grounding, and time; do not weaken source authority to improve pass rates.
