# Run: Agent Output Streaming

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `packages/shared`
- Trigger: Improve agent panel UX with live output while agent runs execute.

## Actions

- Added shared stream event contract `AgentRunStreamEvent`.
- Added API stream endpoint `POST /agents/:id/run/stream` using `text/event-stream`.
- Extended agent run service with streamed events for status, chunks, and final result.
- Added frontend SSE consumer in `agentsService.runStream`.
- Added API hook mutation for stream runs and query invalidation on completion.
- Updated pixel office agent panel hook/component to render live streaming output.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed
- `pnpm -r typecheck` passed

## Outcome

The agent panel now shows partial output in real time during run execution, while preserving existing persistence and run-log behavior.
