# Codex Memory - Atellier Studio

This file is durable project memory for future Codex sessions. Read it before implementation work, then update it when setup, workflow, or project decisions change.

## User Preferences

- Do not commit, push, or open PRs until the user explicitly says to do so.
- Keep changes grouped so future commits/PRs can be separated by important feature or implementation area.
- The user wants local review first: compile, inspect UI, and verify behavior before publishing.
- Add useful tests as work changes, but avoid large or noisy test suites.
- When the user approves publishing, use organized branches, commit messages, PR bodies, and merges.
- Do not commit directly to `main` after the repository has a base branch.
- Use `main` as stable branch and `dev/1.0.0` as integration branch for ongoing work.

## Project Identity

- Atellier Studio is a private, local-first AI operating system for daily work and mini-agency style operations.
- It is not a SaaS MVP, not a game, and not a public/team product yet.
- Core loop: source/input -> wiki update -> task -> agent run -> review -> deliverable -> memory update.
- Markdown wiki is durable operational memory. MongoDB is operational state, not the only source of truth.

## Current Local Setup

- Repo: `/Users/e.juarez/Desktop/atellier-studio`
- GitHub remote: `https://github.com/Loored/atellier-studio.git`
- Local branch: `dev/1.0.0`
- Package manager: `pnpm@9.15.4`
- Docker path: Docker CLI + Docker Compose + Colima, not Docker Desktop.
- Mongo container: `atellier-mongo` from `mongo:7`, exposed on `localhost:27017`.
- API default: `http://127.0.0.1:4000`
- Web dev server has used: `http://127.0.0.1:5174/`

## Important Setup Notes

- Docker Desktop install via Homebrew failed because it required `sudo` to link Compose into `/usr/local/cli-plugins`.
- Working setup is:

```bash
brew install docker docker-compose colima
colima start
docker compose up -d mongo
```

- Docker Compose plugin was configured through `~/.docker/config.json` with `/opt/homebrew/lib/docker/cli-plugins`.
- Colima is registered as a Homebrew service: `brew services start colima`.

## Implementation History

### 2026-05-04 - Milestone 0 spine

- Created pnpm monorepo with `apps/api`, `apps/web`, and `packages/shared`.
- Added Fastify API with agents, tasks, runs, wiki routes, Mongoose models, and route tests.
- Added React/Vite dashboard with TanStack Query service -> API hook -> feature hook -> component flow.
- Added Markdown wiki index/log and task files under `atelier/`.
- Added Docker Compose MongoDB setup.
- Added tests and verified `pnpm test`, `pnpm typecheck`, and `pnpm build`.

### 2026-05-04 - Local Docker/Mongo setup

- Installed Docker CLI, Docker Compose plugin, and Colima through Homebrew.
- Started Mongo with `docker compose up -d mongo`.
- Verified Mongo with `docker exec atellier-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 })'`.
- Switched API from `dev:memory` to normal Mongo-backed `dev`.

### 2026-05-04 - V3 Codex hardening

- Added this memory file and instructed future agents to read it through `AGENTS.md`.
- Added app-level `AGENTS.md` files for frontend and backend conventions.
- Added `.agents/skills` workflows for wiki ingest, API layer work, feature building, test running, and review.
- Added `.codex/config.toml` with conservative workspace-write/on-request defaults.
- Added Codex helper scripts to `package.json`.
- Added dashboard run-log append UI so the visible loop supports create run -> append log -> complete run.

### 2026-05-04 - Git workflow standard

- Added `CONTRIBUTING.md` with the project commit, branch, PR, and merge standards.
- Added `.github/pull_request_template.md` so PRs stay consistent.
- Commit subjects use `type: imperative description` and stay at 72 characters or fewer.
- PR titles start with an action verb and stay at 80 characters or fewer.
- PR descriptions include Summary, Context, Changes, Benefits, and Screenshots / Demos.

### 2026-05-04 - Branch model update

- Standardized repository flow as `main` (stable) + `dev/1.0.0` (integration).
- Feature and bugfix branches should start from `dev/1.0.0` and merge back into `dev/1.0.0`.
- `main` should only receive validated merges from `dev/1.0.0` or explicit hotfixes.

### 2026-05-04 - UI/UX and security review

