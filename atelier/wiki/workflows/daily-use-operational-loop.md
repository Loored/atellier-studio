# Daily-use Operational Loop

## Purpose

Connect durable source provenance, a task, recoverable execution, human review, and reusable Wiki memory as one ordinary Atellier workflow.

## Reference chain

```text
raw source -> source summary -> linked task -> orchestration run -> deliverable/QA -> review -> synthesis memory
```

## Durable links

- A task created from Wiki ingest stores the immutable raw path and Wiki summary path in `sourceIds`.
- A parent orchestration stores `taskId`; every step is grounded with the task and its verified source paths.
- Completion moves the task to `review`; requested changes return it to `active`.
- An approved capture persists `Run.memory` and moves the task to `done`.

## Approval and replay rules

- Wiki memory capture requires a completed, approved run.
- Repeating a review decision does not append another acceptance entry.
- Repeating memory capture reuses the persisted result and does not rewrite the synthesis page or duplicate the Wiki log.
- Durable execution recovery keeps the parent `taskId` and definition snapshot, and reuses already completed child steps.

## Operator contract

The operator sees the complete chain in Review before capturing memory. Writes remain explicit and approval-gated. A finished task is not automatically reopened.

See `docs/daily-use-operational-loop.md` for the API/UI procedure, state transitions, and recovery guidance.
