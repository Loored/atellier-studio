# Run: Agent Handoff MVP

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `packages/shared`
- Trigger: Continue implementation after streaming by enabling real handoff between agents.

## Actions

- Extended `RunAgentInput` with optional handoff fields:
  - `handoffAgentId`
  - `handoffInstruction`
- Added backend handoff flow in `AgentRunService`:
  - Appends source run handoff log.
  - Creates second run for target agent.
  - Persists handoff system/user messages for target agent.
  - Executes target agent with accumulated context.
  - Completes target run and updates target agent status.
- Kept streaming path compatible; handoff output is appended to live stream chunks.
- Added API test coverage for handoff execution and persisted messages.
- Added UI controls in agent panel:
  - Select handoff target agent.
  - Optional handoff instruction input.
  - Payload wired through stream execution route.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed
- `pnpm -r typecheck` passed

## Outcome

Agents can now pass execution to another agent with context, creating chained runs and persistent handoff trace in logs/messages.
