# Atellier Studio

Atellier Studio is a local-first AI orchestration workspace with durable agent workflows, MCP tooling, multi-model execution, knowledge memory and a React/TypeScript interface.

## Current Stage

Current stage: Operational Spine + Durable Local Orchestration Runtime + bounded autonomous artifact repair + explicit memory trust contract + complete daily-use and review-learning loops + Wiki Brain MVP + grounded Wiki Dream UI + MCP server + multi-provider executors + Codex Worker control-plane + Knowledge Graph v2.

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
- Wiki reads and retrieval expose memory layer, trust state, authority, provenance, and classification reason; generated content fails closed as context-only. See [`docs/memory-trust-contract.md`](docs/memory-trust-contract.md).
- Wiki query supports explainable `balanced`, `evidence-first`, and `trusted-only` policies over Wiki and raw Markdown, with lexical and trust score components visible per result.
- Reflection candidates deterministically surface patterns repeated across distinct episodic artifacts; generation is read-only and prepared drafts remain generated context pending explicit review.
- Reflection review records idempotent accepted/rejected decisions with required notes; only accepted decisions can be promoted into trusted semantic notes.
- Wiki Dream audit grounding: curator receives real lint findings and current wiki paths before proposing maintenance
- Wiki Dream UI: trigger dream runs, preview reports, and save approved reports under `wiki/dreams`
- Review memory capture: `POST /runs/:id/capture-memory` writes durable `wiki/synthesis/` pages
- Daily-use loop: Wiki ingest creates source-linked tasks; durable runs carry task grounding; Review exposes the full evidence chain; approved memory capture closes the task idempotently
- Review-to-memory learning: an explicit `POST /runs/:id/curate-learning` promotes one approved lesson into durable role Markdown and optional Wiki lint/graph signals
- Curation signal resolution: Review records explicit resolved/dismissed decisions, keeps durable role-memory history, and removes closed findings from active Wiki lint
- MCP server package (`apps/mcp-server`) exposes the local REST API as stdio tools for Claude Code / Cowork
- Multi-provider agent executors: mock, OpenAI, Anthropic, Groq, and Ollama with profile- and role-based local routing. The safe local default keeps general roles on lightweight `qwen3.5:4b` and assigns only structured QA to `qwen3.5:9b`; other larger-model use remains opt-in.
- Orchestration runs can override the Ollama model profile per request; the chosen profile is persisted and visible in the run input.
- When no override is supplied, orchestration uses conservative deterministic profile classification and defaults ambiguous work to `standard`.
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

Recommended local startup:

```bash
./scripts/dev-local
```

The launcher uses Node directly, loads the repository `.env` without overriding explicit shell variables, prefers the repository-pinned `pnpm@9.15.4` through Corepack, checks dependencies and ports, starts Colima when needed, ensures Mongo is healthy, and launches the API, durable worker, and web app. It waits for API and web health before reporting:

- Web: `http://127.0.0.1:5174`
- API: `http://127.0.0.1:4000`

It never installs dependencies or kills an existing port owner. `Ctrl+C` stops only launcher-owned API, worker, and web processes; Mongo remains running. Run the non-mutating preflight with:

```bash
./scripts/dev-local --check
```

If `pnpm` is already available, the equivalent package script is:

```bash
corepack pnpm dev:local
```

Override isolated validation ports or the Mongo database explicitly:

```bash
API_PORT=4010 WEB_PORT=5180 \
MONGO_URI=mongodb://127.0.0.1:27017/atellier_launcher_validation \
AGENT_EXECUTOR_MODE=mock ./scripts/dev-local
```

Manual workspace startup remains available. This starts every workspace with a `dev` script, including the MCP server, but does not start Docker or the standalone durable worker:

```bash
corepack pnpm dev
```

Run only the API:

```bash
pnpm --filter @atellier/api dev
```

Mongo-backed orchestration execution runs in a separate local worker. Start it in a second terminal with the same executor environment as the API:

```bash
corepack pnpm dev:worker
```

The API accepts and persists work even while the worker is offline. When the worker starts, it claims queued or lease-expired runs. `API_STORAGE=memory` keeps an inline worker for tests and lightweight UI review, so `dev:memory` does not need a second process.

`SIGINT` and `SIGTERM` stop new polling immediately, keep the heartbeat alive for any already claimed run, wait for that run to settle, and only then disconnect Mongo. The standalone worker prints structured lifecycle diagnostics with its worker ID, state, active run, processed count, lease/poll settings, and latest error.

Cancelling a running durable orchestration now propagates an `AbortSignal` to fetch-based OpenAI, Anthropic, Groq, and Ollama calls. A separate worker detects a persisted cancellation within one second; providers that cannot abort still stop at the next safe step boundary.

Irreversible tool effects must pass through the durable idempotency ledger with a stable key and deterministic fingerprint. Completed outcomes are reused, concurrent duplicates are reported as in progress, and conflicting key reuse fails closed. See [`docs/tool-effect-idempotency.md`](docs/tool-effect-idempotency.md).