- Installed user-scoped skills: `pdf`, `security-threat-model`, `security-best-practices`, and `playwright`; restart Codex to make them appear in the active skill list.
- Improved the dashboard layout so Agents and Recent Runs share the first row, with compact scannable lists and mobile two-column metrics.
- Added shared task title and run log message length limits, enforced in the API and reflected in the UI controls.
- Hardened API defaults with `127.0.0.1` listen host, local-only CORS reflection, explicit 1 MiB body limit, and baseline response security headers.
- Web API client defaults to `http://127.0.0.1:4000` instead of `localhost` because this machine can resolve `localhost` to IPv6 while the API is reachable on IPv4 loopback.
- Captured review notes at `atelier/wiki/synthesis/2026-05-04-ui-security-review.md` and run log at `atelier/runs/2026-05-04-ui-security-review.md`.

### 2026-05-04 - Agent run execution spine

- Added `POST /agents/:id/run` for real local instruction execution flow with run lifecycle updates.
- Added `GET /agents/:id/messages` plus persistent `Message` model/service (Mongo + memory mode).
- Added shared types for `RunAgentInput/RunAgentResult` and `AgentMessage`.
- Wired pixel office `AgentDetailPanel` to real execution and persisted message history.
- Added latest run log preview in `RunsTimeline`.
- Added API tests for run execution and message persistence.

### 2026-05-04 - Executor mode switch

- Refactored agent execution into pluggable modes: `mock` (default) and `openai`.
- Added env-based executor settings in API startup:
  - `AGENT_EXECUTOR_MODE=mock|openai`
  - `OPENAI_API_KEY`
  - `OPENAI_MODEL` (default `gpt-5-mini`)
- Kept tests and local dev stable by leaving `mock` as default.

### 2026-05-04 - Handoff MVP + streaming

- Added SSE streaming route for live agent output in panel (`/agents/:id/run/stream`).
- Added handoff-capable run input fields (`handoffAgentId`, `handoffInstruction`).
- Implemented chained run handoff flow: source run logs handoff, target agent executes with accumulated context, target run and messages persist.
- Added panel controls to choose handoff target and pass optional handoff instruction.
- Added API tests covering handoff path.

### 2026-05-04 - Handoff policy guardrails

- Added `AGENT_MAX_HANDOFF_DEPTH` (default `1`) and `AGENT_EXECUTION_TIMEOUT_MS` (default `45000`) policy controls.
- Added run-time guard behavior for depth limits and circular handoff targets with explicit run logs.
- Wrapped executor calls with timeout enforcement so stalled executions fail predictably.
- Removed accidental plaintext API key from README examples and replaced with placeholders.

### 2026-05-04 - Stream reliability fixes

- Added explicit id validation for agent/run routes, supporting both Mongo ObjectId and memory-mode UUID ids.
- Fixed SSE stream route to return local-origin CORS headers on stream responses, preventing browser `failed to fetch` after successful preflight.
- Added API regression test to verify `Access-Control-Allow-Origin` on `/agents/:id/run/stream`.

### 2026-05-04 - Agent panel interactivity upgrade

- `Open Agent Terminal` is now functional and toggles an interactive command surface in the panel.
- Added panel command support for `help`, `status`, `unblock`, `clear`, `run <instruction>`, and `set-status <status>`.
- Added terminal `handoff <agent-name-or-id> :: <instruction>` command to delegate directly from panel command mode.
- Added explicit `Resume` action for `blocked`/`needs-human` states to recover agents quickly.
- `needs-human` is now treated as waiting state in panel visuals instead of hard blocked.

### 2026-05-04 - Parallel ops hardening

- Added persistent `instructions` field for agents in shared types, API storage, and UI editing flow.
- Expanded `/health` response with storage/executor mode, Mongo state, waiting-agent count, active-run count, and process memory metrics.
- Added optional run completion metadata: `reviewStatus` and `deliverablePath`.
- Added browser notifications for new `needs-human` transitions and a mobile nav badge for waiting-agent count.
- Validation: `pnpm typecheck` and `pnpm test` passed.

### 2026-05-04 - Run review and deliverables dashboard

- Added API route `PATCH /runs/:id/review` and service support for updating run review states (`pending`, `approved`, `changes-requested`).
- Upgraded web Runs Timeline with:
  - completed-run review actions (`Approve`, `Changes`, `Pending`)
  - operational filters by related agent state (`needs-human`, `blocked`)
  - review-state filters.
- Added `DeliverablesPanel` to dashboard to surface runs linked to `deliverablePath`.
- Added tests for API review route and web review action flow.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

### 2026-05-04 - Deliverable preview + auto review defaults

