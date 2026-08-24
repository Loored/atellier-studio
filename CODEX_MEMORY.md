# Codex Memory - Atellier Studio

Durable active memory for future Codex sessions. Read this before implementation work.
Long history and setup details live in docs so this file stays small.

## Read With

- `AGENTS.md`
- `docs/current-state-and-next-steps.md`
- `docs/roadmap.md`
- `docs/next-iteration-plan-2026-05-06.md`
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
- Active branch policy: work from `dev/1.0.0` into short-lived feature branches; keep `main` stable.
- Package manager: `pnpm@9.15.4`
- Docker path: Docker CLI + Docker Compose + Colima, not Docker Desktop.
- Mongo container: `atellier-mongo` from `mongo:7`, exposed on `localhost:27017`.
- API default: `http://127.0.0.1:4000`
- Web dev server has used: `http://127.0.0.1:5174/`

See `docs/operations/local-setup.md` for install commands and solved setup pitfalls.

## Local Hygiene Rules

- `.gitignore` now excludes local-only session folders: `.claude/` and `.refs/`.
- `.gitignore` now excludes local-only browser automation folders: `.playwright-mcp/` and `.playwright-cli/`.
- Root-level UI review screenshots are ignored (`agents-check.png`, `ui-check-*`, `dashboard-*`, `office-*`, `review-*`).
- Auto-generated deliverables in `atelier/wiki/deliverables/` are ignored only when filename starts with a 24-hex ObjectId prefix (`<24hex>-*.md`).
- Auto-generated deliverables in `atelier/wiki/deliverables/` are also ignored when filename starts with a UUID prefix (`<uuid>-*.md`).
- Auto-generated Codex Worker finalize logs in `atelier/runs/YYYY-MM-DD-codex-worker-<uuid>.md` are ignored by default; promote useful outcomes into narrative run logs.
- Curated wiki memory remains tracked: `atelier/wiki/deliverables/index.md`, `atelier/wiki/log.md`, and non-ObjectId deliverables.
- Memory artifact policy lives in `docs/memory-artifact-hygiene.md`.

## Current Architecture Constraints

- Frontend API chain must remain: service function -> API hook -> feature hook/coordinator -> visual component.
- Components must not call `fetch` or axios directly.
- Services only perform HTTP requests.
- API hooks own TanStack Query cache, invalidation, and API alerts.
- Feature hooks coordinate UI state and rename generic query fields.
- Fastify routes should stay thin; services own business logic.
- Mongo-backed skill orchestrations are queued by the API and executed by the separate `apps/api/src/worker.ts` process. Memory mode uses an inline worker only for tests/local UI review.
- Durable orchestration recovery is at-least-once: leases and heartbeats reclaim abandoned runs, while completed child steps keyed by `orchestrationStepId` are reused.
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

Active plan: [`docs/roadmap.md`](docs/roadmap.md). P1-P4 from the 2026-05-06 platform-alignment plan are done. Knowledge Graph v2 shipped across PRs #29-#32; PR #35 then completed role memory, snapshot diff, curation signals, performance hardening, Office sub-tabs, and role-memory overlays/focus filters. Durable Local Runtime v1 shipped in PR #36.

1. **Durable Runtime hardening v1.1**: worker diagnostics, graceful shutdown, optional provider abort support, and idempotency requirements for irreversible tools. Multi-worker Mongo claim/reclaim and ordered-event concurrency coverage is complete.
2. **Controlled real Codex Worker adapter**: replace the fake adapter only behind a feature flag, existing approvals, constrained working directories/commands, and durable evidence capture.
3. **Daily-use operational loop**: validate source -> wiki -> task -> durable run -> deliverable/change -> QA -> review -> memory as one recoverable reference workflow.
4. **Review-to-memory learning**: promote approved outcomes into curated role memory and curation signals without silent autonomous writes.

Do not spend the next cycle polishing pixel sprites, expanding the pixel office, auth, cloud deployment, multiplayer, Computer Use, Batch/Citations/Files API, or broad creative connectors.

## Recent Operational Notes

### 2026-08-24 - Multi-worker Mongo hardening

- A dedicated opt-in Mongo suite verifies one-winner queue claims, expired-lease reclaim, stale-owner rejection, concurrent event sequencing, and duplicate-index protection with independent queue/service instances.
- Heartbeats, worker-owned transitions, and step events now require a matching, unexpired parent lease, preventing a paused or reclaimed worker from reviving its lease or appending late activity.
- Run with `pnpm test:api:mongo-runtime`; it uses a unique database and drops it after completion. Normal API tests skip the Mongo suite.

