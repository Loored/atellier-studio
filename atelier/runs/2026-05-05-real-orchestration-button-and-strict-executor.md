# Run: Real Orchestration Button and Strict Executor

- Date: 2026-05-05
- Operator: Codex
- Scope: `apps/web`, `apps/api`, `README.md`, `atelier/wiki`
- Trigger: Restore orchestration button with real behavior and continue with strict real-runtime policy.

## Actions

- Restored office orchestration button with real backend integration:
  - Added `useOrchestrationLive` hook.
  - When enabled, it periodically triggers real `run agent` API calls for eligible idle/done agents.
  - No frontend status simulation or timer-based fake status mutations.
- Applied strict runtime executor policy:
  - API now requires `OPENAI_API_KEY` for normal local runtime unless `AGENT_EXECUTOR_MODE=mock` is explicitly set.
  - Prevents accidental fallback to fake execution when real integration is expected.
- Updated service-mode defaults:
  - App services prefer OpenAI mode automatically when key is present.
- Updated README to reflect strict real-mode-first runtime.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

Orchestration controls are back and now execute real backend work, while runtime defaults enforce integrated behavior unless mock mode is deliberately requested.
