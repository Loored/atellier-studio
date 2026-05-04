# Run: Agent Handoff Policy Guardrails

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `README.md`, `atelier/wiki`
- Trigger: Continue after handoff MVP to prevent runaway chains and improve cost/latency safety.

## Actions

- Added execution policy controls in `AgentRunService`:
  - `maxHandoffDepth` (default `1`)
  - `executionTimeoutMs` (default `45000`)
- Added guard behavior:
  - Skip handoff when max depth reached.
  - Skip circular handoff targets.
  - Emit run logs describing skipped policy decisions.
- Added timeout wrapper around executor calls so stalled runs fail predictably.
- Wired policy settings through API bootstrapping via env:
  - `AGENT_MAX_HANDOFF_DEPTH`
  - `AGENT_EXECUTION_TIMEOUT_MS`
- Updated README with policy env docs and removed accidental plaintext API key example.

## Validation

- `pnpm test:api` passed
- `pnpm -r typecheck` passed

## Outcome

Agent orchestration now has explicit cost and reliability guardrails for chained runs, with stable defaults and runtime configurability.
