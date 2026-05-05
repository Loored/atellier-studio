# Codex Memory Workflow

This workflow keeps Atellier's memory durable and low-noise across sessions.

Read with:

- `AGENTS.md`
- `CODEX_MEMORY.md`
- `docs/current-state-and-next-steps.md`
- `docs/next-work-plan.md`

## Goal

Keep operational memory useful for the next implementation session without turning `CODEX_MEMORY.md` into a full history log.

## Where Information Goes

- `CODEX_MEMORY.md`: compact active memory
- `docs/history/implementation-log.md`: long chronology
- `atelier/runs/*.md`: session run logs
- `atelier/wiki/log.md`: chronological durable events
- `atelier/wiki/sources/*.md`: source summaries

## End-Of-Session Checklist

1. Capture what changed in a run log under `atelier/runs/`.
2. Add one durable event to `atelier/wiki/log.md` with links to run log and relevant docs/files.
3. Update `CODEX_MEMORY.md` only when active memory changed:
   - setup/runtime
   - policies/preferences
   - architecture constraints
   - current priorities
   - repeat pitfalls
4. Move details that are mostly narrative into `docs/history/implementation-log.md`.
5. Update `docs/next-work-plan.md` if the implementation order changed.

## Writing Rules For `CODEX_MEMORY.md`

- Prefer bullets over long paragraphs.
- Keep each section actionable.
- Avoid duplicate details already covered in docs.
- Keep only currently relevant priorities.
- Replace stale notes instead of stacking many dated notes.

## Suggested Event Entry Shape (`atelier/wiki/log.md`)

```md
## [ISO_TIMESTAMP] decision | Short title

- Summary: What changed and why.
- Run log: atelier/runs/YYYY-MM-DD-topic.md
- Related docs: docs/path.md
```

## Suggested Run Log Shape (`atelier/runs/*.md`)

- Context
- Inputs
- Actions
- Decision
- Verification

## Practical Rule

If a future Codex session can make better decisions in under 2 minutes by reading it, keep it in `CODEX_MEMORY.md`. If not, store it in history or run logs.
