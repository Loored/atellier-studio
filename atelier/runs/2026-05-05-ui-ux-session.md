# UI/UX Session — 2026-05-05

**Type:** manual  
**Status:** completed  
**Scope:** apps/web — full UI/UX review, polish pass, dashboard layout, navigation expansion, English translation

---

## What we did

### 1. UI/UX Review (`/atellier-ui-ux-reviewer`)

Full review of all feature components under `apps/web/src/features/`. Key findings:

- `needs-human` status badge had no CSS definition → rendered identical to idle (muted gray)
- `CodexWorkerPanel` lacked eyebrow label and panel shadow → visually disconnected from all other panels
- Loading and empty states were indistinguishable (both used dashed purple border)
- `RunsTimeline` review actions had no visual hierarchy (Approve and Changes looked identical)
- `TimerReset` icon used for two different semantic meanings in the same component
- Deliverable path buttons truncated with no accessible fallback
- No keyboard `focus-visible` rings on inputs, selects, or buttons
- WikiPanel 3-column sub-layout was extremely dense at any width
- Wiki log metric card showed "On/Off" breaking the numeric pattern of all other metrics

---

### 2. UI Polish Pass (`/atellier-ui-polisher`)

**`styles.css`**
- Added `status-badge-needs-human` with gold color matching the existing avatar dot system
- Added `agent-item--needs-human` and `agent-item--blocked` classes (border + background tint)
- Added `needsHumanPulse` keyframe animation (soft gold glow, 2.5s)
- Added `focus-visible` rings for inputs, selects, textareas, and buttons
- Added new animations to `prefers-reduced-motion` block

**`AgentsPanel.tsx`** — loading state now shows `Loader2` spinner; empty state keeps dashed border; list items get status-based border/background for `needs-human` and `blocked`

**`CodexWorkerPanel.tsx`** — added `Developer` eyebrow label, matching panel shadow, fixed `icon-only-button` misuse on text-label buttons, Cancel button gets orange tint

**`RunsTimeline.tsx`** — Approve → green, Changes → orange, reset icon changed from `TimerReset` to `RotateCcw` (eliminates dual-use icon), loading state uses spinner

**`DeliverablesPanel.tsx`** — `title` attribute on path buttons, loading state uses spinner

**`TasksPanel.tsx` / `SkillOrchestrationPanel.tsx` / `WikiPanel.tsx`** — loading states use spinner

**`WikiPanel.tsx`** — `aria-live` added to query results and ingest result areas, action buttons normalized to system base styles

**`Dashboard.tsx`** — wiki metric value changed from "On/Off" to "Ready/–"

---

### 3. Dashboard layout improvements

**Metric row**
- Height: `72px → 50px` (−30%)
- Padding: `px-4 py-3.5 → px-3 py-2`
- Value font: `1.4rem → 1.1rem`
- Icon: `18px → 15px`
- Grid: `grid-cols-7 → repeat(6, 1fr) + 1.5fr` (Wiki Log gets extra width for "Ready" text)

**Main grid**
- Column layout: `3-5-4 → 3-6-3` (execution center gains a column)
- Removed all `min-h-[calc(100vh-240px)]` constraints
- Gap: `3.5 → 4`
- `CodexWorkerPanel` moved from `col-span-9 col-start-4` to `col-span-12` (full-width at bottom)

**WikiPanel sub-grid**
- Before: 3 equal columns (Ingest / Query / Lint) — extremely dense
- After: Ingest full-width + Query and Lint side-by-side in `grid-cols-2`

---

### 4. Navigation expansion + English translation

**Sidebar** — rebuilt from 2 views to 7:
- Dashboard, Agents, Runs, Review, Wiki, Office, Settings
- Settings pinned at bottom separated from main nav
- Stats strip shows Agents / Running / Waiting counts inline
- Roster avatars now differentiate `needs-human` (gold dot) from `blocked` (orange)
- All labels in English

**AppShell**
- Header: "Sesión activa" → "Active session", "agentes" → "agents"
- View type expanded to 7 values, all new views wired

**OfficeView**
- "Cargando oficina" → "Loading office"
- "Sin agentes — añade uno para poblar la oficina" → "No agents — add one to populate the office"
- "ORQUESTACIÓN/PAUSADO" → "LIVE/PAUSED"
- "Nombre agente" → "Agent name", "Agente" button → "Agent"
- "GRAFO" → "Graph", "activos" → "active"
- Top header with filter chips (All / Running / Waiting / Inactive) added by linter

---

### 5. New view components created

| File | Description |
|---|---|
| `features/agents/AgentsView.tsx` | Full-page agents roster |
| `features/runs/RunsView.tsx` | Full-page runs execution view |
| `features/wiki/WikiView.tsx` | Full-page wiki memory view |
| `features/review/ReviewView.tsx` | Dedicated review queue: search, tab filters (All / Pending / Approved / Needs changes / Unlinked), full inline review actions |
| `features/settings/SettingsView.tsx` | System settings: Executor config, Storage/MongoDB status, System metrics (RSS/Heap), API health, About |

---

### 6. Dashboard — Attention Required section

- Added to `useDashboard.ts`: `attentionAgents` (blocked + needs-human agents)
- Rendered as an orange-tinted strip between the metrics row and the main grid
- Each agent shown as a clickable pill → navigates to Agents view
- Gold for `needs-human`, orange for `blocked`
- Disappears automatically when no agents need attention

---

## Tests

```
pnpm --filter @atellier/web typecheck  →  0 errors
pnpm test:web                          →  10/10 passed (all runs)
```

## Files changed

**Modified:** `styles.css`, `AppShell.tsx`, `Sidebar.tsx`, `Dashboard.tsx`, `OfficeView.tsx`, `AgentsPanel.tsx`, `CodexWorkerPanel.tsx`, `RunsTimeline.tsx`, `DeliverablesPanel.tsx`, `TasksPanel.tsx`, `SkillOrchestrationPanel.tsx`, `WikiPanel.tsx`, `useDashboard.ts`

**Created:** `AgentsView.tsx`, `RunsView.tsx`, `WikiView.tsx`, `ReviewView.tsx`, `SettingsView.tsx`
