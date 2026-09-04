# Long Artifact Generation and Incremental Repair

- Date: 2026-08-26
- Status: complete
- Branch: `codex/knowledge-deliverable-grounding`
- Scope: output budget, incremental deterministic repair, and complete downstream artifact context

## Goal

Prevent long requested artifacts from repeating the same truncated prefix across bounded repairs while preserving deterministic validation, durable evidence, and human approval.

## Implementation

- Added a per-execution output-token budget to provider calls.
- Assigned 2048 tokens to orchestration steps using the `artifact-builder` profile; other steps keep the 1024-token default.
- Changed repair instructions to request only entries named by the latest deterministic blockers.
- Merged repair patches with the prior `Requested Artifact` before validation, message persistence, and parent deliverable selection.
- Increased bounded previous-output context so Runtime and QA receive the complete long artifact.

## Automated validation

- API typecheck passed.
- API suite passed: 131 tests; 3 opt-in Mongo contention tests skipped as expected.
- Focused coverage verifies provider token budgets, requested-artifact merging, incremental repair success, bounded exhaustion, recovery reuse, and approval gating.
- Automated tests use deterministic executors and make no real external LLM calls.

## Real Ollama evidence

- Parent run: `6a8f6b4a1e35355494d1eac2`.
- Mongo + Ollama with Builder model `qwen2.5-coder:7b` produced explicit Day 1 through Day 14 in Build.
- Deterministic completeness validation passed with `attemptsUsed: 0`, `resolved: true`, and `exhausted: false`.
- Runtime, QA, and Wiki Curator all executed.
- QA returned `CHANGES REQUESTED`: its initial missing-days claim exposed downstream context truncation, which this slice then corrected; its remaining activity-specificity, evidence-classification, and human-approval findings are semantic quality issues.

## Remaining boundary

Deterministic repair handles structural blockers only. Turning free-form QA findings into safe, bounded semantic repairs requires a separate QA-to-Builder loop with exact artifact handoff, attempt limits, and unchanged human approval boundaries.
