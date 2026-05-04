# Run: Agent Run Execution Spine

- Date: 2026-05-04
- Operator: Codex
- Scope: `packages/shared`, `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Move from simulated agent activity to a real local execution loop with persistent chat history and traceable run logs.

## Inputs

- Current product state: Pixel office orchestration was visual/simulated, without real instruction execution.
- Constraints: no external LLM calls in tests, local-first architecture, service -> API hook -> feature hook -> component chain.

## Actions

- Added shared contracts for persistent agent messages and run execution payloads/results.
- Added backend message persistence service and Mongo model (`Message`), with in-memory fallback.
- Added backend `POST /agents/:id/run` endpoint for instruction execution orchestration.
- Added backend `GET /agents/:id/messages` endpoint for agent-scoped chat history.
- Added mock `AgentExecutorService` to execute instructions locally without external providers.
- Wired run lifecycle updates: create running run, append execution logs, complete run, and status transitions.
- Connected frontend API layer and feature hook for run execution and message history retrieval.
- Updated pixel office `AgentDetailPanel` to execute real runs and render persisted chat history.
- Updated runs timeline to show latest log line for each run card.
- Added API integration test coverage for `/agents/:id/run` and message persistence.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed
- `pnpm -r typecheck` passed

## Outcome

Atellier Studio now has an operational execution spine where an agent can receive an instruction, produce a persisted assistant response, update run logs, and expose traceable history in the UI.
