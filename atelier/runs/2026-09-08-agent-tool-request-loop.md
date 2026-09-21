# Agent Tool Request Loop — 2026-09-08

## Goal

Allow an agent to use the bounded Tool Harness during a normal execution step without converting the executor into an unrestricted tool runner.

## Implemented contract

1. The model may return exactly one complete line: `TOOL_REQUEST: {"toolName":"…","input":{…}}`.
2. Atellier accepts this only when it is the entire response; examples or embedded prose are ignored.
3. The Tool Harness checks the tool, role, input boundary, and child-run parent before execution.
4. A compact receipt and run log are persisted.
5. Atellier makes one final model call with the bounded result and an instruction not to request another tool.

## Boundaries retained

- Only existing read-only registered adapters are callable.
- A second tool request is never resolved in the same agent step.
- No shell, network, workspace write, git, package, message, or external integration capability is exposed.
- Tests use a deterministic in-process executor and no external model/tool.

## Validation

- `corepack pnpm --filter @atellier/api test -- tool-harness.test.ts` — 6 passing tests.
- `corepack pnpm --filter @atellier/api typecheck` — passed.
- `git diff --check` — passed.

## Next

Normalize outcome and evaluation evidence before allowing any policy/model/retrieval learning experiment.
