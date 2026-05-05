# Run: Office & UI Redesign Session

- Date: 2026-05-05
- Operator: Eduardo
- Scope: `apps/web` — full UI redesign pass from reference images + Office view pixel engine improvements
- Trigger: Manual redesign session using 3 reference screenshots (Dashboard, Review, Office).

---

## Context

Three reference images were provided as visual direction:
1. **Dashboard** — grouped KPI sections, orchestration as the hero panel, right-panel outputs.
2. **Review queue** — status tabs, filter bar, inline actions, right-panel wiki tools.
3. **Office / Agent map** — fixed right panel for selected agent, status legend overlay, connection lines.

Goal: transform the existing interface to match the reference aesthetic (dark premium, better hierarchy, less density) while keeping all existing functionality and APIs intact.

---

## Actions

### 1. CSS cascade fix — `styles.css`

- Moved the global `button {}` and `input, select {}` rules into `@layer base {}`.
- **Root cause**: rules outside any CSS layer have higher cascade priority than Tailwind utilities, causing `border-transparent`, `bg-transparent`, `bg-gold/10`, etc. to be silently overridden — sidebar nav buttons and metric cards received the purple glow unconditionally.
- After fix: Tailwind utility classes (`@layer utilities`) correctly override the base element styles.

### 2. Design tokens — `styles.css`

- `--sidebar-w`: `64px → 220px`
- `--header-h`: `48px → 52px`
- Added `.btn-primary` (solid purple fill, white text, glow shadow).
- Added `.btn-ghost` (transparent, border-card).
- Added `.review-tab` / `.review-tab--active` / `.review-tab-count` system.
- Added review-specific status badge variants: `status-badge-review-pending`, `status-badge-review-approved`, `status-badge-review-changes-requested`, `status-badge-review-unlinked`.

### 3. Sidebar expansion — `Sidebar.tsx`

- Rebuilt from 64px icon-only column to 220px panel with icon + label rows.
- Nav items: `flex-row items-center gap-3 h-10` instead of `flex-col min-h-[50px]`.
- Stats strip: inline key/value pairs (Agents / Running / Waiting) instead of centered stat stack.
- Roster: horizontal wrapped avatar grid instead of vertical column.
- Settings button uses same row style, pinned at bottom.

### 4. AppShell header — `AppShell.tsx`

- Added `useHealthApi()` call to pull `executorMode`, `executorModel`, `modelProfile`.
- Header now shows: logo | session dot | executor badge (`MOCK (standard) gpt-4.1-mini`) | agent count pill.
- Removed executor info from `Dashboard.tsx` topbar (now lives globally in header).

### 5. Dashboard redesign — `Dashboard.tsx`

- Removed the old `Atellier Studio` topbar section.
- **KPI row**: flat unified row with a single outer border; vertical dividers between groups. Groups: Operation (Agents, Recent runs) / Attention Required (Needs human, Blocked, In review) / System (Active tasks, Wiki log).
- `MetricCard` is always a `div` (never a `button` element) — uses `role="button"` when clickable. Eliminates global button CSS interference on metric cards.
- Attention cards with `emphasis="warning"` or `"danger"` get gold/orange border + background tint; zero-value cards stay neutral.
- Attention banner: horizontal agent pill strip with gold/orange tint, auto-hidden when empty.
- Main grid kept as `3-6-3` (Agents+Tasks | Orchestration | Deliverables).

### 6. Review view redesign — `ReviewView.tsx`

- Added local `activeTab` state with 5 tabs: All / Pending / Approved / Needs changes / Unlinked.
- Tab counts are computed live from `runList`.
- Added search input (filters by `run.type` and `run.id`).
- Both search and tab filter compose with the existing `agentFilter`/`reviewFilter` selects.
- Review rows: `Approve` (green), `Request changes` (orange), `Unlink` and reset as ghost/icon buttons — all inline without a wrapper box.
- Right sidebar (300px): `WikiPanel` under "Tools" eyebrow, fixed `overflow-y-auto`.
- `Start run` uses `.btn-primary` (solid purple).

### 7. Office view layout — `OfficeView.tsx`

- Added page header ("Office" + subtitle + status badges).
- Added status filter chips (All / Running / Waiting / Inactive with counts).
- Legend toggle button shows/hides the overlay.
- Live/Paused toggle moved to header chip bar.
- Replaced max-2 floating `AgentDetailPanel` overlays with a single fixed `AgentSidePanel` (340px right column, only rendered when an agent is selected). Canvas shrinks to accommodate it.
- Bottom bar simplified: Paused chip + add-agent form + agent count + fullscreen button.

### 8. Agent side panel — `AgentSidePanel.tsx` (new file)

- Fixed 340px right column; replaces the old absolute-positioned floating panels.
- Header: role-colored avatar (initial) + name + copy-ID button + role description.
- Status badge (color-coded) + agent index + Resume button (when waiting/blocked).
- **Current Task section**: task ID if set, or live activity text; progress bar color-coded by status (teal = active, gold = waiting, orange = blocked).
- **Tabs**: HANDOFFS | ACTIVITY.
  - Handoffs: `messageList` rendered as From → To rows.
  - Activity: live status text + streaming output block + message history feed.
- **Agent Terminal** (collapsible): terminal log + input row.
- **Instructions** section: textarea + "Save instructions" button (teal tint).
- **Message composer**: full-width textarea + handoff target select + solid Send button; `Cmd+Enter` shortcut.

### 9. Pixel office canvas — wander bug fix — `PixelOfficeCanvas.tsx`

- **Bug**: idle characters perpetually walked in place after being resumed.
- **Root cause**: the wander offset `sin(tick * 0.008) * ±8px` kept `targetX` oscillating, so `dist > MOVE_SPEED (1.2px)` was always true → `isMoving = true` forever → renderer played walking frames indefinitely.
- **Fix**: removed the wander oscillation entirely. Idle characters now walk to their desk and stop (`isMoving = false` → frame 0 = standing pose).

