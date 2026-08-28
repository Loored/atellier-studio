# Autonomous Repair Loop v1

- Date: 2026-08-25
- Status: complete
- Branch: `codex/knowledge-deliverable-grounding`
- Scope: bounded deterministic self-repair inside `atellier-build-loop`

## Goal

Reduce manual correction work without granting broad autonomous authority. Builder artifacts that fail deterministic validation should receive their exact blockers automatically, retry at most three times, and reach Runtime/QA only after passing the objective gate.

## Acceptance criteria

- Builder output is deterministically validated before Runtime and QA.
- Failed artifacts trigger `repair-1`, `repair-2`, and `repair-3` at most.
- Each attempt receives the latest response plus exact validation issues.
- Completed repair attempts are durable and reused after worker reclaim or explicit retry.
- A passing attempt resumes Runtime, final QA, and memory capture.
- Exhaustion skips downstream LLM work and records `readiness: needs-human` plus concrete blockers.
- Human approval and Wiki memory capture remain explicit.
- Orchestration status and the dashboard expose repair attempts and terminal repair evidence.

## Implementation evidence

- Shared orchestration contracts carry logical step ID, attempt number, attempt limit, and a parent repair summary.
- Child-run inputs persist the repair metadata alongside the stable `orchestrationStepId`.
- The build-loop executor uses a bounded loop with `AUTONOMOUS_REPAIR_MAX_ATTEMPTS = 3`.
- Parent completion evidence selects the latest Builder/repair artifact and requires final QA only after deterministic validation passes.
- The status endpoint expands real repair attempts into the visible timeline and omits downstream steps after exhaustion.
- The orchestration panel announces resolved/exhausted repair outcomes with textual, accessible evidence.
- Orchestration polling waits for both the terminal run status and terminal durable execution phase, preventing a stale `completed` + `finalizing` combination after the worker settles.

## Deterministic coverage

- Zero-repair success reaches QA and human review.
- One failed artifact is corrected by `repair-1` and reaches QA.
- Three failed repairs stop before Runtime/QA/memory with exact blockers.
- Explicit retry reuses all five completed child runs in the exhausted scenario and creates no duplicates.

## Validation

- API: 129 passed; 3 opt-in Mongo runtime tests skipped as expected.
- Web: 28 passed across 6 files.
- Typecheck: Shared, API, Web, and MCP passed.
- Local Mongo/browser flow: passed with executor override `mock`; Dashboard showed `completed`, `phase: completed`, attempts `3/3`, stable `repair-1..3` steps, the exact missing-day blocker, and durable completion event `#19`.
- Visual check: the repair alert is readable at the normal dashboard viewport, uses text in addition to color, and preserves the existing panel hierarchy/scroll behavior.

### Real Ollama soak — 2026-08-26

- Parent run: `6a8f628b15c66fcd155044e1` using Mongo persistence and Ollama (`llama3.1:8b`; Builder profile `qwen2.5-coder:7b`).
- The requested 14-day operating plan failed deterministic completeness validation after Build and all three bounded repairs.
- Every attempt stopped after Day 9; the final blocker explicitly reported missing Days 10–14.
- The parent finished with `readiness: needs-human`, `attemptsUsed: 3`, and `exhausted: true`.
- Runtime, QA, and memory steps were not executed after repair exhaustion.
- A direct approval attempt returned HTTP 409 with the exact completeness and exhaustion blockers.
- Review rendered the parent and child runs as validation failures, disabled Approve and Capture memory, and kept Request changes available.
- Operational conclusion: the autonomous control and safety gates work under the real local model. The next bounded slice should improve long-artifact generation capacity or chunking; increasing repair count would only repeat the same incomplete response pattern.

## Guardrails and remaining boundary

- The loop reacts only to deterministic validation errors; it does not yet reinterpret free-form QA findings as repair instructions.
- Maximum attempts are fixed and small to prevent runaway local-model work.
- Exhaustion requests human input instead of silently approving, retrying indefinitely, or writing approved memory.
- No external LLM, Codex, or MCP call is used in automated tests.
