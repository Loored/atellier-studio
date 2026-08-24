# Execution Safety and Controlled Codex Adapter

- Started: `2026-08-24T09:20:48.000Z`
- Completed: `2026-08-24T09:45:24.000Z`
- Branch: `codex/execution-safety-adapter`
- Status: completed
- Process: parallel Atellier build loop with provider, idempotency, and Codex adapter workstreams

## Goal

Close Durable Runtime hardening v1.1 and introduce the first controlled real Codex Worker adapter without weakening the existing approval flow.

## Workstreams

1. Propagate cancellation to supported provider requests through `AbortSignal`, with cooperative step-boundary cancellation as fallback.
2. Require durable idempotency keys before irreversible tool effects can execute or be retried.
3. Replace fake-only Codex Worker execution with a feature-flagged local adapter constrained by working directory, command allowlist, approval, timeout, and evidence capture.

## Guardrails

- No real external LLM or Codex calls in automated tests.
- No dangerous bypass flags or unrestricted shell execution.
- Keep real Codex execution disabled by default.
- Preserve the existing operator approval and evidence surfaces.
- Keep each workstream in a distinct commit on the same branch.

## Validation

- Provider cancellation coverage: 10 focused tests passed across provider adapters, agent-run cancellation, and durable lifecycle behavior.
- Irreversible-effect idempotency coverage: 9 focused tests passed for claim, reuse, conflict, in-progress, and failed-effect behavior.
- Controlled Codex adapter coverage: 9 focused tests passed for opt-in, fixed command envelopes, path confinement, approval, evidence, timeout, output bounds, cancellation, and protected retry.
- Full API suite: 115 tests passed; 3 Mongo opt-in tests skipped by default.
- Full web suite: 22 tests passed.
- Shared, API, web, and MCP typechecks passed.
- Shared, API, web, and MCP production builds passed. The existing Vite chunk-size warning remains non-blocking.
- The installed `codex exec --help` contract was checked locally; it supports the configured workspace sandbox, automatic review, working-directory, and ephemeral flags without starting a Codex task.
- No real external LLM or Codex process was invoked by automated tests.

## Results

1. Provider requests now receive the durable run's `AbortSignal`. Operator cancellation aborts active supported providers immediately while step-boundary polling remains the fallback.
2. Irreversible effects now require a durable idempotency key and fingerprint. Atomic claims prevent duplicate execution and deterministic states govern reuse, conflicts, in-progress attempts, and failed attempts.
3. Codex Worker now supports an explicit, disabled-by-default real adapter with fixed no-shell commands, repository confinement, native timeout/cancellation, bounded output, fresh approvals for retries, and persisted evidence. Health and dashboard surfaces make fake versus real mode visible.

## Commits

- `ac47a10` — provider cancellation propagation.
- `12113b5` — irreversible-effect idempotency.
- Controlled real Codex adapter, UI, docs, and this run record are isolated in the third commit on the branch.

## Review

- Blockers: none.
- Important fixes resolved before completion: cancellation result race, strict sequential step execution, and protected retry exposure in the UI.
- Follow-up candidates: automatic monitored-run drain and recovery policy for a real Codex child process abandoned by a host crash.

## Next

Proceed with step 4, the daily-use operational loop, then step 5, review-to-memory completion.
