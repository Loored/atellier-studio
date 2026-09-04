# Run Log - Local Dev Launcher v1

- Date: 2026-08-25
- Branch: `codex/local-dev-launcher`
- Outcome: implemented and live-validated

## Goal

Turn repeated local startup friction into one safe, deterministic command without silently installing dependencies, killing unrelated processes, or expanding execution authority.

## Delivered

- Added executable `./scripts/dev-local` plus `pnpm dev:local` and a non-mutating `--check` mode.
- Loaded the repository `.env` with explicit shell variables retaining priority.
- Preferred repository-pinned `pnpm@9.15.4` through Corepack, with direct `pnpm` fallback.
- Validated Node 22+, installed dependencies, configured ports, Docker CLI/Compose, Docker daemon, and Mongo ping.
- Started Colima only when needed, ensured the Compose Mongo service, then launched API, durable worker, and Vite on explicit loopback URLs.
- Waited for API `/health` and web HTML readiness before printing the operator handoff.
- Failed closed on occupied ports and stopped only launcher-owned child process groups on `SIGINT`/`SIGTERM`; Mongo remains running.
- Added behavior tests for argument parsing, ports, Node compatibility, Corepack preference, service commands, and overlapping endpoints.

## Live validation

- Launcher behavior tests passed: 6/6.
- `corepack pnpm install --frozen-lockfile` confirmed the lockfile and installed workspace were already current.
- Direct production builds passed for Shared, API, Web, and MCP server; Vite retained the existing large-chunk advisory.
- The root build alias encountered the documented non-TTY dependency-purge guard, so validation used the established direct-workspace fallback without changing dependencies.
- Preflight passed with Node `v22.23.2`, Corepack-pinned pnpm `9.15.4`, Docker Compose `5.1.3`, Colima, and Mongo 7.
- Full launcher passed against isolated `atellier_launcher_validation` with API `4010`, Web `5180`, and `AGENT_EXECUTOR_MODE=mock`.
- API `/health` returned `status=ok`, `storageMode=mongo`, `mongo.connected=true`, and `executorMode=mock`.
- The browser rendered the Dashboard, loaded the orchestration stages through the isolated API, and reported no console warnings or errors.
- `Ctrl+C` produced graceful worker `stopping`/`stopped` diagnostics, released ports `4010` and `5180`, and left Mongo running.
- A default-port preflight detected the existing API on `4000`, exited with code 1, killed nothing, and the original Ollama-backed API remained healthy.
- The isolated validation database was verified empty and dropped after each live run; `atellier_studio` was not touched.

## Operational notes

- `pnpm dev` remains available for manual all-workspace development and still includes the MCP server; it does not replace the standalone worker or Docker startup.
- Environment overrides keep isolated validation possible without disturbing an existing local session.
- The launcher does not execute an agent run or call an external LLM during startup or automated tests.
- No new external raw source was introduced; this bounded slice came from repeated operator startup friction already recorded in project history.
