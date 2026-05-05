# Atellier Studio

Atellier Studio is a private local-first AI operating system for personal and mini-agency style work.

It is not a game, not a public SaaS MVP, and not a generic task manager. The current stage is the operational spine plus agent orchestration, deliverables, review UI, and durable wiki memory.

## Current Stage

Current stage: Operational Spine + Agent Orchestration + Deliverables + Review UI

- Local MongoDB
- Fastify API
- React dashboard
- Skill-triggered agent orchestration runs
- Agent run logs and handoffs
- Deliverable generation, preview, promotion, unlink, and review states
- Markdown wiki index and log
- Minimal API and UI tests
- Tailwind CSS v4 dashboard/shell migration in progress

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

1. Wiki Brain
2. Executor/model cost safety
3. Codex Worker design
4. Orchestration reliability
5. MCP Layer later

MCP, Codex worker execution, auth, cloud deploy, multiplayer, and vector search are intentionally out of scope until the Wiki Brain and safety layers are stable. Pixel office exists as a visualization layer, but it is not the next product priority.
