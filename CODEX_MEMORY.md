# Codex Memory - Atellier Studio

Durable active memory for future Codex sessions. Read this before implementation work.
Long history and setup details live in docs so this file stays small.

## Read With

- `AGENTS.md`
- `docs/current-state-and-next-steps.md`
- `docs/next-work-plan.md`
- `docs/history/implementation-log.md`
- `docs/operations/local-setup.md`

## User Preferences

- Do not commit, push, or open PRs until the user explicitly asks.
- Keep changes grouped so future commits/PRs can be separated by feature or implementation area.
- The user wants local review first: compile, inspect UI, and verify behavior before publishing.
- Add useful tests as work changes, but avoid large or noisy test suites.
- When publishing is requested, follow `CONTRIBUTING.md`.
- Use `main` as stable branch and `dev/1.0.0` as integration branch.
- Prefer `pnpm`.

## Product Identity

- Atellier Studio is a private, local-first AI operating system for personal and mini-agency work.
- It is not a game, public SaaS MVP, generic task board, multiplayer product, or cloud product yet.
- Core loop: source/input -> wiki update -> task -> agent run -> review -> deliverable -> memory update.
- Markdown wiki is durable operational memory. MongoDB is operational state.
- Pixel atelier is a visualization layer; memory, execution, review, and learning loops are the product.

## Current Local Setup

- Repo: `/Users/e.juarez/Desktop/atellier-studio`
- GitHub remote: `https://github.com/Loored/atellier-studio.git`
- Local branch: `dev/1.0.0`
- Package manager: `pnpm@9.15.4`
- Docker path: Docker CLI + Docker Compose + Colima, not Docker Desktop.
- Mongo container: `atellier-mongo` from `mongo:7`, exposed on `localhost:27017`.
- API default: `http://127.0.0.1:4000`
- Web dev server has used: `http://127.0.0.1:5174/`

See `docs/operations/local-setup.md` for install commands and solved setup pitfalls.

## Local Hygiene Rules

- `.gitignore` now excludes local-only session folders: `.claude/` and `.refs/`.
- Root-level UI review screenshots are ignored (`agents-check.png`, `ui-check-*`, `dashboard-*`, `office-*`, `review-*`).
- Auto-generated deliverables in `atelier/wiki/deliverables/` are ignored only when filename starts with a 24-hex ObjectId prefix (`<24hex>-*.md`).
- Curated wiki memory remains tracked: `atelier/wiki/deliverables/index.md`, `atelier/wiki/log.md`, and non-ObjectId deliverables.

## Current Architecture Constraints

- Frontend API chain must remain: service function -> API hook -> feature hook/coordinator -> visual component.
- Components must not call `fetch` or axios directly.
- Services only perform HTTP requests.
- API hooks own TanStack Query cache, invalidation, and API alerts.
- Feature hooks coordinate UI state and rename generic query fields.
- Fastify routes should stay thin; services own business logic.
- Tests must not call real OpenAI, Codex, MCP, or external LLM tools.
- Important work should update `atelier/runs` and `atelier/wiki/log.md`.
- Raw sources under `atelier/raw` are immutable.

## UI And Tailwind Notes

- Tailwind CSS v4 is installed in `apps/web`; there is no `tailwind.config.js`.
- Tailwind v4 tokens live in `apps/web/src/styles.css` under `@theme`.
- Use `apps/web/src/lib/cn.ts` for conditional classes.
- **Critical:** the global `button {}` and `input, select {}` rules in `styles.css` MUST stay inside `@layer base {}`. If moved outside, they override Tailwind utilities and break all inline class overrides on button/input elements.
- The app is in a hybrid CSS state:
  - migrated: shell, sidebar, dashboard, agent/task/wiki/run/deliverable/orchestration panels
  - migrated: `OfficeView.tsx`, `AgentSidePanel.tsx` — rebuilt with Tailwind in 2026-05-05 session
  - not migrated: `MobileView.tsx` — deferred
- `AgentDetailPanel.tsx` has been superseded by `AgentSidePanel.tsx` (fixed right column, Tailwind). The old floating panel is no longer used.
- Keep `.status-badge`, `.status-badge-*`, `.spin`, `.status-dot--live`, `.agent-float-*`, `.mobile-*`, `.office-*` as CSS classes (dynamic interpolation or legacy).
- Claude's Tailwind handoff is in `docs/session-2026-05-05-tailwind-migration.md`.

## Agentic Design Principles

Karpathy synthesis for this project:

- Do not build a magic autonomous agent. Build a small operating system around the LLM.
- The moat is context, tools, permissions, verification, memory, and supervision quality.
- Use an autonomy slider: explain -> suggest -> prepare artifact -> execute with approval -> monitored execution.
- Prefer small, verifiable tasks with diffs, logs, previews, tests, and accept/reject controls.
- Build for agents with Markdown, schemas, clear APIs, reproducible commands, and inspectable logs.
- Human taste, judgement, and approval remain first-class product surfaces.

