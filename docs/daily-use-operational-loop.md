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
4. Every orchestration step receives the task title, description, status, verified source paths, and bounded read-only source contents as grounding.
5. Builder must include the complete result under `Requested Artifact`. Atellier validates it deterministically before spending Runtime or QA work.
6. Artifact-builder steps receive a larger output budget than ordinary agent steps. If deterministic validation still fails, Builder receives the exact issues and retries automatically as `repair-1` through `repair-3`; each repair generates only the missing entries, which Atellier merges with the prior `Requested Artifact` before revalidation. The first passing artifact continues to Runtime and QA; exhausting all three attempts stops the chain with `readiness: needs-human` and concrete blockers.
7. After deterministic validation passes, Runtime and QA inspect the artifact. QA receives the Scope acceptance criteria and must persist one `PASS` or `FAIL` item with concrete artifact evidence for each criterion. A malformed response gets up to two format retries. Only a complete checklist plus an explicit verdict may advance the loop. A valid `CHANGES REQUESTED` verdict triggers bounded semantic repair; materially repeated findings stop before the next repair and request human input. Wiki Curator runs only after explicit QA approval.
8. When the run completes, inspect its requested artifact, deterministic and semantic repair summaries, validation evidence, and the `Daily loop` chain in Review.
   Review shows the preserved artifact inline together with its source step, latest semantic attempt, and last completed QA. A failed latest repair is reported as a repair-attempt failure rather than implying that the preserved parent artifact disappeared.
9. Approve the run or request changes. Approval is blocked when the final artifact is invalid, either repair budget is exhausted, or final QA did not explicitly approve.
10. Choose **Capture memory**. Atellier writes one synthesis page, records the capture on the run, appends one Wiki log entry, and closes the linked task.

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
- Automatic repairs use stable child-step IDs (`repair-1`, `repair-2`, `repair-3`). A reclaimed or explicitly retried parent reuses completed attempts rather than duplicating them.
- Runtime, QA, and Wiki memory steps do not run when deterministic artifact validation remains blocked after the repair budget. The latest artifact and exact blockers remain reviewable on the parent run.
- Semantic repairs use stable `semantic-repair-N` and `qa-recheck-N` IDs. Recovery reuses them, and Wiki memory remains skipped until the latest QA verdict is `APPROVED`.
- QA contract retries use stable `qa-format-retry-N` IDs for initial QA and `qa-recheck-N-format-retry-M` IDs after semantic repairs. Malformed QA never becomes semantic feedback; bounded exhaustion preserves the artifact and blocks approval/memory for human input.
- The final QA checklist is persisted on the parent. Repeated normalized findings preserve first/repeated QA step lineage and block approval/memory without erasing the valid artifact.
- A worker reconciles `status: completed` plus `execution.phase: finalizing` atomically to terminal `completed`, clears stale lease metadata, and emits the terminal event once. This also repairs runs abandoned between business completion and envelope finalization.
- Semantic summaries persist `finalStepId`, `lastValidArtifactStepId`, and `lastQaStepId`. Completion rebuilds the review artifact from the newest persisted artifact-builder run that both contains `Requested Artifact` and passed deterministic validation; exhaustion still blocks approval even when an earlier valid artifact remains reviewable.
- Verified source contents are loaded from the immutable vault on each step with per-file and total context limits. Missing files stay listed as task provenance but are not treated as verified.
- Long requested artifacts are preserved with a larger downstream context allowance so Runtime and QA inspect the complete latest artifact rather than a truncated prefix.
- When the operator goal explicitly requires fields for every numbered day, artifact validation checks each day independently and reports exact missing day/field pairs. Semantic Builder repairs return only corrected day entries; Atellier replaces those entries in the last valid artifact and revalidates the merged result.
- Deterministic repairs for long numbered artifacts focus on at most five failing days per attempt. Each focused day is returned complete and replaces its prior entry, keeping a 14-day correction within the local model's bounded execution window.
- Repeating the same review status is a no-op and does not duplicate `Deliverable accepted` entries.
- Memory capture uses the irreversible-effect idempotency ledger with key `run-memory:<runId>` and a deterministic fingerprint. A completed result is reused rather than rewritten.
- The captured Wiki path, log path, summary, and timestamp are persisted on `Run.memory`; a later retry can reconcile the linked task to `done` without writing Wiki memory again.
- In-progress or failed irreversible effects fail closed. Inspect the effect record and filesystem before manual recovery; do not delete or overwrite raw sources.

## Validation

The deterministic API test `apps/api/src/test/daily-use-loop.test.ts` exercises ingest, linked-task creation, durable execution, terminal reconciliation, task status transitions, bounded source-content grounding, requested-artifact persistence, zero-repair success, repair success, three-attempt exhaustion, QA format retry/exhaustion, semantic gating, stable-step recovery, parent readiness validation, approval, idempotent review, idempotent memory capture, and persisted memory. Automated tests use deterministic executors and never call external LLMs, Codex, or MCP tools.
