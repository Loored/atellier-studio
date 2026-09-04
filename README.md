# Atellier Studio

Atellier Studio is a local-first AI orchestration workspace with durable agent workflows, MCP tooling, multi-model execution, knowledge memory and a React/TypeScript interface.

## Current Stage

Current stage: Operational Spine + Agent Orchestration + Wiki Brain MVP + Codex Worker control-plane + Review Memory Capture.

Implemented:

- Local MongoDB and in-memory storage mode for tests
- Fastify API with thin routes and service-owned business logic
- React dashboard on Tailwind CSS v4 (only `MobileView.tsx` still on legacy CSS)
- Skill-triggered agent orchestration (`atellier-build-loop`, `llm-wiki-ingest-loop`)
- Agent run logs, handoffs, circular-handoff and depth guards
- Deliverable generation, preview, promotion, unlink, and review states
- Markdown wiki index, log, deliverables index, and synthesis pages
- Wiki Brain MVP: deterministic `POST /wiki/ingest`, `POST /wiki/query`, `POST /wiki/lint`, safe `POST /wiki/page`
- Wiki query surfaces related pages and possible contradictions
- Review memory capture: `POST /runs/:id/capture-memory` writes durable `wiki/synthesis/` pages
- Codex Worker control-plane: create / plan / approve-step / execute-next / cancel / retry-step / finalize, with persisted per-step evidence artifacts
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
Agent execution runs in real OpenAI mode by default for local runtime. You must provide `OPENAI_API_KEY`, or explicitly opt into mock mode with `AGENT_EXECUTOR_MODE=mock`.

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

## Build

```bash
pnpm build
```

## Knowledge Layout

- `atelier/raw`: immutable source material
- `atelier/wiki`: LLM-maintained operational memory
- `atelier/tasks`: markdown task views
- `atelier/runs`: execution history

## Agent Orchestration

The dashboard includes an Orchestration panel backed by:

- `GET /orchestrations/skills`
- `POST /orchestrations/skills/:skillId/run`

Current skills are `atellier-build-loop` and `llm-wiki-ingest-loop`. They use the existing local agent/run/wiki spine and do not yet execute external Codex workers or MCP tools.

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

Active plan: [`docs/next-iteration-plan-2026-05-06.md`](docs/next-iteration-plan-2026-05-06.md). Strategic reframe after the *Code with Claude 2026* keynote (2026-05-06).

1. **MCP server wrapper** over the REST API: expose `wiki/query`, `wiki/ingest`, `wiki/page`, `orchestrations/skills/:id/run`, `runs/list`, `runs/get` as MCP tools. Local-only auth. Targeted at Cowork + Claude Code.
2. **Wiki Dream loop**: scheduled `wiki-curator` that prunes stale, resolves contradictions via `/wiki/lint`, links orphans, and reorganizes the index. v1 produces *proposed* changes the operator approves.
3. **Anthropic executor mode** (`AGENT_EXECUTOR_MODE=anthropic`): Opus 4.7 default, native prompt caching, `/health` exposes new mode/model.
4. **Skills 2.0 alignment**: audit `.agents/skills/` against the new format and migrate `atellier-build-loop` and `llm-wiki-ingest-loop` if compatible.
5. **Codex Worker Evidence Pass v1.1** (deferred from previous P1): stronger per-step evidence, approval audit metadata. No real Codex CLI integration yet.

Auth, cloud deploy, multiplayer, vector search, Computer Use, Batch/Citations/Files API, and broad creative connectors are intentionally out of scope. Pixel office expansion is no longer a priority — it remains as a visualization layer only.

Read `CODEX_MEMORY.md`, `docs/next-iteration-plan-2026-05-06.md`, `docs/roadmap.md`, and `docs/current-state-and-next-steps.md` before starting an implementation pass.
