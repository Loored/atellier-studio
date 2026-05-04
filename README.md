# Atellier Studio

Atellier Studio is a private local-first AI operating system for personal and mini-agency style work.

It is not a game, not a public SaaS MVP, and not a generic task manager. The first milestone builds the operational spine for agents, tasks, runs, logs, and durable wiki memory.

## Current Milestone

Milestone 0: Operational Spine

- Local MongoDB
- Fastify API
- React dashboard
- Markdown wiki index and log
- Minimal API and UI tests

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

Run the API without MongoDB for local UI review:

```bash
pnpm --filter @atellier/api dev:memory
```

Run only the web app:

```bash
pnpm --filter @atellier/web dev
```

The API defaults to `http://localhost:4000`.
The web app defaults to Vite's local dev URL.

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

## Codex Workflow

- `CODEX_MEMORY.md` tracks local setup, decisions, mistakes already solved, and user preferences.
- `AGENTS.md` and app-level `AGENTS.md` files define project rules for future coding sessions.
- `.agents/skills` contains repeatable local workflows for wiki ingest, API layer changes, feature building, test running, and review.
- `.codex/config.toml` keeps Codex defaults conservative.
- `CONTRIBUTING.md` defines commit, branch, PR, and merge standards.

Useful scripts:

```bash
pnpm codex:review
pnpm codex:test-fix
pnpm codex:wiki-lint
```

## Next Milestones

1. Wiki Brain
2. Codex Worker
3. Agent Roles
4. Pixel Atelier
5. MCP Layer

MCP, Codex worker execution, auth, cloud deploy, multiplayer, vector search, and pixel UI are intentionally out of scope for Milestone 0.