### 2026-08-24 - Post-merge durability drill and hardening fixes

- Isolated Mongo + local Ollama validation passed for worker-offline queueing, lease reclaim after worker interruption, completed-step reuse, ordered event replay, cancellation at a step boundary, manual retry, and UI rehydration.
- Runs history now exposes retry for failed/blocked orchestration runs, so recovery remains available after a refresh.
- A reclaimed parent now marks non-terminal child runs from interrupted attempts as failed/superseded before resuming, preventing stale global `running` counts.
- Remaining hardening work: true multi-worker Mongo contention coverage, worker diagnostics/graceful shutdown, provider abort support, and idempotency requirements for irreversible tools.

### 2026-08-24 - Durable local orchestration runtime v1

- Skill orchestration dispatch now persists a queued run with a versioned execution envelope, immutable definition snapshot/hash, attempt budget, lease metadata, and cancellation state.
- `RunEvent` records ordered replayable activity; APIs expose detail, filtered discovery, event replay/SSE, cancellation, and retry.
- `apps/api/src/worker.ts` is the separate Mongo worker entrypoint (`pnpm dev:worker`). API and worker share parsed provider/runtime environment configuration.
- Recovery reuses completed step runs by stable `orchestrationStepId`; cancellation is cooperative at step boundaries.
- The dashboard rehydrates queued/running orchestrations after refresh and shows durable phase, attempt, events, cancel, and retry controls through the required frontend API chain.
- Knowledge Graph and Wiki Dream grounding lint reads no longer append Wiki log entries; explicit lint API calls still do.
- Runtime semantics and limitations are documented in `docs/durable-local-runtime.md`.

### 2026-05-13 - Dream decision trail + persisted snapshots shipped

- Wiki Dream proposals now support explicit `accepted/rejected/deferred` decisions through `POST /wiki/dream-decisions`.
- Decisions persist as markdown pages under `wiki/decisions/`, append `decision` entries to `wiki/log`, and appear in the graph as `dream-decision` nodes with `dream_decision_for_report` edges.
- Knowledge Graph snapshots now persist to `atelier/_runtime/graph-snapshots/*.json` (still ring-buffered at 48 and throttled 1/hour).
- `KnowledgeGraphService.initialize()` loads persisted snapshots on server startup; API test coverage verifies snapshots survive restart.
- Web UI now includes Dream decision actions in `WikiPanel`, decision filters/counts in Graph view, and report-path navigation from the inspector.

### 2026-05-13 - Knowledge Graph v2 shipped (PRs #29-#32)

The Graph view evolved from a static hub-and-spoke SVG (22 nodes/2 edges) into a force-directed live map with **94 nodes / 59 edges** from real local memory. Four PRs merged to `dev/1.0.0`:

- **#29 — Foundation**: `react-force-graph-2d` canvas, inspector with markdown render, ⌘K SearchBar, URL-synced filters/density/selection, sesión viva polling (15s), hover tooltip, layer breakdown, persistent viewport. Backend: ingest wiki/raw assets/runtime logs + parse markdown links + plain-text path mentions + legacy `- Raw path:` metadata.
- **#30 — Seed + Office nav + time-travel**: in-memory seed (6 agents/10 tasks/5 runs auto-populated when `API_STORAGE=memory`), file mtime stamps for time-travel slider, "Volver a Oficina" header button, SearchBar/LayerBreakdown unit tests, App.test fixed with canvas mock + ResizeObserver polyfill.
- **#31 — Bridges**: roster avatars in sidebar become buttons that open agent nodes in graph; AgentSidePanel gets "Ver en grafo" shortcut; AppShell exposes `NavigationBridge`; URL-first navigation avoids the listener-not-mounted race.
- **#32 — Snapshots + extras**: 48-slot in-memory snapshot ring buffer (throttle 1/hour) with `/knowledge/graph/snapshots[/:id]`; TimelineSlider renders snapshot ticks; inspector renders run logs as timeline; Office gets "Knowledge Graph →" header button; MobileView adds 🕸️ Grafo tab; perf tweaks for >250 nodes.

Tests: **72 API + 18 web** (5 new). Typecheck clean across 4 workspaces. The view auto-seeds in memory mode so future sessions start with a populated graph.