- Added secure API route `GET /wiki/page?path=<relative-path>` for reading markdown files under `atelier/` for deliverable preview.
- Deliverables panel now supports selecting a deliverable path and previewing file content inline.
- Run completion now sets default review states automatically:
  - non-review runs => `pending`
  - review runs => `approved`
  - explicit review status still takes precedence.
- Dashboard metrics now include `needs-human`, `blocked`, and `pending review` counters.
- Added API tests for wiki page read route and default review transition behavior.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

### 2026-05-04 - Auto deliverable generation and approval audit

- Added `WikiService.writePage` with atelier-root path safety checks; wiki bootstrap now ensures `wiki/deliverables` exists.
- `RunService.complete` now auto-generates a deliverable markdown file when:
  - `summary` is present
  - `deliverablePath` is not provided.
- Generated file path pattern: `wiki/deliverables/<runId>-<summary-slug>.md`.
- Added explicit wiki decision entry `Deliverable accepted` whenever run review state becomes `approved` (on completion or review update).
- Added API tests covering generated deliverable retrieval and approval decision logging.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

### 2026-05-04 - Manual deliverable promotion and index refresh

- Added API route `PATCH /runs/:id/promote-deliverable` to generate and attach deliverables for previously completed runs.
- Added deliverables index regeneration on write:
  - `wiki/deliverables/index.md` is rebuilt automatically whenever deliverable markdown files are created/updated.
- Added `Promote` action in `RunsTimeline` for completed runs missing a `deliverablePath`.
- Added tests for promote endpoint behavior, deliverables index refresh, and timeline promote action.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

### 2026-05-05 - Deliverable unlink + index metadata

- Added API route `PATCH /runs/:id/unlink-deliverable`:
  - unsets `deliverablePath` from run
  - removes the deliverable markdown file if it exists.
- Added `WikiService.deletePage` with atelier-root path safety and auto-refresh of deliverables index on delete.
- Upgraded `wiki/deliverables/index.md` columns to include `Type` and `Review` metadata extracted from deliverable markdown.
- Timeline completed-run controls now show `Unlink` when a run already has a deliverable.
- Added API/web tests for unlink flow and updated review-action test selector for multiple completed runs.
- Validation: `pnpm test:api` and `pnpm test:web` passed.

### 2026-05-05 - Deliverable unlink confirmation and panel filters

- Added client-side confirmation prompt before `unlink-deliverable` mutation in timeline controls.
- Added Deliverables panel filters:
  - run type (`all` + each `RUN_TYPES` value)
  - review status (`all` + `RUN_REVIEW_STATUSES`).
- Updated web tests for:
  - unlink flow with confirmation
  - filtered deliverables visibility behavior.
- Validation: `pnpm test:web` and `pnpm test:api` passed.

### 2026-05-05 - Real integration runtime default

- Removed `useOrchestrationSim` runtime usage from office experience so frontend no longer mutates agent status with fake timers.
- Removed orchestration simulation toggle from office bottom bar.

### 2026-05-05 - Skill-triggered agent orchestration

- Added shared orchestration types and `orchestration` run type.
- Added API routes:
  - `GET /orchestrations/skills`
  - `POST /orchestrations/skills/:skillId/run`
- Added `SkillOrchestrationService` with initial templates:
  - `atellier-build-loop`
  - `llm-wiki-ingest-loop`
- Added dashboard Orchestration panel following service -> API hook -> feature hook -> component conventions.
- Added local Codex skill `.agents/skills/atellier-agent-orchestrator/SKILL.md` for build/fix/validate and wiki ingest orchestration.
- Preserved the operator-provided LLM Wiki/orchestration reference under `atelier/raw/references/` and summarized the decision in `atelier/wiki/workflows/agent-skill-orchestration.md`.
- Orchestrated child agent runs suppress automatic deliverables; the parent orchestration run is the reviewable deliverable.
- Backend executor selection now defaults to real OpenAI mode when `OPENAI_API_KEY` is set:
  - explicit `AGENT_EXECUTOR_MODE=mock` still forces mock mode.
- Updated README to describe real-mode-first executor behavior.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

### 2026-05-05 - Real orchestration toggle restored

- Restored Office bottom-bar orchestration toggle but wired it to real backend execution (`useOrchestrationLive`) instead of fake status simulation.
- Live orchestration now periodically dispatches real `run` requests for eligible agents, using role-specific instructions.
- Added strict runtime guard in API startup:
  - non-test runtime now requires `OPENAI_API_KEY` unless `AGENT_EXECUTOR_MODE=mock` is explicitly set.
