# Run: Runtime Integration Without Simulation

- Date: 2026-05-05
- Operator: Codex
- Scope: `apps/web`, `apps/api`, `README.md`, `atelier/wiki`
- Trigger: Remove runtime mock behavior and keep FED/BED integrated with real backend state.

## Actions

- Removed runtime orchestration simulation from office view:
  - deleted simulation toggle controls from bottom bar.
  - removed `useOrchestrationSim` usage so agent status is no longer mutated artificially by frontend timers.
- Kept backend executor integration-first:
  - API now auto-selects `openai` executor mode when `OPENAI_API_KEY` is present.
  - explicit `AGENT_EXECUTOR_MODE=mock` still works for controlled fallback.
- Updated service bootstrap defaults:
  - app services now prefer `openai` whenever `openaiApiKey` is provided.
- Updated README runtime behavior section to reflect real-mode-first execution.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Frontend no longer fabricates orchestration state, and backend defaults now favor real execution when credentials are available, improving end-to-end FED/BED integration fidelity.
