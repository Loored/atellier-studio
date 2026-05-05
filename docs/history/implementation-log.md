# Implementation Log

Long chronological implementation memory moved out of `CODEX_MEMORY.md` so future Codex sessions can load active context cheaply and open this file only when history matters.

## 2026-05-04 - Milestone 0 spine

- Created pnpm monorepo with `apps/api`, `apps/web`, and `packages/shared`.
- Added Fastify API with agents, tasks, runs, wiki routes, Mongoose models, and route tests.
- Added React/Vite dashboard with TanStack Query service -> API hook -> feature hook -> component flow.
- Added Markdown wiki index/log and task files under `atelier/`.
- Added Docker Compose MongoDB setup.
- Verified `pnpm test`, `pnpm typecheck`, and `pnpm build`.

## 2026-05-04 - Local Docker/Mongo setup

- Installed Docker CLI, Docker Compose plugin, and Colima through Homebrew.
- Started Mongo with `docker compose up -d mongo`.
- Verified Mongo with `docker exec atellier-mongo mongosh --quiet --eval 'db.runCommand({ ping: 1 })'`.
- Switched API from `dev:memory` to normal Mongo-backed `dev`.

## 2026-05-04 - V3 Codex hardening

- Added `CODEX_MEMORY.md` and instructed future agents to read it through `AGENTS.md`.
- Added app-level `AGENTS.md` files for frontend and backend conventions.
- Added `.agents/skills` workflows for wiki ingest, API layer work, feature building, test running, and review.
- Added `.codex/config.toml` with conservative workspace defaults.
- Added Codex helper scripts to `package.json`.
- Added dashboard run-log append UI.

## 2026-05-04 - Git workflow standard

- Added `CONTRIBUTING.md` and `.github/pull_request_template.md`.
- Standardized commit subjects, PR sections, branch naming, and `main`/`dev/1.0.0` flow.

## 2026-05-04 - UI/UX and security review

- Installed user-scoped skills: `pdf`, `security-threat-model`, `security-best-practices`, and `playwright`.
- Improved dashboard layout and mobile metrics.
- Added shared task title and run log message length limits in API and UI.
- Hardened API defaults with `127.0.0.1` host, local CORS reflection, 1 MiB body limit, and baseline security headers.
- Captured notes at `atelier/wiki/synthesis/2026-05-04-ui-security-review.md` and `atelier/runs/2026-05-04-ui-security-review.md`.

## 2026-05-04 - Agent run execution spine

- Added `POST /agents/:id/run` and `GET /agents/:id/messages`.
- Added persistent `Message` model/service.
- Added run lifecycle updates, persisted messages, latest run previews, and API tests.

## 2026-05-04 - Executor mode switch

- Refactored execution into `mock` and `openai` modes.
- Added `AGENT_EXECUTOR_MODE`, `OPENAI_API_KEY`, and `OPENAI_MODEL`.
- Kept tests stable by defaulting tests to mock behavior.

## 2026-05-04 - Handoff MVP and streaming

- Added SSE streaming route `/agents/:id/run/stream`.
- Added handoff fields and chained run handoff flow.
- Added panel controls to choose handoff target and pass optional instructions.
- Added API tests for handoff.

## 2026-05-04 - Handoff policy guardrails

- Added `AGENT_MAX_HANDOFF_DEPTH` and `AGENT_EXECUTION_TIMEOUT_MS`.
- Added depth/cycle detection and executor timeouts.
- Removed accidental plaintext API key from README examples.

## 2026-05-04 - Stream reliability fixes

- Added id validation for agent/run routes supporting Mongo ObjectId and memory UUID ids.
- Fixed SSE stream CORS headers.
- Added regression coverage for stream CORS.

## 2026-05-04 - Agent panel interactivity

- Made `Open Agent Terminal` functional.
- Added commands: `help`, `status`, `unblock`, `clear`, `run <instruction>`, `set-status <status>`, and `handoff <agent-name-or-id> :: <instruction>`.
- Added explicit `Resume` action for `blocked` and `needs-human`.

## 2026-05-04 - Parallel ops hardening