The internal Tool Harness exposes five bounded, read-only capabilities through a deny-by-default policy: Wiki query/lint, run evidence, workspace search, and workspace file ranges. Every invocation creates a durable receipt; arbitrary commands, writes, network actions, and model-defined roots remain unavailable. See [`docs/tool-harness.md`](docs/tool-harness.md).

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

Supervised code changes are a separate, off-by-default path. They take an already approved `apps/` or `packages/` preview, apply it only in a disposable git worktree, prepare dependencies offline with a frozen lockfile and lifecycle scripts disabled, and run the fixed server-side typecheck/test set. Checks can be cancelled or time out with a durable receipt. They do not use the primary checkout or merge anything. Enable it only for local supervised review:

```bash
ATELLIER_SUPERVISED_CODE_CHANGES_ENABLED=true pnpm --filter @atellier/api dev
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
AGENT_EXECUTION_TIMEOUT_MS=240000
```

The 240-second default leaves enough room for source-grounded local models to return complete knowledge artifacts instead of timing out mid-document.

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

Run the same deterministic package-scoped checks used by pull requests and pushes to `main` or `dev/1.0.0`:

```bash
corepack pnpm ci:check
```

This checks every workspace type, then runs the API, web, MCP-adapter, and local-launcher suites without requiring MongoDB or a real LLM/MCP provider. The opt-in Mongo concurrency suite remains separate.

For a deliberately real, local Ollama evaluation (not part of CI), `node scripts/eval-build-loop.mjs 2` runs up to two unfinished cases from the frozen eight-case matrix in `scripts/evaluations/2026-09-16-varied-build-loop.json`. Omit `2` to run every remaining case. It requires the Mongo-backed API at `127.0.0.1:4000`, Ollama mode, and zero other active runs; cases run sequentially. Its append-only journal is `atelier/runs/2026-09-16-varied-goal-evaluation.ndjson`. Recorded run IDs resume after interruption; an uncertain enqueue without a run ID stops for manual reconciliation instead of risking a duplicate. New journal entries contain a protected negative-control quality audit; `unverified` is not substantive approval. The runner does not approve reviews or promote generated outputs. Review the artifacts separately against the frozen criteria in the matrix.

`node scripts/eval-build-loop.mjs 2 --holdout` runs a separate reserved eight-case suite from `.protected-evals/holdout-v1.json` into `atelier/runs/2026-09-16-holdout-evaluation.ndjson`. The Tool Harness cannot read this hidden path. The holdout journal records `unverified` quality until a separate substantive evaluation has been calibrated; no approval or promotion occurs.
Use `node scripts/eval-build-loop.mjs --holdout --case=holdout-run-repair-difference` to select one exact case from that frozen matrix without changing its hash or journal. A case selector cannot be combined with a numeric limit; a previously finished case is skipped, and an uncertain enqueue still requires reconciliation.

For a reproducible evaluation campaign, pair a campaign and variant ID: `node scripts/eval-build-loop.mjs --holdout --campaign=quality-v1 --variant=contract-v3`. It creates an isolated journal under `atelier/runs/evaluations/` with the frozen matrix hash and local executor configuration. Reuse the same IDs only to resume the same immutable campaign.

After the v1 calibration decision is frozen, the new sealed suite is explicit: `node scripts/eval-build-loop.mjs --sealed=quality-v1 --campaign=sealed-v1 --variant=contract-v3`. It has its own immutable matrix hash, protected audit and journal. Do not inspect its private rubric during tuning or count it as unseen again.

```bash
corepack pnpm test
```

```bash
corepack pnpm test:api
corepack pnpm test:web
```

With the local Mongo container running, execute the dedicated durable-runtime concurrency suite:

```bash
corepack pnpm test:api:mongo-runtime
```

The suite creates a uniquely named test database and removes it after the run. Normal `corepack pnpm test:api` remains deterministic and skips this opt-in Mongo suite.

## Build

```bash
corepack pnpm build
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

Active plan: [`docs/operational-status.md`](docs/operational-status.md), with [`docs/roadmap.md`](docs/roadmap.md) as the strategic record.

1. **Repository truth and memory hygiene**: keep local generated evidence out of curated Wiki retrieval, then correct QA telemetry before another real-model campaign.

Already shipped: memory hygiene, Knowledge Graph v2 and follow-ups, role memory, Durable Runtime v1/v1.1, provider cancellation, irreversible-effect idempotency, the feature-flagged controlled Codex Worker adapter, the complete daily-use operational loop, explicit review-to-memory learning, and auditable curation-signal resolution.

Auth, cloud deploy, multiplayer, vector search, graph DB, external meeting/chat/drive integrations, Computer Use, Batch/Citations/Files API, and broad creative connectors are intentionally out of scope. Pixel office expansion is no longer a priority — it remains as a visualization layer only.

Read `CODEX_MEMORY.md`, `docs/operational-status.md`, `docs/roadmap.md`, `docs/memory-artifact-hygiene.md`, and `docs/knowledge-graph.md` before starting an implementation pass. Historical plans are reference material only.