Architecture choices to remember:
- URL state via `useUrlState/useUrlSetState/useUrlNullable` hooks (no router).
- Cross-feature navigation via `CustomEvent("knowledge:select" | "knowledge:navigate")` listened to in `useKnowledgeGraphPanel` and `AppShell`.
- Snapshots only in-memory; persisted snapshots are still a candidate next step.
- `MARKED` for markdown render in the inspector (no DOMPurify — local-first content).
- Inspector reads file content via the existing `/wiki/page?path=` endpoint for any textual atelier file.

See `docs/knowledge-graph.md` for the full feature inventory and next candidates.

### 2026-05-13 - Knowledge Graph live + curation loop shipped

- Task 3 shipped: WebSocket live updates for Knowledge Graph with polling fallback in the frontend session hook.
- Task 4 shipped: persisted graph annotations and saved filter presets with full frontend API chain + inspector curation UI.
- Runtime persistence files added:
  - `atelier/_runtime/graph-annotations.json`
  - `atelier/_runtime/graph-filter-presets.json`
- Validation passed post-integration:
  - `pnpm --filter @atellier/web typecheck`
  - `pnpm test:web`
  - `pnpm --filter @atellier/api typecheck`
  - `pnpm test:api`

### 2026-05-13 - Per-run executor override shipped

- Manual agent runs (`POST /agents/:id/run` and `/run/stream`) now accept optional `executorModeOverride`.
- API validates override mode enum and availability in current API session.
- Health payload now includes `availableExecutorModes`.
- Agent-side composer in Office UI now exposes a per-run executor selector (default env mode + available overrides).
- Handoff keeps the selected executor mode for continuity.

### 2026-05-13 - Orchestration override + Codex evidence v1.1 shipped

- Orchestration runs now support optional `executorModeOverride` end-to-end (route validation, service propagation, frontend selector).
- Codex Worker evidence v1.1 now captures richer per-step/aggregate evidence:
  - step `durationMs`
  - artifact `byteSize`
  - finalize counters for failed/blocked/artifact count/total duration.
- Codex panel finalize now submits derived evidence lists and renders richer evidence summaries.

### 2026-05-12 - Knowledge Graph direction added

- Product direction: add a Graph view that visualizes the knowledge network agents are weaving across wiki pages, sources, runs, tasks, deliverables, reviews, dream reports, decisions, contradictions, roles, and agent activity.
- This should start as a local read model over existing state, not a vector DB, graph DB, Slack/Calendar/Drive integration, or neural-network simulation.
- Next sequence: memory hygiene -> graph read model -> Graph View MVP -> Dream/graph curation trail -> role memory.
- Design note: `docs/knowledge-graph.md`.

### 2026-05-12 - Memory artifact hygiene started

- Added `docs/memory-artifact-hygiene.md` to define which local memory artifacts should be tracked or ignored.
- `.gitignore` now ignores UUID-prefixed generated deliverables under `atelier/wiki/deliverables/`, matching the existing ObjectId-prefixed deliverable rule.
- `.gitignore` also ignores generated Codex Worker finalize logs with UUID run IDs; meaningful outcomes should be promoted into narrative run logs and wiki entries.
- Curated docs, wiki log/index, raw inputs, sources, synthesis pages, tasks, and meaningful run logs remain trackable.

### 2026-05-12 - Knowledge Graph read model landed

- Added shared graph types, `KnowledgeGraphService`, `GET /knowledge/graph`, frontend API chain, and Graph view.
- First graph nodes: agents, roles, tasks, runs, wiki pages, deliverables, lint issues.
- First graph edges: agent role, task assignment, run/agent/task, run deliverable, deliverable wiki page, wiki lint issue.
- Visual QA found and fixed generated deliverable artifact flooding. The graph now excludes UUID/ObjectId-generated deliverable wiki pages by default while keeping curated memory visible.
- Relationship cards now show readable labels, and the Graph view includes a node-type legend.
- Validation passed: `pnpm --filter @atellier/api typecheck`, `pnpm --filter @atellier/web typecheck`, `pnpm test:api`, `pnpm test:web`.

### 2026-05-11 - Wiki Dream grounding landed

- `wiki-dream-loop` now grounds its `audit` step with backend context: `wiki.lint()` output plus the current real markdown path list under `atelier/wiki`.
- The curator is instructed to use only listed paths and mark unlisted pages as unverified instead of inventing files.
- API coverage asserts that the audit run context includes lint findings and real wiki paths.
- P2.c also landed: Wiki panel can start a dream, preview the report, and save it explicitly under `wiki/dreams`.
- Next recommended slice: memory artifact hygiene before publishing.

