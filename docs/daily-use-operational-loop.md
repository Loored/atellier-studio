# Daily-use operational loop

Atellier's reference daily workflow is now:

```text
source/input -> wiki summary -> linked task -> durable orchestration -> deliverable -> QA -> operator review -> wiki memory
```

The workflow keeps immutable source provenance, operational state, execution evidence, and reusable knowledge connected without relying on chat history.

## Operator flow

1. In Wiki, ingest a source. Atellier preserves the raw input and creates a source-summary page.
2. Choose **Create linked task**. The task stores both `rawPath` and `summaryPagePath` in `sourceIds`.
3. In Orchestration, choose the task from **Linked task**, enter the goal, and start a durable skill run.
4. Every orchestration step receives the task title, description, status, and verified source paths as grounding.
5. When the run completes, inspect its deliverable, validation evidence, and the `Daily loop` chain in Review.
6. Approve the run or request changes. Only an approved run can be captured as memory.
7. Choose **Capture memory**. Atellier writes one synthesis page, records the capture on the run, appends one Wiki log entry, and closes the linked task.

## State transitions

| Event | Run | Linked task |
| --- | --- | --- |
| Orchestration queued | `queued` | `active` |
| Orchestration completed | `completed`, review `pending` | `review` |
| Changes requested | review `changes-requested` | `active` |
| Approved | review `approved` | `review` |
| Approved memory captured | persisted `memory` metadata | `done` |

A `done` task is not silently reopened, and it cannot be selected for a new orchestration.

## Retry and recovery

- Durable orchestration recovery still uses leases and completed-step reuse. The task and source grounding are stored on the parent run, so a reclaimed worker receives the same context.
- Repeating the same review status is a no-op and does not duplicate `Deliverable accepted` entries.
- Memory capture uses the irreversible-effect idempotency ledger with key `run-memory:<runId>` and a deterministic fingerprint. A completed result is reused rather than rewritten.
- The captured Wiki path, log path, summary, and timestamp are persisted on `Run.memory`; a later retry can reconcile the linked task to `done` without writing Wiki memory again.
- In-progress or failed irreversible effects fail closed. Inspect the effect record and filesystem before manual recovery; do not delete or overwrite raw sources.

## Validation

The deterministic API test `apps/api/src/test/daily-use-loop.test.ts` exercises ingest, linked-task creation, durable execution, task status transitions, source grounding, approval, idempotent review, idempotent memory capture, and persisted memory. Automated tests use the mock executor and never call external LLMs, Codex, or MCP tools.
