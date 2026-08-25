# Review-to-memory learning loop

Atellier separates two operator decisions after a run is completed and approved:

1. **Capture memory** preserves the reusable run outcome in `wiki/synthesis/`.
2. **Curate learning** promotes one explicit lesson into the selected role's durable memory.

The second action is never automatic. The operator chooses the role, edits the lesson, and may attach one concrete Wiki curation signal.

## Operator flow

1. Complete and approve a run with reviewable evidence.
2. Choose **Capture memory** in Review.
3. In **Curate approved learning**, select the role that should retain the lesson.
4. Edit the proposed lesson so it captures a reusable operating pattern rather than a run transcript.
5. Optionally select `contradiction`, `stale`, or `needs-review` and point it at an existing `wiki/*.md` page.
6. Choose **Curate learning**.
7. Inspect the role node in Knowledge Graph or run Wiki lint to see the learning and any unresolved signal.

## Durable records

`POST /runs/:id/curate-learning` requires a completed, approved run with existing `Run.memory`. It writes:

- a human-readable entry in `wiki/role-memory/<role>.md`;
- a structured learning record under `Run.memory.learning`;
- an `Approved review learning curated` entry in `wiki/log.md`.

Role-memory Markdown is the durable knowledge source. `GET /knowledge/role-memory` parses those pages and combines the curated learnings with current agent/task/run statistics; it does not rely only on MongoDB.

## Curation signals

Signals are optional and must reference an existing Wiki Markdown page.

| Signal | Meaning | Graph quality |
| --- | --- | --- |
| `contradiction` | The approved lesson conflicts with the page. | `contradicted` |
| `stale` | The page may no longer reflect approved practice. | `stale` |
| `needs-review` | The page needs an operator decision. | `proposed` |

Signals appear deterministically in Wiki lint and therefore in Knowledge Graph. Curation does not silently edit or delete the target page; resolution remains a separate operator-reviewed action.

## Replay and recovery

- The irreversible effect uses key `run-learning:<runId>` and a fingerprint of the run, role, lesson, signal, and target path.
- An identical retry reuses the persisted outcome and does not append another role-memory entry or Wiki log event.
- A second request with different content fails with a conflict; one run cannot silently replace its approved lesson.
- In-progress or failed irreversible effects fail closed. Inspect the effect record, role-memory page, Wiki log, and `Run.memory.learning` before manual recovery.
- Captured generic memory remains valid even when the operator decides not to promote a role learning.

## Validation

`apps/api/src/test/review-learning.test.ts` covers approval/memory gates, durable Markdown, structured run metadata, exact replay, conflicting replay, lint signals, graph quality, and missing target rejection. Frontend tests cover the required API chain and the Review/Knowledge surfaces. Automated tests use memory storage and mock services only; they never call external LLMs, Codex, or MCP tools.