- Added persistent agent `instructions`.
- Expanded `/health` with storage/executor mode, Mongo state, waiting-agent count, active-run count, and process memory.
- Added run completion metadata: `reviewStatus` and `deliverablePath`.
- Added browser notifications and mobile badge for `needs-human`.
- Validation: `pnpm typecheck` and `pnpm test`.

## 2026-05-04 - Run review and deliverables dashboard

- Added `PATCH /runs/:id/review`.
- Added timeline review actions and filters.
- Added `DeliverablesPanel`.
- Added API and web tests.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web`.

## 2026-05-04 - Deliverable preview and auto review defaults

- Added safe `GET /wiki/page?path=<relative-path>`.
- Added inline deliverable preview.
- Added default review states on run completion.
- Added dashboard metrics for waiting/review queues.
- Added API tests.

## 2026-05-04 - Auto deliverables and approval audit

- Added `WikiService.writePage` with path safety.
- Auto-generates deliverables for completed runs with summaries.
- Logs `Deliverable accepted` decisions on approved reviews.
- Added API tests.

## 2026-05-04 - Manual deliverable promotion and index refresh

- Added `PATCH /runs/:id/promote-deliverable`.
- Rebuilds `wiki/deliverables/index.md` on write.
- Added `Promote` action and tests.

## 2026-05-05 - Deliverable unlink and index metadata

- Added `PATCH /runs/:id/unlink-deliverable`.
- Added `WikiService.deletePage`.
- Added deliverables index `Type` and `Review` columns.
- Added timeline `Unlink` control and tests.

## 2026-05-05 - Deliverable unlink confirmation and panel filters

- Added client-side unlink confirmation.
- Added Deliverables panel filters by run type and review status.
- Validation: `pnpm test:web` and `pnpm test:api`.

## 2026-05-05 - Real integration runtime default

- Removed fake `useOrchestrationSim` runtime usage from office experience.
- Removed simulation toggle from office bottom bar.
- Backend executor selection defaults to real OpenAI mode when `OPENAI_API_KEY` is set.

## 2026-05-05 - Skill-triggered agent orchestration

- Added shared orchestration types and `orchestration` run type.
- Added `GET /orchestrations/skills` and `POST /orchestrations/skills/:skillId/run`.
- Added `SkillOrchestrationService` with `atellier-build-loop` and `llm-wiki-ingest-loop`.
- Added dashboard Orchestration panel.
- Added `.agents/skills/atellier-agent-orchestrator/SKILL.md`.
- Preserved LLM Wiki/orchestration reference under `atelier/raw/references/`.
- Summarized the decision in `atelier/wiki/workflows/agent-skill-orchestration.md`.
- Parent orchestration runs are reviewable deliverables; child runs suppress automatic deliverables.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web`.

## 2026-05-05 - Real orchestration toggle restored

- Restored Office orchestration toggle using real backend execution through `useOrchestrationLive`.
- Periodically dispatches real `run` requests for eligible agents with role-specific instructions.
- Non-test runtime now requires `OPENAI_API_KEY` unless `AGENT_EXECUTOR_MODE=mock` is explicit.
- Validation: `pnpm typecheck`, `pnpm test:api`, and `pnpm test:web`.

## 2026-05-05 - Tailwind CSS v4 migration

- Installed Tailwind CSS v4 with `@tailwindcss/vite`, `clsx`, and `tailwind-merge`.
- Added `apps/web/src/lib/cn.ts`.
- Rewrote `apps/web/src/styles.css` around Tailwind v4 `@theme` tokens plus root aliases.
- Migrated shell, sidebar, dashboard, agents, tasks, wiki, runs, deliverables, and orchestration panels to Tailwind utilities.
- Deferred `OfficeView.tsx`, `AgentDetailPanel.tsx`, and `MobileView.tsx`.
- Handoff doc: `docs/session-2026-05-05-tailwind-migration.md`.

## 2026-05-05 - Karpathy insights and memory refresh

- Preserved `Insights_Karpathy_Agentes_LLM.pdf` under `atelier/raw/references/`.
- Added source summary: `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.
- Added next work plan: `docs/next-work-plan.md`.
- Compact active memory now lives in `CODEX_MEMORY.md`; long history lives here.
