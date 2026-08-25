# Review-to-memory Learning Loop

## Purpose

Turn a human-approved run outcome into reusable role-specific knowledge without allowing silent autonomous Wiki edits.

## Reference chain

```text
completed run -> operator approval -> synthesis memory -> explicit role learning -> optional lint signal -> operator resolution
```

## Durable links

- `Run.memory` points to the captured synthesis page.
- `Run.memory.learning` records the selected role, lesson, optional signal, role-memory page, Wiki log, and timestamp.
- `Run.memory.learning.resolution` records an explicit `resolved` or `dismissed` outcome, the operator note, and resolution timestamp.
- `wiki/role-memory/<role>.md` is the human-readable durable source used by the role-memory read model.
- Optional `contradiction`, `stale`, and `needs-review` signals reference an existing Wiki page and surface through Wiki lint and Knowledge Graph.

## Approval and replay rules

- Role learning requires a completed and currently approved run with captured memory.
- Capture and curation are separate explicit actions.
- An identical retry is idempotent; different content for an already-curated run is rejected.
- A signal never edits its target page. The operator resolves or dismisses it from Review with a required decision note.
- Resolution appends to the same role-memory page, removes only the matching finding from active lint, and remains visible as history.

See `docs/review-memory-learning-loop.md` for the API contract, operator steps, graph mapping, and recovery guidance.