### 10. Agent nameplates — `renderer.ts`

- Replaced bare white text labels with dark nameplates: `rgba(4,6,16,0.92)` rounded-rect background + `status-colored` border (with teal `shadowBlur` glow when working).
- Each nameplate shows: agent name (bold white) + status dot + status text (color-coded: teal/gold/orange/green/gray).
- `STATUS_DOT_COLOR` and `STATUS_LABEL` maps added for all statuses.

### 11. Action bubbles — `renderer.ts` — `drawActionBubble()`

- New function replaces `drawStepBubble`.
- Appears above sprite for all non-idle agents; hidden for `idle`/`done`.
- Dark background (`rgba(3,4,14,0.95)`) + status-colored border + caret triangle pointing down to sprite.
- Content lines (dynamic):
  - Status icon + label: `◎ Thinking…` / `▶ Executing` / `✎ Writing` / `✔ Reviewing` / `⏸ Waiting for input` / `✖ Blocked`.
  - Step label (truncated at 22 chars) when `currentStep.label` set.
  - Handoff target `→ AgentName` in purple when `currentStep.nextAgentName` set.
  - Destination hint: `⇒ Execution zone` or `⇐ Returning to desk` when `isMoving`.
- Animated loading dots (3 pulsing circles offset by `sin(tick)`) shown for `thinking`/`planning`/`reading` states.

### 12. Destination markers — `renderer.ts` — `drawDestinationMarkers()`

- New function; runs before characters are drawn.
- For every `isMoving` agent: draws a dashed marching line from `currentX/Y` to `targetX/Y` + pulsing ring + inner dot at the destination.
- Color: teal (active), gold (needs-human), orange (blocked).
- `lineDashOffset` animated for a marching-ants effect.
- Removed `state === 'idle'` guard so agents returning to desk also show a destination.

### 13. Connection lines — `renderer.ts` — `drawConnectionLines()`

- **Bug**: only one line appeared even when multiple agents were active.
- **Root cause**: lines were only drawn for agents with `currentStep.nextAgentName` set — typically only one agent at a time.
- **Fix — two-pass approach**:
  - **Pass 1 (collaboration mesh)**: soft dashed purple lines between every pair of working agents without an explicit handoff. `opacity 0.28–0.40`, `1.5px`, unique `lineDashOffset` per pair (prevents synchronised animation).
  - **Pass 2 (explicit handoff arrows)**: bright animated line for agents with `nextAgentName`. Active: double-render wide glow (`5px, shadowBlur 16`) + sharp core (`2.5px, shadowBlur 6`) + `12px` arrowhead. Queued: `rgba(167,139,250,0.75)`, `2px`, dashed march + `10px` arrowhead.
- Extracted `drawArrowHead()` helper to avoid duplication.

### 14. Status legend overlay — `OfficeView.tsx`

- Semi-transparent dark panel (`rgba(8,10,20,0.88)` + `backdrop-blur`) positioned `absolute top-3 left-3` over the canvas.
- States section: dot + label for Running / Waiting / In review / Inactive / Blocked.
- Connections section: teal line (Active handoff) + dashed line (Recent handoff).
- Toggled by the "Legend" button in the header chip bar.

---

## Validation

```
pnpm --filter @atellier/web exec tsc --noEmit  →  0 errors
pnpm --filter @atellier/web build              →  clean build, 3.30s
```

---

## Files modified

| File | Type |
|---|---|
| `apps/web/src/styles.css` | CSS layer fix, new tokens, button/tab/badge variants |
| `apps/web/src/app/AppShell.tsx` | Header executor info, sidebar width |
| `apps/web/src/app/Sidebar.tsx` | Full rebuild — 220px icon+label rows |
| `apps/web/src/features/dashboard/Dashboard.tsx` | Flat KPI row, MetricCard as div, attention banner |
| `apps/web/src/features/review/ReviewView.tsx` | Tabs, search, inline actions, right wiki panel |
| `apps/web/src/features/pixel-office/OfficeView.tsx` | Header, filters, two-column layout, legend |
| `apps/web/src/features/pixel-office/PixelOfficeCanvas.tsx` | Wander bug fix |
| `apps/web/src/features/pixel-office/engine/renderer.ts` | Nameplates, action bubbles, destination markers, connection lines |

## Files created

| File | Description |
|---|---|
| `apps/web/src/features/pixel-office/AgentSidePanel.tsx` | Fixed right panel replacing floating overlays |

---

## Test commands

```bash
# Full build loop — 7 steps, 5 agents, max office movement
curl -s -X POST "http://localhost:4000/orchestrations/skills/atellier-build-loop/run" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Add real-time handoff toast notifications to the Office view",
    "context": "Stack: React 19 + Tailwind v4. Office view at apps/web/src/features/pixel-office/OfficeView.tsx. Handoff data from PixelCharacter.currentStep.nextAgentName. No toast lib — build lightweight local component."
  }'

# Wiki ingest loop — 5 steps, Wiki Curator + PM + Intake
curl -s -X POST "http://localhost:4000/orchestrations/skills/llm-wiki-ingest-loop/run" \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Ingest the Office view redesign decisions into the wiki",
    "context": "Redesigned: AgentSidePanel (fixed 340px right column), status legend overlay, connection lines (teal glow active handoff + dashed purple mesh), action bubbles above sprites (status + step + handoff target + animated loading dots), destination markers (dashed line + pulsing ring). Files: OfficeView.tsx, AgentSidePanel.tsx, renderer.ts, PixelOfficeCanvas.tsx."
  }'
```
