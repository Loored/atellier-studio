# AGENTS.md - Atellier Studio

## Before changing code

Read [CODEX_MEMORY.md](./CODEX_MEMORY.md) before starting implementation work. It records local setup, user preferences, prior decisions, and pitfalls already solved.

## Product

This repository is Atellier Studio, a private local-first AI operating system for personal and mini-agency style work.

Atellier Studio is not a game and not a public SaaS MVP. The pixel atelier is a future visualization layer only. The core product is task execution, persistent knowledge, agent runs, deliverables, and private operational memory.

## Core principle

Do not optimize for demos.
Optimize for a real daily-use private workflow.

## LLM Wiki principle

Atellier Studio follows the LLM Wiki pattern.

Do not treat the wiki as a passive notes folder.
Treat it as the persistent operational memory of the system.

When a task, run, source, decision, or deliverable creates reusable knowledge, update the wiki.

Prefer:

- durable markdown
- explicit links
- chronological logs
- source summaries
- client/project/entity pages
- contradiction notes
- human-readable run outputs

Avoid:

- hiding important context only in MongoDB
- relying only on chat history
- answering from memory when wiki context exists
- overwriting raw sources
- building a generic task app with no memory layer

## Stack

- React
- Vite
- TypeScript
- Fastify
- MongoDB
- Mongoose
- TanStack Query
- Vitest
- React Testing Library
- Markdown vault
- Codex CLI later
- MCP later

## Architecture

- `apps/web` owns the frontend.
- `apps/api` owns the local API server.
- `packages/shared` owns shared types.
- `.agents/skills` owns repeatable Codex workflows.
- `.codex/config.toml` owns conservative project-scoped Codex defaults.
- `atelier/raw` contains immutable raw inputs.
- `atelier/wiki` contains LLM-maintained knowledge.
- `atelier/tasks` contains task files.
- `atelier/runs` contains execution logs.

## Frontend API conventions

All frontend API access must follow this chain:

service function -> API hook -> feature hook/coordinator -> visual component

Rules:

- Components must never call axios/fetch directly.
- Services must only perform HTTP requests.
- API hooks must own TanStack Query cache, invalidation, and API alerts.
- Feature hooks coordinate UI state and rename query fields.
- Query keys must be centralized.
- Mutations that require invalidation or default alerts must use hook callbacks.
- Components/hooks should rename generic fields like `data`, `isFetching`, and `isPending`.

## Rules

- Keep changes small.
- Do not add complex infrastructure early.
- Do not build auth yet.
- Do not build MCP yet.
- Do not build pixel UI yet.
- Do not build cloud deployment yet.
- Do not build multiplayer.
- Do not overwrite raw sources.
- All important work must create or update a run log.
- Prefer explicit files and readable markdown over hidden state.
- Add minimal tests for the operational spine.
- Do not call real external LLMs, Codex, or MCP tools in tests.
- Always update README/docs when changing setup or scripts.
- Prefer `pnpm`.
- Run relevant tests before final response.
- Do not commit, push, or open PRs unless the user explicitly requests it.
- When the user explicitly requests commits/PRs, follow `CONTRIBUTING.md`.

## MVP loop

1. Create a task.
2. Assign it to an agent.
3. Start a run.
4. Append logs.
5. Complete or block the run.
6. Save the result.
7. Update the wiki log.
