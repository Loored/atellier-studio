# Run: Auto Deliverables and Approval Log

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `atelier/wiki`
- Trigger: Continue workflow completion by generating deliverables automatically and logging explicit approval decisions.

## Actions

- Added wiki write capability in `WikiService`:
  - `writePage(relativePath, content)` with atelier-root path safety checks.
  - ensured `wiki/deliverables` directory is created during wiki bootstrap.
- Added automatic deliverable generation in `RunService.complete`:
  - when `summary` exists and `deliverablePath` is omitted, generates `wiki/deliverables/<runId>-<slug>.md`.
  - writes markdown content with run metadata, summary, and JSON output snapshot.
- Added explicit approval decision logging:
  - on `reviewStatus=approved` (completion default or review update), appends `decision | Deliverable accepted` to wiki log.
- Expanded API tests for:
  - auto-generated deliverable path and previewable file content.
  - approval decision entry in wiki log after review update.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Runs now produce durable deliverable artifacts by default and leave explicit audit signals when outcomes are approved.
