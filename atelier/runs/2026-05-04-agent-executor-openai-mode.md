# Run: OpenAI Executor Mode Integration

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `README.md`, `atelier/wiki`
- Trigger: Continue integration from local mock execution to configurable real LLM execution.

## Actions

- Refactored agent executor into mode-based implementation:
  - `mock` mode for local/dev/tests.
  - `openai` mode using `POST /v1/responses`.
- Added executor factory with explicit config validation for `OPENAI_API_KEY`.
- Wired executor mode into API bootstrap via env:
  - `AGENT_EXECUTOR_MODE=mock|openai`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (optional, default `gpt-5-mini`)
- Kept existing `POST /agents/:id/run` behavior stable so frontend and tests remain unchanged.
- Updated README with explicit OpenAI run command and env guidance.

## Validation

- `pnpm test:api` passed
- `pnpm -r typecheck` passed

## Outcome

Atellier Studio can now switch from simulation-backed execution to real OpenAI-backed execution without changing the route contract or frontend integration.
