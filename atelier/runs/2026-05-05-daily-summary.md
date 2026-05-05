# Daily Summary — 2026-05-05

- Operator: Eduardo + Codex
- Scope: `apps/api`, `apps/web`, `packages/shared`, `docs/`, `atelier/`
- Sessions: 9 runs across the full day

---

## Narrative

The day started with a **clean slate** (Mongo reset) and ended with the most visual session yet — a full pixel-office redesign with action bubbles, connection lines, and a live agent side panel. In between, the orchestration backbone was built from scratch, integrated with real execution, hardened with UX guardrails, and documented with Karpathy-informed architecture notes.

---

## Chronological breakdown

### 1. Database reset — [`mongo-reset`](./2026-05-05-mongo-reset.md)

Clean operational state before the day's work. Dropped `atellier_studio` DB, confirmed zero agents and zero runs via `/health`. No app code changed.

---

### 2. Skill orchestration + LLM Wiki Ingest — [`skill-orchestration-and-llm-wiki-ingest`](./2026-05-05-skill-orchestration-and-llm-wiki-ingest.md)

The foundational orchestration feature landed:

- Shared orchestration types and `orchestration` run type added to `@atellier/shared`.
- `SkillOrchestrationService` and routes (`POST /orchestrations/skills/:skillId/run`) implemented in the API.
- Two skills defined: **Atellier Build Loop** (7 steps: scope → build → runtime → qa → fix → approve → memory) and **LLM Wiki Ingest Loop** (5 steps).
- Dashboard frontend wired: skill select, goal + context inputs, start button, live step list.
- Child-step deliverables suppressed so the parent orchestration run stays the reviewable artifact.
- Operator LLM Wiki source preserved under `atelier/raw/references`.

Validation: `pnpm -r typecheck` + `pnpm test:api` (17) + `pnpm test:web` (8) — all passed.

---

### 3. Real orchestration button + strict executor — [`real-orchestration-button-and-strict-executor`](./2026-05-05-real-orchestration-button-and-strict-executor.md)

Connected the orchestration to real execution:

- Added `useOrchestrationLive` hook: periodically triggers real `run agent` API calls for eligible idle/done agents when the Live button is on.
- No frontend status simulation — agent states only change via real API responses.
- API now requires `OPENAI_API_KEY` for normal execution; `AGENT_EXECUTOR_MODE=mock` forces mock mode explicitly.
- App services auto-select OpenAI executor when key is present.
- README updated to reflect real-mode-first defaults.

---

### 4. Runtime integration without simulation — [`runtime-integration-no-sim`](./2026-05-05-runtime-integration-no-sim.md)

Removed all remaining fake state mutations:

- Deleted simulation toggle controls from the office bottom bar.
- Removed `useOrchestrationSim` entirely — no more frontend timer-based status mutations.
- Backend executor preference finalized: OpenAI when key available, mock only when explicitly set.

After this run, the frontend is fully integration-first. Agent statuses in the UI always reflect real backend state.

---

### 5. Unlink confirmation + deliverable filters — [`unlink-confirm-and-deliverable-filters`](./2026-05-05-unlink-confirm-and-deliverable-filters.md)

UX hardening for the deliverable lifecycle:

- `RunsTimeline` now requires confirmation before unlinking — prevents accidental file removal from `wiki/deliverables`.
- `DeliverablesPanel` gains filter controls: Run type × Review status.
- Empty-state feedback when no deliverables match filters.
- Test coverage added for both behaviors.

---

### 6. Karpathy memory + next-work planning — [`karpathy-memory-and-next-work`](./2026-05-05-karpathy-memory-and-next-work.md)

Architecture and documentation session:

- Read and extracted the 7-page Karpathy *Agentic Systems* PDF (`atelier/raw/references`).
- **Compacted `CODEX_MEMORY.md`**: moved chronological implementation history to `docs/history/implementation-log.md`, added local setup notes to `docs/operations/local-setup.md`.
- Added `atelier/wiki/sources/2026-05-05-karpathy-agentes-llm.md`: source summary + Atellier implications.
- Added `docs/next-work-plan.md`: prioritized work plan based on Karpathy insights.

**Priority order decided**: executor/model safety visibility → Wiki Brain MVP → Codex Worker design. MCP, auth, cloud, and pixel polish pushed to later cycles.

---

### 7. Codex Worker run — [`codex-worker-69f998d1b5e23ae610276a68`](./2026-05-05-codex-worker-69f998d1b5e23ae610276a68.md)

First real execution from the Codex Worker dashboard panel. Goal: implement a safe API change. Mode: `approved_step`, profile: `standard`. Run generated an artifact and a wiki event. Validated the Codex Worker panel end-to-end.