Source summary: `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.

## Current Priorities

1. Executor/model safety visibility: make real OpenAI mode and model profile obvious before runs.
2. Wiki Brain MVP: deterministic `ingest`, `query`, and `lint` routes before heavier agent autonomy.
3. Codex Worker design doc: plan command execution, sandbox, approvals, logs, tests, and UI controls before building.
4. Orchestration reliability: keep templates readable and avoid growing one huge orchestration service.
5. MCP later: only after Wiki Brain, model safety, and Codex Worker are stable.

Do not spend the next cycle polishing pixel sprites, auth, cloud deployment, multiplayer, or broad MCP.

## Recent Operational Notes

### 2026-05-05 - Full UI redesign + Office pixel engine

- Sidebar expanded from 64px icon-only to 220px icon+label rows. `--sidebar-w` updated.
- AppShell header now shows executor mode/model/profile pulled from `useHealthApi` — executor visibility (Priority 1) partially addressed.
- Dashboard: flat grouped KPI row replacing nested bordered sections. `MetricCard` always a `div` (never `button`).
- Review view: 5 status tabs + search + inline actions + right `WikiPanel` column.
- `OfficeView.tsx` restructured: fixed `AgentSidePanel` (340px) replaces floating overlays; status legend overlay; filter chips.
- `AgentSidePanel.tsx` (new): Current Task + progress bar + HANDOFFS/ACTIVITY tabs + terminal + instructions + message composer.
- Pixel canvas bug fixed: idle wander oscillation kept `isMoving=true` forever → sprites walked in place. Removed wander.
- Renderer: dark nameplates with status dot + color-coded glow, action bubbles above sprites (status + step + handoff target + loading dots), destination markers (dashed line + pulsing ring), two-pass connection lines (soft purple mesh for all working agents + bright teal arrows for explicit handoffs).
- Full daily summary: `atelier/runs/2026-05-05-daily-summary.md`.

### 2026-05-05 - Tailwind migration by Claude

- Tailwind CSS v4, `@tailwindcss/vite`, `clsx`, and `tailwind-merge` were added.
- Most dashboard/shell panels moved to Tailwind utilities.
- Office and mobile views remain on legacy CSS classes.
- Session doc says PR #13 merged into `dev/1.0.0`; PR #14 from `dev/1.0.0` to `main` was open at handoff time.

### 2026-05-05 - Karpathy insights + memory refresh

- PDF source preserved at `atelier/raw/references/2026-05-05-insights-karpathy-agentes-llm.pdf`.
- Wiki source summary added at `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.
- Next work plan added at `docs/next-work-plan.md`.
- Historical implementation detail moved out of this file to `docs/history/implementation-log.md`.

## Current Validation Commands

```bash
pnpm typecheck
pnpm test
pnpm build
docker compose ps
curl -s http://127.0.0.1:4000/health
```

Run the smallest relevant subset for documentation-only changes.

## Pitfalls Already Solved

- **`button {}` outside `@layer base` overrides all Tailwind utilities on button elements** — always keep base element rules inside `@layer base` in `styles.css`. Symptom: sidebar nav, metric cards, or any button with Tailwind color/border classes looks purple/glowing regardless of what classes are applied.
- `pnpm` was unavailable until Corepack was enabled and `pnpm@9.15.4` prepared.
- Corepack resolving `pnpm/latest` can fail; prefer the pinned package manager version.
- Vite 6 and Vitest 2 produced conflicting Vite types. Web uses Vite 5.4.x for now.
- Mongoose ESM should use `import mongoose, { Schema } from "mongoose"`; do not import `models` as a named export.
- `tsx watch` may need escalated permissions because it creates IPC sockets under temp directories.
- Hidden directories like `.agents` and `.codex` may need escalated filesystem permission in this environment.
- `canvas.getContext("2d")` throws in jsdom; always guard canvas access with try/catch.
- This environment did not have Poppler or Python PDF packages by default; `pypdf` was installed temporarily under `/private/tmp/codex-pdfdeps` for PDF extraction.

## Update Rule

When a future change alters setup, scripts, architecture, operational behavior, or user preferences, update this file if it affects active memory. Put long chronology in `docs/history/implementation-log.md` and append an event to `atelier/wiki/log.md`.

## Memory Update Protocol

Use this quick protocol at the end of implementation work:

1. Create or update a run log in `atelier/runs/` for the session.
2. Append one durable event to `atelier/wiki/log.md` (decision, run completion, or wiki maintenance).
3. Update `CODEX_MEMORY.md` only for active memory changes:
   - local setup/runtime changes
   - branch or workflow policy changes
   - architecture constraints and conventions
   - current priorities
   - solved pitfalls likely to recur
4. Move long narrative details to `docs/history/implementation-log.md`.
5. If priorities changed, sync `docs/next-work-plan.md`.

Keep this file compact and high-signal. If a detail is not likely to help the next session act better, it belongs in the history log instead.
