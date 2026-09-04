# Durable Local Runtime v1

- Date: 2026-08-24
- Branch: `feat/durable-local-runtime`
- Base: `dev/1.0.0`
- Status: completed locally; not committed or pushed

## Goal

Replace process-memory orchestration dispatch with a restart-safe local runtime while preserving Atellier's private/local-first scope and existing agent/provider spine.

## Scope delivered

- Added a versioned execution envelope to orchestration runs: immutable skill snapshot/hash, idempotency key, attempt budget, availability, lease/heartbeat, phase, cancellation, and terminal metadata.
- Added Mongo `RunEvent` persistence with per-run ordered sequences and replay APIs.
- Added an atomic Mongo claim path for queued or lease-expired executions.
- Added a separate worker entrypoint and shared runtime environment parsing.
- Added bounded retries, cooperative cancellation, and manual retry.
- Added stable `orchestrationStepId` commits so completed steps are reused during recovery/retry.
- Added run detail/filter/event/SSE/cancel/retry endpoints.
- Added frontend service/API-hook/feature-hook/component support for active-run rehydration, durable activity, phase/attempt display, cancel, and retry.
- Removed Wiki lint logging side effects from Knowledge Graph and Wiki Dream read paths while preserving explicit lint logs.
- Documented local operation and recovery semantics in `docs/durable-local-runtime.md` and `README.md`.

## Runtime decisions

- MongoDB remains the only production queue dependency; no Redis or cloud queue was added.
- Delivery semantics are at least once, not exactly once.
- A running LLM call is not force-aborted. Cancellation takes effect at the next step boundary.
- The API does not execute Mongo-backed orchestration work inline. `API_STORAGE=memory` uses an inline worker only for deterministic tests and lightweight local review.
- Already completed child steps are the resumable commit boundary.

## Validation

- `pnpm -r typecheck`: passed across shared, API, web, and MCP server.
- `pnpm -r test`: passed.
- `pnpm -r build`: passed; the API worker entrypoint compiled and the web production bundle completed.
- API: 86 tests passed, including queued persistence/cancel, replayable events, resumable retry, and read-side-effect coverage.
- Web: 21 tests passed.
- `git diff --check`: passed.
- Tests used mock executors only; no real external LLM, Codex, or MCP execution occurred.

## Review

The `atellier-reviewer` checklist found no product-scope, frontend API-chain, raw/wiki separation, documentation, or external-call blockers. Final robustness fixes added worker-loop error recovery, Mongo envelope enums, terminal-run dismissal protection in UI rehydration, and a larger durable event replay window.

## Follow-up candidates

- Add Mongo integration coverage for multi-worker lease contention and reclaim behavior.
- Add provider/tool idempotency keys before allowing irreversible external side effects.
- Add optional graceful abort support for providers that expose cancellation primitives.
