# Durable Runtime Post-Merge Drill

- Date: 2026-08-24
- Branch: `codex/durable-runtime-hardening`
- Base: `dev/1.0.0` at `35689a0`
- Environment: isolated Mongo database, temporary Atelier root, local Ollama (`llama3.2:latest`; builder override `qwen2.5-coder:7b`)

## Goal

Validate Durable Local Runtime v1 under real local process interruption before expanding execution authority.

## Evidence

### Offline queue and UI rehydration

- Queued an `atellier-build-loop` while no worker was connected.
- The API persisted status `queued`, attempt `0/3`, the immutable definition snapshot/hash, and event `#1`.
- A full UI load discovered the run through the active-runs API and rendered the queued state and durable event.

### Restart and completed-step reuse

- Started worker 1, allowed `scope` to complete, and interrupted it during `build`.
- Reloaded the UI with no worker; it retained `running`, `1/7`, attempt `1/3`, and events through `#7`.
- Worker 2 reclaimed the expired lease as attempt 2, emitted `step_reused` for `scope`, and resumed from `build`.

### Cancellation

- Requested cancellation from the dashboard during an active step.
- The current step completed and the parent stopped at the next boundary with status `cancelled`.
- Five of seven steps were committed; `approve` and `memory` remained pending.

### Failure and manual retry

- Queued a `wiki-dream-loop` and ran it against an intentionally unreachable local Ollama endpoint.
- The runtime scheduled bounded retries for attempts 1 and 2, then marked attempt 3 `failed` with ordered events.
- The initial UI had no way to retry that terminal run after refresh. Added a retry action to failed/blocked orchestration entries in Runs history.
- Used the new UI control to queue a manual retry; event `#14` recorded the retry and a healthy worker completed 4/4 steps.

### Interrupted child cleanup

- The first crash left its in-flight child run globally `running` after the parent recovered.
- Added recovery cleanup that marks prior non-terminal children `failed` with a superseded warning before the reclaimed attempt resumes.
- Repeated the Mongo interruption: the old child became `failed`, the parent logged one recovered child, reused two completed steps, and completed 4/4 on attempt 2.

## Product changes from the drill

- Runs timeline exposes retry for `failed`/`blocked` orchestration runs through the required service -> API hook -> feature hook -> component chain.
- Reclaimed/retried parents settle interrupted child runs before step reuse/resumption.
- Added focused web behavior coverage for retry and API coverage for interrupted-child cleanup.

## Remaining hardening

- Multi-worker claim contention and lease-reclaim integration coverage against Mongo.
- Worker lifecycle diagnostics and graceful shutdown behavior.
- Provider abort support where available.
- Provider/tool idempotency requirements before irreversible side effects.

## Validation

- Targeted web App behavior test passed (15/15).
- Targeted API interrupted-child recovery test passed.
- Full direct workspace suites passed: API 87/87 and web 22/22.
- Monorepo typecheck and production build passed for shared, API, web, and MCP packages.
- A fresh browser session loaded without console errors or warnings.
- The root `test:web`/`test:api` aliases hit a nested pnpm non-TTY dependency-purge guard before running tests; direct workspace test commands were used for authoritative results.
