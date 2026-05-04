# Run: Agent Terminal Handoff Command

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/web`, `atelier/wiki`
- Trigger: Operators needed a faster way to delegate work without leaving terminal mode in the agent panel.

## Actions

- Extended `useAgentDetailPanel` terminal command parsing with:
  - `handoff <agent-name-or-id> :: <instruction>`
- Added target resolution by:
  - exact `agent.id` match
  - partial name match (case-insensitive)
- Added terminal usage and feedback messages:
  - explicit usage on malformed command
  - not-found error when no target matches
  - success confirmation when handoff is queued
- Reused existing run stream path so handoff command delegates through the same validated run lifecycle.

## Validation

- `pnpm test:web` passed
- `pnpm typecheck` passed

## Outcome

Panel terminal mode now supports direct delegation, reducing friction to trigger orchestration flows during active supervision.
