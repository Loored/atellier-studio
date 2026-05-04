# Codex Memory - Atellier Studio

This file is durable project memory for future Codex sessions. Read it before implementation work, then update it when setup, workflow, or project decisions change.

## User Preferences

- Do not commit, push, or open PRs until the user explicitly says to do so.
- Keep changes grouped so future commits/PRs can be separated by important feature or implementation area.
- The user wants local review first: compile, inspect UI, and verify behavior before publishing.
- Add useful tests as work changes, but avoid large or noisy test suites.
- When the user approves publishing, use organized branches, commit messages, PR bodies, and merges.
- Do not commit directly to `main` after the repository has a base branch.

## Project Identity

- Atellier Studio is a private, local-first AI operating system for daily work and mini-agency style operations.
- It is not a SaaS MVP, not a game, and not a public/team product yet.
- Core loop: source/input -> wiki update -> task -> agent run -> review -> deliverable -> memory update.
- Markdown wiki is durable operational memory. MongoDB is operational state, not the only source of truth.

## Current Local Setup

- Repo: `/Users/e.juarez/Desktop/atellier-studio`
- GitHub remote: `https://github.com/Loored/atellier-studio.git`
- Local branch: `main`
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

### 2026-05-04 - UI/UX and security review

- Installed user-scoped skills: `pdf`, `security-threat-model`, `security-best-practices`, and `playwright`; restart Codex to make them appear in the active skill list.
- Improved the dashboard layout so Agents and Recent Runs share the first row, with compact scannable lists and mobile two-column metrics.
- Added shared task title and run log message length limits, enforced in the API and reflected in the UI controls.
- Hardened API defaults with `127.0.0.1` listen host, local-only CORS reflection, explicit 1 MiB body limit, and baseline response security headers.
- Web API client defaults to `http://127.0.0.1:4000` instead of `localhost` because this machine can resolve `localhost` to IPv6 while the API is reachable on IPv4 loopback.
- Captured review notes at `atelier/wiki/synthesis/2026-05-04-ui-security-review.md` and run log at `atelier/runs/2026-05-04-ui-security-review.md`.

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
- Codex worker execution (real LLM calls from agents)
- Real orchestration (currently simulated with random timers)
- Chat history persistence in MongoDB
- GRAFO / knowledge graph view
- Auth
- Cloud deployment
- Multi-user/team workflows
- Cross-room character pathfinding
- Per-agent custom sprites

## Update Rule

When a future change alters setup, scripts, architecture, operational behavior, or user preferences, add a short entry here and append an event to `atelier/wiki/log.md`.
