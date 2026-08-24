# Durable Local Runtime v1

Atellier skill orchestrations use a Mongo-backed local queue. The API persists intent; a separate worker owns execution. This keeps accepted work recoverable across API and worker restarts without adding Redis, a cloud queue, or remote infrastructure.

## Process model

1. `POST /orchestrations/skills/:skillId/run` creates a `queued` orchestration `Run` and returns `202`.
2. The run stores a versioned execution envelope and an immutable snapshot/hash of the selected skill definition.
3. `pnpm dev:worker` claims available work with a lease and heartbeat.
4. Each orchestration step remains an ordinary child run linked by `orchestrationRunId` and `orchestrationStepId`.
5. State transitions are appended to `RunEvent` with a per-run sequence number.
6. The dashboard discovers queued/running orchestrations after refresh and rebuilds the activity view from persisted status and events.

Memory storage uses the same runtime services with an inline worker. It is intended for tests and UI review, not restart durability.

## Delivery and recovery semantics

- Delivery is at least once.
- A worker lease defaults to 30 seconds and is renewed while a step runs.
- A lease-expired run can be reclaimed by another worker.
- The maximum automatic attempt count defaults to three, with bounded exponential backoff.
- Completed child steps are idempotent commits. A recovered or manually retried orchestration reuses them instead of running them again.
- When a parent is reclaimed or retried, non-terminal child runs left by an interrupted worker are marked `failed` with a superseded warning before execution resumes. This keeps the global run timeline from reporting stale work as active.
- Heartbeats, worker-owned transitions, and step events require both matching ownership and an unexpired parent lease. A paused or reclaimed worker cannot revive an expired lease or append late activity.
- The persisted definition snapshot prevents a code deployment from silently changing an already queued orchestration.
- Manual retry resets the attempt budget but retains completed child runs.

There is no general exactly-once promise. A process crash during an external provider call may leave a non-terminal child run and cause that in-flight step to execute again. Any tool that can create an irreversible effect must therefore use the durable effect ledger described in [`tool-effect-idempotency.md`](tool-effect-idempotency.md): the adapter supplies a stable key and deterministic fingerprint, and the ledger prevents duplicate execution for the same approved attempt.

## Cancellation

`POST /runs/:id/cancel` immediately cancels queued work. For running work it records `cancelRequestedAt`, aborts the matching in-process provider request immediately, and lets a separate worker detect the persisted request within one second. Fetch-based OpenAI, Anthropic, Groq, and Ollama executors receive the composed `AbortSignal`. Providers that cannot abort still stop cooperatively at the next orchestration step boundary.

Execution timeouts use the same signal path but remain timeout failures rather than operator cancellations. Late results from providers that ignore aborts cannot complete the cancelled child or parent run.

Terminal statuses are `completed`, `failed`, `blocked`, and `cancelled`. `POST /runs/:id/retry` accepts failed or blocked durable orchestration runs.

## Read APIs

- `GET /runs/:id` returns the execution envelope.
- `GET /runs/:id/events?after=<sequence>` returns replayable ordered events.
- `GET /runs/:id/events/stream?after=<sequence>` provides an SSE tail and closes at a terminal state.
- `GET /runs?type=orchestration&status=queued,running` discovers active work for UI rehydration.

Failed and blocked orchestration runs expose a retry action in the Runs timeline. Retrying queues the same parent run, preserves completed child-step commits, resets the attempt budget, and lets the dashboard rehydrate it as active work.

## Post-merge durability drill

The 2026-08-24 drill used an isolated Mongo database and local Ollama models. It verified:

- work accepted and visible in the UI while the worker was offline
- lease reclaim after interrupting a worker during an LLM step
- completed-step reuse without duplicate completed commits
- ordered event replay across the worker restart
- cancellation at the next safe step boundary
- three bounded automatic failures followed by a successful manual retry
- dashboard rehydration after full-page refresh
- interrupted child-run cleanup during a reclaimed attempt

The drill exposed and fixed two gaps: retry was not reachable from history after refreshing a failed run, and an in-flight child from a crashed worker remained globally `running` after the parent recovered.

## Local operation

Start Mongo, then run API/web and worker in separate terminals:

```bash
pnpm dev
pnpm dev:worker
```

The worker reads the same provider variables as the API. Useful runtime settings:

```bash
RUN_WORKER_LEASE_MS=30000
RUN_WORKER_POLL_MS=1000
```

Do not run the standalone worker with `API_STORAGE=memory`; memory state is process-local and cannot be shared with the API.

## Worker lifecycle and graceful shutdown

The standalone worker emits one-line JSON diagnostics prefixed with `[atellier-worker]`. Lifecycle events are `started`, `run_claimed`, `run_settled`, `error`, `stopping`, and `stopped`. Each event includes:

- stable worker ID and current lifecycle state
- active parent run ID, when present
- processed-run count and most recent error
- start/stop timestamps
- configured lease and polling durations

On `SIGINT` or `SIGTERM`, the worker:

1. stops issuing new claims and interrupts an idle poll delay immediately
2. enters `stopping` while an already claimed run continues with its heartbeat
3. waits for that run and any inline drain to settle
4. emits `stopped` and then disconnects Mongo

Shutdown remains graceful rather than cancelling active work: a process signal waits for an already claimed run, while an explicit operator cancellation aborts its provider request.

## Mongo concurrency verification

With the local Mongo container running, execute:

```bash
pnpm test:api:mongo-runtime
```

The opt-in suite creates and drops an isolated database. It starts independent queue/service instances over the same Mongo state and verifies:

- exactly one winner when two workers claim the same queued run
- exactly one winner when multiple workers race to reclaim an expired lease
- rejection of late heartbeats, transitions, and step events after lease expiry or ownership change
- atomic, ordered, unique event sequences under concurrent appends
- the Mongo unique index rejects a duplicate `(runId, sequence)` pair

Normal API tests skip this suite so they remain self-contained and never require local infrastructure.