- Updated app-services executor mode selection to prefer OpenAI when API key exists.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web` passed.

## Git Workflow Standard

### Commit messages

Use:

```txt
type: imperative description

- Specific detail 1
- Specific detail 2
- Impact or result

Context or reasoning, when it is not obvious.
```

Allowed types:

- `feat`: new functionality
- `fix`: bug fix
- `refactor`: restructure without behavior change
- `perf`: performance improvement
- `docs`: documentation only
- `style`: formatting/style, no logic change
- `test`: add or modify tests
- `chore`: build, dependencies, tooling

Rules:

- First line is 72 characters or fewer.
- Use imperative mood: `add`, `fix`, `remove`.
- Mention impact when relevant.

### Branches

Use:

```txt
feat/short-description
fix/short-description
refactor/short-description
chore/short-description
```

Base branch policy:

- `main` is stable and protected by process.
- `dev/1.0.0` is the integration branch for daily implementation.

Do not commit directly to `main` after the initial base branch exists.

### Pull requests

Use English, professional, concise descriptions. Group changes by category, not file-by-file.

Required PR sections:

- Summary
- Context
- Changes
- Benefits
- Screenshots / Demos

## Pitfalls Already Solved

- `pnpm` was unavailable until Corepack was enabled and `pnpm@9.15.4` prepared.
- Corepack resolving `pnpm/latest` can fail; prefer the pinned package manager version.
- Vite 6 and Vitest 2 produced conflicting Vite types. Web uses Vite 5.4.x for now.
- Mongoose ESM should use `import mongoose, { Schema } from "mongoose"`; do not import `models` as a named export.
- `tsx watch` may need escalated permissions in this environment because it creates IPC sockets under temp directories.
- Hidden directories like `.agents` and `.codex` may need escalated filesystem permission in this environment.

## Current Validation Commands

```bash
pnpm typecheck
pnpm test
pnpm build
docker compose ps
curl -s http://127.0.0.1:4000/health
```

### 2026-05-04 - Pixel Office + Dark UI + Mobile + Orchestration (Claude session)

Full handover document at `atelier/wiki/handover-claude-to-codex-2026-05-04.md`.

Summary of changes:
- Added `"designer"` to `AGENT_ROLES` in shared types.
- Complete CSS dark theme overhaul (`styles.css`, ~1400 lines). Tokens: `--bg-base #0b0c16`, `--accent-purple #7c5cfc`, `--accent-teal #1de5b5`.
- New app shell: `AppShell.tsx` (header + sidebar + conditional view), `Sidebar.tsx` (64px icon nav + roster), `MobileView.tsx` (phone layout with agent grid + activity list + bottom tabs).
- Mobile breakpoint: `useIsMobile()` at `window.innerWidth < 768` in AppShell. Default view = 'dashboard' (required for tests).
- New `features/pixel-office/` feature:
  - Canvas 640×640px, 4 rooms in 2×2 grid, real sprites from pixel-agents VS Code extension.
  - Sprites copied to `apps/web/public/sprites/` (characters char_0–5, floors, furniture).
  - Smooth character movement: `currentX/Y` animated at 1.2px/frame toward `targetX/Y` in RAF loop.
  - Directional sprites: row 0=down, row 1=up, row 2=right/left(mirrored), 7 animation frames.
  - Click on character → floating glass panel with agent details + functional Send button.
  - `useOrchestrationSim` hook: auto-chains 2–3 agents every 15s through working statuses.
  - `⚡ ORQUESTACIÓN` toggle button in office bottom bar.
- AgentsPanel updated with name input + role selector (all 6 roles).
- Dashboard extracted from shell wrapper; PixelOfficePanel removed from dashboard grid.
- Tests: 3/3 pass. TypeScript: 0 errors.

**Canvas JSDOM pitfall:** `canvas.getContext("2d")` THROWS in jsdom — always use try/catch, not null-check.

## Not Implemented Yet

- MCP integrations
- Real orchestration (currently simulated with random timers)
- Robust multi-agent orchestration planning and prioritization beyond single-step handoff
- GRAFO / knowledge graph view
- Auth
- Cloud deployment
- Multi-user/team workflows
- Cross-room character pathfinding
- Per-agent custom sprites

## Update Rule

When a future change alters setup, scripts, architecture, operational behavior, or user preferences, add a short entry here and append an event to `atelier/wiki/log.md`.
