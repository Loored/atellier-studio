# Local Setup

Operational setup notes for Atellier Studio on this machine.

## Repository

- Path: `/Users/e.juarez/Desktop/atellier-studio`
- Integration branch: `dev/1.0.0`
- Stable branch: `main`
- Package manager: `pnpm@9.15.4`

## Install

```bash
pnpm install
```

If `pnpm` is unavailable, enable Corepack and use the pinned package manager version from `package.json`.

## MongoDB With Colima

Docker Desktop was not the working path on this machine because Homebrew needed `sudo` to link Compose under `/usr/local/cli-plugins`.

Use the CLI stack:

```bash
brew install docker docker-compose colima
colima start
docker compose up -d mongo
```

Verify:

```bash
docker compose ps
docker exec atellier-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 })'
```

Docker Compose plugin was configured through `~/.docker/config.json` with `/opt/homebrew/lib/docker/cli-plugins`.
Colima is registered as a Homebrew service:

```bash
brew services start colima
```

## Local Services

- MongoDB container: `atellier-mongo`
- Mongo port: `localhost:27017`
- API: `http://127.0.0.1:4000`
- Web: `http://127.0.0.1:5174/`

Prefer `127.0.0.1` over `localhost` in web/API defaults because this machine can resolve `localhost` to IPv6 while the API is reachable on IPv4 loopback.

## Recommended Startup

From the repository root:

```bash
./scripts/dev-local
```

This executable only requires `node` on `PATH`. It loads the repository `.env` while preserving explicit shell overrides and prefers the pinned package manager through `corepack pnpm`, so a missing global `pnpm` command is not a blocker when Corepack is available.

Startup sequence:

1. Load `.env`, then validate Node 22+, pinned pnpm access, installed dependencies, and free API/Web ports.
2. Validate Docker CLI and Compose; start Colima only if the Docker daemon is offline.
3. Run `docker compose up -d mongo` and wait for a real Mongo ping.
4. Start the Mongo-backed API, standalone durable worker, and Vite on fixed local ports.
5. Wait for API `/health` and the Vite HTML response before reporting readiness.

Safe preflight without starting services:

```bash
./scripts/dev-local --check
```

Alternative when `pnpm` is already available:

```bash
pnpm dev:local
```

The launcher fails closed when a configured port is occupied and never kills that process. Override `API_HOST`, `API_PORT`, `WEB_HOST`, `WEB_PORT`, or `MONGO_URI` when an isolated local run is needed. `Ctrl+C` signals only child processes started by this launcher, waits for the worker's graceful shutdown, and leaves Mongo running.

If dependencies are missing, install them explicitly; the launcher never changes the dependency tree:

```bash
corepack pnpm install --frozen-lockfile
```

## Runtime Modes

Mock API execution:

```bash
AGENT_EXECUTOR_MODE=mock pnpm --filter @atellier/api dev
```

OpenAI-backed execution:

```bash
AGENT_EXECUTOR_MODE=openai OPENAI_API_KEY=<YOUR_OPENAI_API_KEY> pnpm --filter @atellier/api dev
```

Optional model and policy controls:

```bash
OPENAI_MODEL=gpt-4.1-mini
AGENT_MAX_HANDOFF_DEPTH=1
AGENT_EXECUTION_TIMEOUT_MS=120000
```

Keep the 120-second default for source-grounded local runs that must return a complete document; shorter limits can interrupt Ollama before the artifact is reviewable.

Current product risk: real execution can burn quota. Future work should make executor mode, model, and model profile highly visible in UI before running agents.

## Validation

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm test:api
pnpm test:web
```

Run the smallest relevant subset for the change.

## Solved Pitfalls

- Corepack resolving `pnpm/latest` can fail; prefer the pinned package manager version.
- Vite 6 and Vitest 2 produced conflicting Vite types. Web uses Vite 5.4.x for now.
- Mongoose ESM should use `import mongoose, { Schema } from "mongoose"`.
- `tsx watch` may need escalated permissions because it creates IPC sockets under temp directories.
- Hidden directories like `.agents` and `.codex` may need escalated filesystem permissions in this environment.
- `canvas.getContext("2d")` throws in jsdom; wrap canvas access in try/catch.
- Poppler tools were missing during PDF analysis. `pypdf` was installed temporarily at `/private/tmp/codex-pdfdeps`.
