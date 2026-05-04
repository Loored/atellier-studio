# Run: Agent Panel Unblock and Interactive Terminal

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/web`, `atelier/wiki`
- Trigger: Agents felt stuck in blocked/waiting states and `Open Agent Terminal` had no behavior.

## Actions

- Added explicit panel controls to recover agents from blocked/waiting:
  - `Resume` button in toolbar when status is `blocked` or `needs-human`.
  - Resume sets agent status back to `idle` via API mutation.
- Implemented interactive in-panel terminal:
  - Toggle with `Open/Hide Agent Terminal`.
  - Command input + live command log.
  - Commands:
    - `help`
    - `status`
    - `unblock` / `resume`
    - `clear`
    - `run <instruction>`
    - `set-status <status>`
- Improved status semantics in panel UI:
  - `needs-human` now renders as a waiting state, distinct from hard blocked.
- Added stream/error reset behavior when resuming or starting new runs to avoid stale error lock-in.

## Validation

- `pnpm --filter @atellier/web typecheck` passed
- `pnpm test:web` passed
- `pnpm test:api` passed

## Outcome

Operators can now unblock and steer agents directly from the panel, with a functional terminal-like interaction surface instead of a passive button.