### 2026-05-10 - Branch state, test coverage, and reframe alignment

- Branch `feat/codex-worker-evidence-pass` packages capture-memory (API + frontend chain), the `GET /codex/runs/active` surface, the Codex section in `LiveProcessesPanel` + Codex character in `OfficeView`, broader operational-spine test coverage, and curated wiki refresh.
- API operational-spine test now covers 48 cases (55 total with `agent-response-validator`). New coverage: task list/update + invalid status/priority guards, agent list + status update, agent 404 on run, SSE stream typed events (queued/running/chunk/finalizing/result), `llm-wiki-ingest-loop` end-to-end, codex worker approve guards (no-approval-needed, already-completed), QA + wiki-curator role outputs, run 404 guards, same-agent handoff skip.
- Run `pnpm --filter @atellier/api test` for the focused suite.
- Priority reorder note: this branch's docs (`README.md`, `CODEX_MEMORY.md`) were written before merging the 2026-05-06 strategic reframe; "Current Priorities" and "Next Work" have since been re-aligned to the active plan in [`docs/next-iteration-plan-2026-05-06.md`](docs/next-iteration-plan-2026-05-06.md).

### 2026-05-08 - Codex Worker evidence v1.1 done

- Persisted Codex Worker step evidence (stdout/stderr paths, command, working dir, notes, artifacts).
- Wiki query now returns related pages and possible contradictions to feed reuse and review flows.
- Agent grounding validation v1.2 lands: builder/QA responses validated against verified repo files; approval blocked on critical validation errors.
- Run memory capture lands: `POST /runs/:id/capture-memory` writes a `wiki/synthesis/` page with run metadata, review status, deliverable path, latest logs, validation evidence, and output snapshot. Frontend chain `runs.service -> useRunsApi -> useRunsTimeline -> ReviewView` is wired.

### 2026-05-05 - Safety + Wiki Brain + Codex Worker control-plane

- `/health` includes `executorMode`, `executorModel`, and `modelProfile`.
- OpenAI safety warnings/confirmations are active across:
  - orchestration start
  - manual run start
  - office live mode
  - codex worker run creation
- Wiki Brain MVP is implemented with deterministic routes:
  - `POST /wiki/ingest`
  - `POST /wiki/query`
  - `POST /wiki/lint`
- Codex Worker design doc exists at `docs/codex-worker.md`.
- Codex Worker control-plane v1 is implemented:
  - create/plan/approve-step/execute-next/cancel/finalize
  - transition guardrails
  - blocked-reason UI messaging
  - durable finalize run artifact + wiki event
  - focused API and web tests

### 2026-05-05 - Codex Worker evidence pass v1.1 started

- Step evidence now persists on completed Codex Worker steps as structured metadata.
- Codex Worker panel renders step evidence and finalize evidence counts.
- Finalize run logs now include per-step evidence, changed-file counts, and test-evidence counts.

### 2026-05-08 - Review memory capture slice

- Review can capture completed runs into `wiki/synthesis/` through `POST /runs/:id/capture-memory`.
- Captured run memory includes run metadata, review status, deliverable path, latest logs, validation evidence, and output snapshot.
- Safe wiki page writes now upsert non-deliverable pages into `wiki/index.md`.
- Frontend capture follows the API chain: run service -> run API hook -> `useRunsTimeline` -> `ReviewView`.

### 2026-05-05 - Wiki lint suggestions added

- Wiki lint issues now carry actionable suggestions in the API payload and wiki panel.
- Broken links, missing pages, and stale index entries are easier to scan and fix during review.

### 2026-05-05 - Wiki query contextual reuse added

- Wiki query responses now include related pages and possible contradictions.
- The wiki panel renders those hints so query results can feed reuse and review flows directly.

### 2026-05-05 - Agent grounding validation v1.2

- OpenAI-backed chat agents are treated as proposal agents, not file-editing agents.
- Builder outputs should use `Candidate files` for proposed paths; `Changed files` is reserved for future diff-backed execution.
- Agent validation now checks builder paths mentioned anywhere in the response against recursive verified repo file hints.
- Review approval remains blocked when validation has critical errors.
- Agent panel validation prefers the just-finished stream result before falling back to `/runs` refetch data.

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
- In this non-TTY Codex environment, root `test:web`/`test:api` aliases may trigger a nested pnpm dependency-purge guard; run the direct workspace scripts (`pnpm --filter @atellier/web test` and `pnpm --filter @atellier/api test`) when that happens.
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
