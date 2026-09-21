# Evaluation Boundary and Workspace Read Tools

- Date: 2026-09-08
- Scope: first governed-learning and workspace-read slices of the agentic harness plan.
- External tools called: none.

## Delivered

- Terminal agent evaluations now append a v2 record for completed, failed, and cancelled runs while retaining the latest-record compatibility projection.
- Learning decisions bind to an exact candidate evidence digest, are exclusive and idempotent, and explicitly cannot activate policy, routing, trusted memory, or permissions.
- Settings exposes terminal failures/cancellations and lets an operator accept, reject, or defer a candidate with a required note.
- `workspace.read` and `workspace.search` are bounded read-only adapters. Their scope is fixed by the server; they reject traversal, symlinks, hidden paths, binary files, and oversized content.
- Durable parent orchestration attempts now append a separate terminal receipt after queue completion, reconciliation, failure, blocking, or cancellation. The receipt is scoped to execution retry-generation plus attempt, so an exact replay is idempotent and a manual retry receives new evidence even though its bounded attempt counter restarts.
- Candidate decisions are now listed as immutable history by candidate ID. A changed evidence digest returns the current candidate to pending review without hiding its prior reviewed evidence.

## Validation

- API typecheck passed.
- Web typecheck passed.
- Focused Tool Harness, durable-runtime lifecycle, and cancellation tests passed.
- Full API suite passed before the workspace-read slice; no test calls a real LLM, Codex, or MCP tool.

## Boundary

This work does not add workspace writes, arbitrary commands, external network access, automatic policy activation, trusted-memory promotion, or scheduler-driven autonomy.

## Follow-up

Add bounded experiment records before any shadow or canary experiment.
