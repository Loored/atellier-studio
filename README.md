# Atellier Studio

Atellier Studio is a private local-first AI operating system for personal and mini-agency style work.

It is not a game, not a public SaaS MVP, and not a generic task manager. The current stage is the operational spine plus agent orchestration, deliverables, review UI, and durable wiki memory.

## Current Stage

Current stage: Operational Spine + Durable Local Orchestration Runtime + complete daily-use and review-learning loops + Wiki Brain MVP + grounded Wiki Dream UI + MCP server + multi-provider executors + Codex Worker control-plane + Knowledge Graph v2.

Implemented:

- Local MongoDB and in-memory storage mode for tests
- Fastify API with thin routes and service-owned business logic
- React dashboard on Tailwind CSS v4 (only `MobileView.tsx` still on legacy CSS)
- Skill-triggered agent orchestration (`atellier-build-loop`, `llm-wiki-ingest-loop`, `wiki-dream-loop`)
- Mongo-backed durable orchestration queue with immutable definition snapshots, leases, bounded retries, cooperative cancellation, resumable completed steps, and replayable run events
- Agent run logs, handoffs, circular-handoff and depth guards
- Deliverable generation, preview, promotion, unlink, and review states
- Markdown wiki index, log, deliverables index, and synthesis pages
- Wiki Brain MVP: deterministic `POST /wiki/ingest`, `POST /wiki/query`, `POST /wiki/lint`, safe `POST /wiki/page`
- Wiki query surfaces related pages and possible contradictions
- Wiki Dream audit grounding: curator receives real lint findings and current wiki paths before proposing maintenance
- Wiki Dream UI: trigger dream runs, preview reports, and save approved reports under `wiki/dreams`
- Review memory capture: `POST /runs/:id/capture-memory` writes durable `wiki/synthesis/` pages
- Daily-use loop: Wiki ingest creates source-linked tasks; durable runs carry task grounding; Review exposes the full evidence chain; approved memory capture closes the task idempotently
- Review-to-memory learning: an explicit `POST /runs/:id/curate-learning` promotes one approved lesson into durable role Markdown and optional Wiki lint/graph signals
- MCP server package (`apps/mcp-server`) exposes the local REST API as stdio tools for Claude Code / Cowork
- Multi-provider agent executors: mock, OpenAI, Anthropic, Groq, and Ollama with Ollama role overrides
- Codex Worker control-plane: create / plan / approve-step / execute-next / cancel / retry-step / finalize, with persisted per-step evidence artifacts
- Knowledge Graph v2: force-directed live canvas (react-force-graph-2d) clustered by wiki/raw/runtime/meta layers, inspector with markdown render + run timeline, ⌘K search with keyboard nav, URL-synced filters/density/selection, sesión viva polling, time-travel slider with snapshot ticks, hover tooltip, layer breakdown, Office↔Graph navigation, mobile tab, in-memory snapshot ring buffer at `/knowledge/graph/snapshots`
- Agent grounding validation: builder/QA responses are checked against verified repo files; review approval is blocked on validation errors
- Executor/model safety: `/health` exposes `executorMode`, `executorModel`, `modelProfile`; UI badge + warnings before OpenAI-backed runs
- Focused API and web tests (no real OpenAI/Codex calls in tests)

## Setup

```bash
pnpm install
```

On macOS without Docker Desktop, use the Homebrew CLI stack:

```bash
brew install docker docker-compose colima
colima start
```

Docker Compose should report a plugin:

```bash
docker compose version
```

```bash
docker compose up -d mongo
```

## Development

Run both apps:

```bash
pnpm dev
```

Run only the API:

```bash
pnpm --filter @atellier/api dev
```

Mongo-backed orchestration execution runs in a separate local worker. Start it in a second terminal with the same executor environment as the API:

```bash
pnpm dev:worker
```

The API accepts and persists work even while the worker is offline. When the worker starts, it claims queued or lease-expired runs. `API_STORAGE=memory` keeps an inline worker for tests and lightweight UI review, so `dev:memory` does not need a second process.

`SIGINT` and `SIGTERM` stop new polling immediately, keep the heartbeat alive for any already claimed run, wait for that run to settle, and only then disconnect Mongo. The standalone worker prints structured lifecycle diagnostics with its worker ID, state, active run, processed count, lease/poll settings, and latest error.

Cancelling a running durable orchestration now propagates an `AbortSignal` to fetch-based OpenAI, Anthropic, Groq, and Ollama calls. A separate worker detects a persisted cancellation within one second; providers that cannot abort still stop at the next safe step boundary.

Irreversible tool effects must pass through the durable idempotency ledger with a stable key and deterministic fingerprint. Completed outcomes are reused, concurrent duplicates are reported as in progress, and conflicting key reuse fails closed. See [`docs/tool-effect-idempotency.md`](docs/tool-effect-idempotency.md).

Optional worker controls:

```bash
RUN_WORKER_LEASE_MS=30000
RUN_WORKER_POLL_MS=1000
```

Codex Worker command execution stays fake by default. To opt into the controlled local adapter, start the API with an authenticated `codex` CLI available on `PATH`:

```bash
CODEX_WORKER_REAL_ENABLED=true pnpm --filter @atellier/api dev
```

