# Daily-use Operational Loop

## Purpose

Connect durable source provenance, a task, recoverable execution, human review, and reusable Wiki memory as one ordinary Atellier workflow.

## Reference chain

```text
raw source -> source summary -> linked task -> orchestration run -> deliverable/QA -> review -> synthesis memory
```

## Durable links

- A task created from Wiki ingest stores the immutable raw path and Wiki summary path in `sourceIds`.
- A parent orchestration stores `taskId`; every step is grounded with the task, verified source paths, and bounded read-only source contents.
- Build and automatic-repair steps must return a complete `Requested Artifact`; the latest artifact and final QA evidence are aggregated on the parent run.
- Deterministic artifact failures trigger at most three stable repair steps before Runtime and QA. Passing validation resumes the chain; exhaustion records `needs-human` readiness and exact blockers.
- Semantic QA repairs track the latest attempt, last deterministically valid requested artifact, and last completed QA independently. A malformed later attempt remains a blocker but cannot erase the reviewable artifact.
- Review renders that preserved artifact inline. Explicit per-day goal fields are validated day by day, and semantic patches replace only corrected day entries before the merged artifact is revalidated.
- Completion moves the task to `review`; requested changes return it to `active`.
- An approved capture persists `Run.memory` and moves the task to `done`.

## Approval and replay rules

- Wiki memory capture requires a completed, approved run.
- Parent approval is blocked when the requested artifact is missing, automatic repair is exhausted, or final artifact/QA evidence fails validation.
- Repeating a review decision does not append another acceptance entry.
- Repeating memory capture reuses the persisted result and does not rewrite the synthesis page or duplicate the Wiki log.
- Durable execution recovery keeps the parent `taskId` and definition snapshot, and reuses already completed child steps.
- Repair attempts use `repair-1` through `repair-3`, so replay and worker reclaim do not duplicate completed corrections.
- Semantic summaries persist `finalStepId`, `lastValidArtifactStepId`, and `lastQaStepId`; exhaustion still blocks approval and Wiki memory even when an earlier valid artifact remains reviewable.

## Operator contract

The operator sees the complete chain and readable requested artifact in Review before capturing memory. Aggregate validation alerts are deduplicated, writes remain explicit and approval-gated, and a finished task is not automatically reopened.

See `docs/daily-use-operational-loop.md` for the API/UI procedure, state transitions, and recovery guidance.
