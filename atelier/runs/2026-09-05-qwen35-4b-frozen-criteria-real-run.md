# qwen3.5:4b Frozen-Criteria Real Run

**Date:** 2026-09-05  
**Parent run:** `6a9ba267ab62f0b41c87fbb6`  
**Model profile:** `standard` → `qwen3.5:4b`  
**Status:** Complete — `needs-human`; no approval was granted.

## Goal

Run a representative three-day operational-plan request through the real local Build Loop after introducing the frozen PM acceptance-criteria handoff.

## Observed execution

- Scope, Builder, automatic artifact repair, and Runtime all completed.
- The first Builder artifact referenced unverified files. The deterministic repair loop removed those references in one of three permitted attempts.
- QA produced three structurally invalid responses (initial response plus two bounded format retries), so the run stopped safely with `orchestration.qa_format_retries_exhausted`.
- The Context Receipt was frozen as `448b340f4010…` and persisted at `runs/context/6a9ba267ab62f0b41c87fbb6-memory-context.md`.

## Important findings

1. The operator requested a complete **three-day** plan. The evidence-only source described a historical fourteen-day plan; Scope incorrectly promoted that source above the operator request and framed a fourteen-day artifact as the vertical slice.
2. Builder/repair then produced an eight-day summary rather than the requested three-day plan. The deterministic reference validator repaired file-reference errors, but it cannot yet detect this semantic count/scope drift.
3. QA received an explicit checklist and exact output contract, yet `qwen3.5:4b` repeatedly rewrote the artifact instead of returning `Verdict`, `Findings`, and `Recommendation`. The bounded retry gate correctly prevented an unsafe approval.

## Outcome

The safety and observability contract behaved correctly: no invalid output was approved, repair telemetry was distinct from QA-format telemetry, and the terminal state explains the human intervention requirement.

The frozen-criteria handoff alone is not enough for this model under conflicting retrieved evidence. The next focused reliability slice should:

1. state and enforce that the operator goal takes precedence over evidence-only source material when their requested shape conflicts;
2. add deterministic requested-count/scope validation for concise numbered artifacts; and
3. make QA evaluation-only, with a short bounded context and a no-artifact-rewrite contract.

## Boundary

This was an authorized real local Ollama run, not a test. No external provider, commit, or model-profile escalation was used.