The real adapter executes only the fixed `rg --files`, `codex exec`, `git diff --no-ext-diff`, and `pnpm typecheck` envelopes with `shell: false`. The implementation step still requires explicit approval in Atellier; Codex runs with `--sandbox workspace-write`, the installed CLI's `--approve-for-me` automatic review, and `--ephemeral`, and dangerous bypass flags are rejected.

Optional boundaries:

```bash
CODEX_WORKER_ALLOWED_DIRS=.,apps/api
CODEX_WORKER_TIMEOUT_MS=120000
CODEX_WORKER_MAX_OUTPUT_BYTES=1048576
```

Run the API with OpenAI-backed agent execution:

```bash
AGENT_EXECUTOR_MODE=openai OPENAI_API_KEY=<YOUR_OPENAI_API_KEY> pnpm --filter @atellier/api dev
```

Optional model override:

```bash
OPENAI_MODEL=gpt-4.1-mini
```

Optional execution policy controls:

```bash
AGENT_MAX_HANDOFF_DEPTH=1
AGENT_EXECUTION_TIMEOUT_MS=45000
```

Run the API without MongoDB for local UI review:

```bash
pnpm --filter @atellier/api dev:memory
```

Run only the web app:

```bash
pnpm --filter @atellier/web dev
```

The API defaults to `http://127.0.0.1:4000`.
The web app defaults to Vite's local dev URL.
Agent execution defaults to `mock` unless you explicitly set `AGENT_EXECUTOR_MODE` or provide an `OPENAI_API_KEY` without an explicit mode.

The API CORS default is intentionally local-first: browser origins on `localhost`, `127.0.0.1`, and `::1` are allowed for local development, while arbitrary remote origins are not reflected.
The API listen host also defaults to `127.0.0.1`; set `API_HOST=0.0.0.0` only when you intentionally want LAN exposure.

## Testing

```bash
pnpm test
```

```bash
pnpm test:api
pnpm test:web
```

With the local Mongo container running, execute the dedicated durable-runtime concurrency suite:

```bash
pnpm test:api:mongo-runtime
```

The suite creates a uniquely named test database and removes it after the run. Normal `pnpm test:api` remains deterministic and skips this opt-in Mongo suite.

## Build

```bash
pnpm build
```

## Knowledge Layout

- `atelier/raw`: immutable source material
- `atelier/wiki`: LLM-maintained operational memory
- `atelier/tasks`: markdown task views
- `atelier/runs`: execution history

Generated deliverables whose filenames start with ObjectIds or UUIDs are treated as local artifacts by default. Durable knowledge should be promoted into curated wiki pages and logs; see [docs/memory-artifact-hygiene.md](docs/memory-artifact-hygiene.md).

## Agent Orchestration

The dashboard includes an Orchestration panel backed by:

- `GET /orchestrations/skills`
- `POST /orchestrations/skills/:skillId/run`
- `GET /orchestrations/:runId/status`
- `GET /runs?type=orchestration&status=queued,running`
- `GET /runs/:runId/events` and `GET /runs/:runId/events/stream`
- `POST /runs/:runId/cancel` and `POST /runs/:runId/retry`

Current skills are `atellier-build-loop`, `llm-wiki-ingest-loop`, and `wiki-dream-loop`. They use the existing local agent/run/wiki spine and do not execute external Codex workers or MCP tools. See [docs/durable-local-runtime.md](docs/durable-local-runtime.md) for runtime semantics and recovery behavior.

## Codex Workflow

- `CODEX_MEMORY.md` tracks local setup, decisions, mistakes already solved, and user preferences.
- `AGENTS.md` and app-level `AGENTS.md` files define project rules for future coding sessions.
- `.agents/skills` contains repeatable local workflows for wiki ingest, API layer changes, feature building, test running, and review.
- `.agents/skills/atellier-agent-orchestrator` defines the build/fix/validate and LLM Wiki orchestration contract.
- `.codex/config.toml` keeps Codex defaults conservative.
- `CONTRIBUTING.md` defines commit, branch, PR, and merge standards.

Useful scripts:

```bash
pnpm codex:review
pnpm codex:test-fix
pnpm codex:wiki-lint
```

## Next Work

Active plan: [`docs/roadmap.md`](docs/roadmap.md). Strategic reframe after the *Code with Claude 2026* keynote (2026-05-06).

1. **Daily-use soak and learning feedback**: use the complete loop against the local Mongo worker, resolve real curation signals, and record friction before expanding product scope.

Already shipped: memory hygiene, Knowledge Graph v2 and follow-ups, role memory, Durable Runtime v1/v1.1, provider cancellation, irreversible-effect idempotency, the feature-flagged controlled Codex Worker adapter, the complete daily-use operational loop, and the explicit review-to-memory learning loop.

Auth, cloud deploy, multiplayer, vector search, graph DB, external meeting/chat/drive integrations, Computer Use, Batch/Citations/Files API, and broad creative connectors are intentionally out of scope. Pixel office expansion is no longer a priority — it remains as a visualization layer only.

Read `CODEX_MEMORY.md`, `docs/next-iteration-plan-2026-05-06.md`, `docs/roadmap.md`, `docs/memory-artifact-hygiene.md`, `docs/knowledge-graph.md`, and `docs/current-state-and-next-steps.md` before starting an implementation pass.
