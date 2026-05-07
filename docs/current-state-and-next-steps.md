# Atellier Studio — Current State and Next Steps

> **2026-05-06 — direction updated.**
> The strategic reframe and active priorities live in [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md). This file is still a useful product/architecture snapshot, but for *what to do next*, read the iteration plan first. See the new section [§ 2026-05-06 strategic reframe](#2026-05-06-strategic-reframe) below.

This document captures the product/architecture review after the initial Atellier Studio implementation. It is intended for future Codex sessions so they understand what has already been built, what still matches the original vision, and what should happen next.

Read this together with:

- `AGENTS.md`
- `CODEX_MEMORY.md`
- `README.md`
- `apps/web/AGENTS.md`
- `apps/api/AGENTS.md`
- [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md) (active plan)
- [`docs/roadmap.md`](roadmap.md)

## Executive verdict

Atellier Studio is directionally correct and already satisfies most of the original vision for this stage.

It is no longer just boilerplate. It has a real operational spine:

- private/local-first product identity
- monorepo structure
- Fastify API
- React/Vite dashboard
- MongoDB operational state
- Markdown wiki memory
- agents/tasks/runs
- deliverables and review lifecycle
- skill-triggered orchestration
- Codex rules, memory, and skills
- frontend API conventions
- BED/FED tests

Estimated current alignment with the original vision: **75–85% for this phase**.

The project should now focus on **learning and execution quality**, not more visual polish.

## 2026-05-05 status update

The documentation/memory cleanup recommended below has started:

- `CODEX_MEMORY.md` is now compact active memory.
- Long chronology moved to `docs/history/implementation-log.md`.
- Local setup moved to `docs/operations/local-setup.md`.
- README, architecture, agent protocol, and roadmap now describe the current stage instead of only Milestone 0.
- Karpathy agentic-system insights were ingested into `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`.
- Safe wiki page write/update route is now merged and wired into the wiki panel.
- The next prioritized work is captured in [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md) (supersedes `docs/next-work-plan.md` as of 2026-05-06).

The immediate implementation priority is **MCP server wrapper + Wiki Dream loop + Anthropic executor mode** — see the iteration plan for scope. Codex Worker evidence pass moved to P5.

## 2026-05-06 strategic reframe

The *Code with Claude 2026* keynote shipped capabilities that overlap heavily with Atellier's direction:

- **Auto Dream** in Claude Code consolidates memory files (prune stale, resolve contradictions, reorganize) — same conceptual role as our `wiki-curator`.
- **Claude Cowork** went GA on macOS/Windows — desktop app with isolated VM, local file access, native MCP. This is the desktop client we no longer need to build.
- **Opus 4.7** improves coding + vision at the same price as 4.6 and supports native prompt caching.
- **Skills 2.0** packages workflows with scripts + templates + reference materials.
- **Multi-agent orchestration** in Managed Agents (leader/sub-agent) is now public beta.

This validates the direction but **raises the bar**. The question is no longer *"are we building the right thing?"* but *"what does Atellier do that the platform doesn't?"*

**Our answer:** Atellier is the **structured model of *your* work** — wiki, runs, tasks, deliverables, review — running on top of platform primitives. Not a competitor to Cowork. Not a runtime. Personal and local-first.

What changes from the previous plan:

- **MCP server wrapper** moves to P1 (was "Not Now"). Targeted at Cowork + Claude Code.
- **Wiki Dream loop** becomes P2 (replaces vague "Wiki Brain v2"). Tailored to our structured wiki, not flat files.
- **Anthropic executor mode** added as P3. `AGENT_EXECUTOR_MODE=anthropic`, Opus 4.7 default, prompt caching enabled.
- **Skills 2.0 alignment** added as P4 to keep `.agents/skills/` from diverging from the platform format.
- **Codex Worker Evidence Pass** moves to P5 (was P1).
- **Pixel Office expansion** explicitly off the priority list — the *Pixel Agents* VS Code extension by Pablo Deuca shipped a pure-visualization version, validating the aesthetic. Don't double down on the visual layer; double down on the work model.

What stays unchanged:

- Local-first, personal, not a SaaS.
- LLM Wiki philosophy (markdown as durable memory; MongoDB as operational state).
- Frontend `services → API hooks → feature hooks → components` layering.
- No real Codex/MCP/OpenAI/Anthropic in tests.
- No dangerous Codex flags ever.

## Original product vision

Atellier Studio is a private, local-first AI operating system for daily work and mini-agency style operations.

It is not:

- a public SaaS MVP
- a game
- a generic task manager
- a multiplayer/team product yet

The intended core loop is:

```txt
source/input → wiki update → task → agent run → review → deliverable → memory update
```

The pixel/atelier UI is only a visualization layer. The true product is persistent operational memory plus controlled agent execution.

## What is already working well

### 1. Product identity is strong

`AGENTS.md` correctly defines Atellier Studio as a private local-first AI operating system for personal and mini-agency style work.

It also correctly states that Atellier is not a game and not a public SaaS MVP.

This matches the original direction.

### 2. LLM Wiki philosophy is encoded

The root `AGENTS.md` includes the LLM Wiki principle:

- do not treat the wiki as passive notes
- treat it as persistent operational memory
- prefer durable markdown, explicit links, chronological logs, source summaries, client/project/entity pages, contradiction notes, and human-readable run outputs
- avoid hiding important context only in MongoDB
- avoid relying only on chat history
- avoid building a generic task app with no memory layer

This is one of the most important parts of the project.

The architecture must continue to protect this distinction:

```txt
MongoDB = operational state
Markdown wiki = durable human-readable memory
```

### 3. Monorepo structure is correct

The project correctly uses one repo rather than separate frontend/backend repos.

Expected structure:

```txt
apps/web        → frontend
apps/api        → backend
packages/shared → shared contracts/types/constants
atelier/        → raw/wiki/tasks/runs memory layer
.agents/skills  → Codex workflows
.codex/         → Codex config
```

This is the right structure for a private/local-first fullstack project.

### 4. Frontend conventions are implemented

The frontend convention we wanted is present:

```txt
service function → API hook → feature hook/coordinator → visual component
```

Codex should preserve this. Do not allow components to call `fetch`/`axios` directly.

The project already includes important API-layer primitives such as:

- query keys
- query wrapper
- mutation wrapper
- hook callbacks
- API alerts
- feature hooks

Future frontend work should follow the same vertical slice pattern.

### 5. Backend conventions are in place

The API conventions are correct:

- Fastify owns HTTP routes
- Mongoose owns MongoDB models
- services own business logic
- route handlers should stay thin
- tests should use Fastify `app.inject`
- tests should not require real Codex/MCP/OpenAI execution

Continue preserving this separation.

### 6. Agent orchestration exists

The project now has skill-triggered orchestration routes and services.

Current orchestration skills include:

- `atellier-build-loop`
- `llm-wiki-ingest-loop`

The build loop follows the original Pepe/Toto/Jaco idea, but formalizes it into phases:

- PM / scope
- Builder / implementation planning
- Runtime / compile/run checks
- QA / blocker reporting
- Fix pass
- Approval
- Wiki memory capture

This is very aligned with the original goal.

### 7. Deliverables and review lifecycle exist

Runs can now become deliverables.

The system supports:

- auto deliverable generation
- manual deliverable promotion
- deliverable unlink
- deliverable preview
- review states
- approval audit entries
- deliverables index metadata

This is a strong step toward Atellier becoming a real mini-agency operating system instead of a toy.

### 8. Tests exist and should stay focused

The repo has backend and frontend tests and root scripts for validation.

Keep tests focused on critical behavior:

- API routes
- run lifecycle
- orchestration lifecycle
- wiki/deliverable safety
- frontend interaction flows
- service/API hook conventions

Avoid:

- huge snapshots
- styling-only tests
- tests that call real OpenAI/Codex/MCP tools

## Main gaps and risks

### 1. README/current-state drift

Status: initial cleanup started on 2026-05-05.

The README previously described the project as Milestone 0 / Operational Spine, but the codebase had moved beyond that.

Current stage is closer to:

```txt
Operational Spine + Agent Orchestration + Deliverables + Review UI
+ Pixel Office + Wiki Brain MVP + Codex Worker control-plane v1
+ Executor cost safety
```

Next stage (per the 2026-05-06 reframe):

```txt
MCP server wrapper + Wiki Dream loop + Anthropic executor
+ Skills 2.0 alignment + Codex Worker evidence pass
```

Recommended ongoing action:

- keep `README.md`, `CODEX_MEMORY.md`, and roadmap docs aligned with the current implementation
- avoid saying Pixel UI is purely future because it already exists
- continue clarifying that MCP and Codex Worker are still pending

### 2. CODEX_MEMORY.md is becoming too large

`CODEX_MEMORY.md` is useful but is starting to behave like a full implementation history.

That can make future Codex sessions noisy and expensive.

Recommended split:

```txt
CODEX_MEMORY.md                       → compact active memory

docs/history/implementation-log.md     → long chronological log

docs/operations/local-setup.md         → Docker/Colima/Mongo setup

docs/architecture/current-state.md     → architecture snapshot
```

Keep `CODEX_MEMORY.md` focused on:

- user preferences
- current local setup
- active branch policy
- current architecture constraints
- known pitfalls
- most recent operational notes

Move older chronological detail elsewhere.

### 3. Pixel UI arrived early

Originally, Pixel Atelier UI was supposed to come after the Operational Spine and Wiki Brain.

It now exists and has been partially converted away from fake simulation toward real backend execution.

Do not remove it if it works, but do not spend the next cycle polishing sprites, animations, room layouts, or visual polish.

Priority should shift back to:

1. Wiki Brain
2. Codex Worker
3. cost/quota safety
4. orchestration reliability
5. MCP only after the above

### 4. Real OpenAI mode can burn quota

The project currently supports real OpenAI-backed execution.

This is powerful but risky. The user already experienced quota burn from leaving a high-reasoning model enabled.

Recommended safety changes:

- make executor mode highly visible in UI
- show model name in UI and `/health`
- prefer explicit opt-in for real model execution
- keep mock mode easy to enable
- add per-run warnings when using OpenAI mode
- add model profile options:

```txt
cheap     → small/mini model for routine work
standard  → default coding/agent tasks
deep      → architecture/review only
```

Do not default expensive/deep models for routine orchestration.

### 5. Skill orchestration templates are hardcoded

The orchestration templates currently live in code.

That is acceptable for the MVP, but conceptually Atellier should treat skills/workflows as configurable durable operating knowledge.

Recommended future direction:

```txt
apps/api/src/orchestration/templates/*.ts       → short-term clean code organization
atelier/wiki/workflows/*.md                     → human-readable workflow memory
.agents/skills/*/SKILL.md                       → Codex workflow contract
```

Do not over-engineer this now, but avoid expanding a single huge service file indefinitely.

### 6. Wiki Brain MVP is implemented, but v2 is pending

The LLM Wiki principle is now operational through deterministic routes:

```txt
POST /wiki/ingest
POST /wiki/query
POST /wiki/lint
```

The next gap is write-path depth and reusable memory capture.

Recommended next Wiki Brain capabilities:

```txt
GET  /wiki/index
GET  /wiki/page
PATCH or POST /wiki/page with path safety
```

Important behavior:

- preserve raw source
- summarize source
- update index
- update log
- create/update related pages
- detect contradictions and stale links
- propose tasks only when source implies work
- save reusable answers/deliverables back into wiki

### 7. Codex Worker control-plane v1 is implemented

Atellier now has a controlled in-app Codex Worker control-plane with:

- create/plan/approve-step/execute-next/cancel/finalize routes
- transition guardrails and blocked-state errors
- dashboard control panel with actionable blocked reasons
- durable finalize run logs + wiki log event append
- focused API and web tests

The pending gap is execution evidence depth and real command adapter integration.

The intended architecture remains:

```txt
Atellier UI/Orchestrator → Codex Worker → code changes/logs → QA/review → wiki memory
```

Recommended future API:

```txt
POST /codex/runs
GET  /codex/runs/:id
```

Required constraints:

- never use dangerous Codex flags by default
- no `--dangerously-bypass-approvals-and-sandbox`
- no background destructive actions
- store logs as runs
- require human review before applying risky changes
- model profile should be explicit
- do not call Codex in automated tests

### 8. MCP should still wait

MCP is not the next step unless the Codex Worker and Wiki Brain are stable.

Correct order:

```txt
1. Wiki Brain
2. Cost/model safety
3. Codex Worker
4. MCP layer
5. external integrations
```

Future MCP candidates:

- filesystem MCP with allowlist
- docs/context MCP
- Codex MCP
- GitHub MCP
- Figma MCP
- browser/search MCP

Use allowlists and avoid broad destructive permissions.

## Recommended immediate next tasks for Codex

### Task 1 — Keep documentation current

Initial cleanup was started on 2026-05-05. Continue keeping these aligned:

- `README.md`
- `CODEX_MEMORY.md`
- optionally add docs under `docs/architecture/` and `docs/history/`

Goal:

- make the repo documentation match the actual implementation
- make the next roadmap obvious
- reduce context drift

### Task 2 — Mark executor/model safety visibility as done and maintain it

Completed behavior now includes:

- `/health` fields for executor mode and model
- UI badge showing executor mode/model
- clear warning when running OpenAI-backed orchestration
- mock mode as safe/easy local option
- model profile naming if appropriate

Goal:

- keep accidental quota burn risk visible as new entry points are added

### Task 3 — Extend Wiki Brain from MVP to v2

MVP implementation is done for:

```txt
POST /wiki/ingest
POST /wiki/query
POST /wiki/lint
```

Next extension should target safe wiki write/update routes and reusable memory writeback.

Goal:

- make wiki memory compound through safe updates, not only ingest/query

### Task 4 — Refactor orchestration templates if they grow

If adding more orchestration workflows, move templates into separate files.

Do not expand `SkillOrchestrationService` into a giant God service.

### Task 5 — Strengthen Codex Worker evidence pass before real executor integration

Codex Worker design doc and v1 control-plane are already in place:

```txt
docs/codex-worker.md
```

Next iteration should focus on:

- richer per-step output evidence in run artifacts
- clearer finalize payload review in UI
- strong approval/audit metadata across step transitions
- tests for evidence rendering and finalize evidence behavior

## Recommended prompt for the next iteration

The actionable kickoff prompt now lives in [`docs/next-iteration-plan-2026-05-06.md`](next-iteration-plan-2026-05-06.md) under *First concrete tasks*. Start there.

Short version:

```txt
Read AGENTS.md, CODEX_MEMORY.md, docs/current-state-and-next-steps.md (§ 2026-05-06 strategic reframe), and docs/next-iteration-plan-2026-05-06.md.

Pick ONE of the following to start. Do not multitask:

A) MCP server wrapper (P1)
   - Stub a new package that exposes wiki/query as an MCP tool end-to-end.
   - Document install in docs/mcp-server.md.

B) Wiki Dream loop (P2)
   - Draft the wiki-curator dream prompt (inputs, expected dream-report output).
   - Wire a manual trigger button before adding cron.

C) Anthropic executor mode (P3)
   - Add ANTHROPIC_API_KEY / ANTHROPIC_MODEL env handling alongside OpenAI.
   - Add an AnthropicExecutor that mirrors the OpenAI executor surface.
   - Surface mode + model in /health and the header badge.

Do not:
- add MCP for everything (only the REST API wrapper)
- polish the Pixel Office
- call real OpenAI/Anthropic/Codex in tests
- use dangerous Codex flags
- add auth, multi-user, cloud deploy

Run:
- pnpm typecheck
- pnpm test:api if API changed
- pnpm test:web if web changed
```

## Product north star

Do not let Atellier become a prettier task board.

The north star is:

```txt
Atellier Studio turns scattered daily/client context into durable operational memory, coordinates agents through reviewable runs, and helps produce deliverables that improve the wiki over time.
```

Visuals are secondary.
Memory, execution, review, and learning loops are primary.