---

### 8. UI/UX review + polish pass — [`ui-ux-session`](./2026-05-05-ui-ux-session.md)

Full audit and polish of all feature components:

- Fixed `needs-human` status badge (was rendering as idle — no CSS definition existed).
- Added `needsHumanPulse` keyframe animation (gold glow, 2.5s).
- Added `focus-visible` rings across all interactive elements.
- `CodexWorkerPanel`: added `Developer` eyebrow, panel shadow, fixed button misuse.
- `RunsTimeline`: Approve → green, Changes → orange, `TimerReset` → `RotateCcw` (deduplicated icon semantic).
- Dashboard metric row compacted (72px → 50px), grid rebalanced (3-5-4 → 3-6-3).
- Navigation expanded: 2 views → 7 (Dashboard, Agents, Runs, Review, Wiki, Office, Settings). All labels in English.
- Created: `AgentsView`, `RunsView`, `WikiView`, `ReviewView`, `SettingsView`.

---

### 9. Office + UI redesign session — [`office-ui-redesign-session`](./2026-05-05-office-ui-redesign-session.md)

The largest visual session of the day. Driven by 3 reference screenshots.

**Global fixes:**
- CSS cascade bug: `button {}` / `input, select {}` moved into `@layer base` — Tailwind utilities were silently losing to element-level rules outside any layer.
- `--sidebar-w`: 64px → 220px. Sidebar rebuilt with icon + label rows, stats strip, horizontal roster.
- AppShell header now shows executor badge (`MOCK (standard) gpt-4.1-mini`) pulled from `useHealthApi`.

**Dashboard:**
- Flat unified KPI row with group dividers (Operation / Attention Required / System) — replaced nested bordered group boxes.
- `MetricCard` always a `div` (never `button`) to avoid global button CSS interference.

**Review:**
- Status tabs (All / Pending / Approved / Needs changes / Unlinked) with live counts.
- Search input composing with existing filters.
- Inline review actions. Right-column `WikiPanel` under "Tools".

**Office — structural:**
- Fixed `AgentSidePanel` (340px) replaces floating overlays. Canvas shrinks when agent selected.
- Status legend overlay (States + Connections) toggleable from header.
- Filter chips (All / Running / Waiting / Inactive).

**Office — pixel engine:**
- **Bug fixed**: wander oscillation (`±8px sin`) kept `isMoving = true` forever → sprites walked in place. Removed wander entirely.
- **Nameplates**: dark rounded-rect background + status-colored border + glow when working + status dot + status text.
- **Action bubbles** (`drawActionBubble`): dark box above sprite showing status icon + label, step name, handoff target `→ AgentName`, destination hint (`⇒ Execution zone` / `⇐ Returning to desk`), animated loading dots for thinking/planning/reading.
- **Destination markers** (`drawDestinationMarkers`): dashed marching line + pulsing ring at `targetX/Y` for every moving agent.
- **Connection lines** (`drawConnectionLines`): two-pass — soft dashed purple mesh between all working agents + bright animated teal glow arrows (double-pass render: wide blur + sharp core) for explicit handoffs.

---

## What was built today — summary

| Capability | Before | After |
|---|---|---|
| Orchestration | Not implemented | Two skills, 7+5 steps, real backend execution |
| Agent execution | Simulated frontend states | Real API-only, strict executor policy |
| Deliverable safety | No confirmation on unlink | Confirmation guard + type/review filters |
| Architecture memory | Bloated `CODEX_MEMORY.md` | Compacted + split into dedicated docs |
| Navigation | 2 views (Dashboard, Office) | 7 views, all in English |
| Sidebar | 64px icon-only | 220px icon+label, stats, roster |
| Dashboard KPIs | 7 flat cards | Grouped row with emphasis on attention metrics |
| Review view | Basic list | Tabs + search + inline actions + wiki tools panel |
| Office layout | Floating panels over canvas | Fixed side panel, canvas resizes |
| Agent nameplates | Bare white text, invisible over rooms | Dark nameplate, status dot, color-coded glow |
| Action bubbles | Static step pill | Dynamic bubble: status + step + handoff + destination + loading dots |
| Connection lines | One line (only explicit handoffs) | Mesh (all working agents) + directed arrows |
| Sprite walk bug | Walk-in-place after resume | Agents walk to target and stop correctly |

---

## Validation (end of day)

```
pnpm --filter @atellier/web exec tsc --noEmit  →  0 errors
pnpm --filter @atellier/web build              →  clean, 3.30s
pnpm test:api                                  →  17 tests passed
pnpm test:web                                  →  10 tests passed
```
