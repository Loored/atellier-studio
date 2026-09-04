# Trustworthy Live Runner

Date: 2026-08-28

## Goal

Make the real orchestration smoke runner distinguish technical completion from an operationally reviewable result.

## Implementation

- The runner evaluates the persisted parent run after orchestration polling settles.
- Build loops fail closed unless readiness, aggregate validation, and QA checklist evidence are complete.
- Text output summarizes validation, repairs, QA evidence, and blockers.
- `OUTPUT_FORMAT=json` provides a machine-readable final result.
- Stable exit codes distinguish success, failure, needs-human, and timeout.
- `RUN_ID` inspects an existing orchestration without spending another LLM execution.
- The stale health-badge default was replaced with a bounded three-day operating-plan goal.

## Validation

- Pure behavior tests cover successful, needs-human, missing-evidence, failed, and non-build outcomes.
- API typecheck passes.
- Existing run `6a91ef00b71d3ad93af71cbd`, previously described as successful, now returns `needs-human` because its parent evidence is `changes-required` with failed aggregate validation.
- Existing 14-day run `6a91efc0b71d3ad93af71dc8` returns `needs-human` with QA format exhaustion and its two concrete blockers.
- New Mongo/Ollama run `6a92085b0d2f0aff92f5226a` completed eight of nine visible steps, persisted a complete checklist with two passes and one failure, detected repeated QA feedback at `qa-recheck-2`, and returned exit code `2` instead of a false success.
- Final validation passed: API 156 tests (`3` opt-in Mongo tests skipped), Web 29 tests, all four workspace typechecks, and all four production builds.
- Vite retained its existing warning for the application chunk exceeding 500 kB.
