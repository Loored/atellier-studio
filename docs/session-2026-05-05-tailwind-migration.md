# Session: Tailwind CSS v4 Migration — 2026-05-05

## Context

Atellier Studio is a local-first AI agent orchestrator. Monorepo with:
- `apps/api` — Fastify 5 + Mongoose backend
- `apps/web` — React 19 + Vite + TanStack Query frontend
- `packages/shared` — shared TypeScript types

This session migrated the web app from a hand-crafted `styles.css` to **Tailwind CSS v4** with a fantasy-cyberpunk design theme.

---

## What was done

### 1. Installed dependencies (`apps/web`)

```
tailwindcss@^4.2.4       (devDep)
@tailwindcss/vite@^4.2.4 (devDep)
clsx@^2.1.1              (dep)
tailwind-merge@^3.5.0    (dep)
```

### 2. Updated `apps/web/vite.config.ts`

Added `@tailwindcss/vite` as first plugin:

```ts
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tailwindcss(), react()],
  // ...
});
```

### 3. Created `apps/web/src/lib/cn.ts`

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

### 4. Rewrote `apps/web/src/styles.css`

**Key structural changes:**

- Added `@import "tailwindcss"` at the top (replaces old three-directive approach)
- Added `@theme` block with Tailwind v4 design tokens (generates utility classes)
- Kept `:root` vars as aliases for component classes still using `var(--*)` syntax
- Enhanced palette for fantasy-cyberpunk aesthetic

**`@theme` tokens defined (generate Tailwind utilities like `bg-canvas`, `text-purple`, `border-teal`):**

```css
@theme {
  --color-canvas:       #080a14;   /* main bg */
  --color-surface:      #0d1022;
  --color-surface-card: rgba(99, 66, 245, 0.04);
  --color-sidebar:      #050710;

  --color-purple:       #8b5cf6;   /* primary accent */
  --color-purple-dim:   rgba(139, 92, 246, 0.18);
  --color-teal:         #10f2aa;   /* active/live accent */
  --color-teal-dim:     rgba(16, 242, 170, 0.12);
  --color-orange:       #f97316;   /* blocked/warning */
  --color-gold:         #fbbf24;   /* waiting */
  --color-green:        #4ade80;   /* success/done */

  --color-ink:          #eef0f8;   /* primary text */
  --color-ink-muted:    #8890ae;
  --color-ink-faint:    #4a506a;
  --color-ink-accent:   #b8a4fb;

  --font-sans: Inter, ui-sans-serif, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", "Fira Code", ui-monospace, monospace;

  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 10px;
  --radius-xl: 14px; --radius-full: 9999px;
}
```

**`:root` aliases (used by un-migrated components like OfficeView, MobileView):**

```css
:root {
  --bg-base:            var(--color-canvas);
  --bg-card:            var(--color-surface-card);   /* rgba purple-tinted */
  --bg-sidebar:         var(--color-sidebar);
  --border-card:        rgba(139, 92, 246, 0.14);    /* purple-tinted */
  --border-accent:      rgba(139, 92, 246, 0.5);
  --accent-purple:      var(--color-purple);
  --accent-teal:        var(--color-teal);
  /* ... etc */
}
```

**Notable palette changes from previous version:**
- Background: `#0b0c16` → `#080a14` (deeper, more purple-tinted)
- Cards: neutral white-opacity → `rgba(99,66,245,0.04)` (purple-tinted)
- Borders: white-opacity → purple-tinted `rgba(139,92,246,0.14)`
- Purple: `#7c5cfc` → `#8b5cf6` (brighter, standard violet)
- Teal: `#1de5b5` → `#10f2aa` (more electric)
- Added glow effects on active elements, running steps, progress bars

---

### 5. Migrated components to Tailwind utilities

**Fully migrated (9 components):**

| File | Key patterns used |
|------|------------------|
| `apps/web/src/app/AppShell.tsx` | Grid shell, header, logo |
| `apps/web/src/app/Sidebar.tsx` | `cn()` for active nav state, roster dots |
| `apps/web/src/features/dashboard/Dashboard.tsx` | Metrics grid, panel grid |
| `apps/web/src/features/agents/components/AgentsPanel.tsx` | Panel + item-card pattern |
| `apps/web/src/features/tasks/components/TasksPanel.tsx` | Panel + item-card pattern |
| `apps/web/src/features/wiki/components/WikiPanel.tsx` | Panel + pre/log |
| `apps/web/src/features/runs/components/RunsTimeline.tsx` | Panel + run states |
| `apps/web/src/features/runs/components/DeliverablesPanel.tsx` | Panel + deliverable preview |
| `apps/web/src/features/orchestrations/components/SkillOrchestrationPanel.tsx` | Step states with `cn()` |

**Not migrated (deferred):**
- `apps/web/src/features/pixel-office/OfficeView.tsx` — complex floating agent panels
- `apps/web/src/features/pixel-office/AgentDetailPanel.tsx`
- `apps/web/src/app/MobileView.tsx` — mobile layout

---

### 6. Recurring Tailwind patterns used in migrated components

**Panel wrapper (`col-span-6` or `col-span-12` for wide):**
```
col-span-6 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)]
p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]
```

**Panel header:**
```
flex items-center justify-between gap-4 mb-3.5
```

**Eyebrow label:**
```
text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1
```

**Panel chip/badge:**
```
inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full
px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap
```

**Item card (list row):**
```
grid grid-cols-[auto_1fr_auto] items-center gap-2.5 min-h-14
border border-[var(--border-card)] rounded-lg px-3 py-2.5 bg-white/[0.02]
transition-[border-color,background]
hover:bg-[var(--bg-card-hover)] hover:border-purple/[0.22]
```

**Empty state:**
```
m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5
text-ink-faint text-[0.85rem] bg-purple/[0.02]
```

**Dashboard grid:**
```
grid items-start grid-cols-12 gap-3.5
```

---

### 7. CSS classes kept (not replaced by utilities)

These stay in `styles.css` for valid reasons:

| Class | Reason |
|-------|--------|
| `.status-badge`, `.status-badge-*` | Dynamic interpolation at runtime: `status-badge-${agent.status}` |
| `.icon-only-button` | Shared button variant, used across multiple components |
| `.spin` | Animation helper: `animation: spin 900ms linear infinite` |
| `.status-dot--live` | Animated glow in header (pulse + box-shadow) |
| `.agent-float-*` | OfficeView floating panels — not yet migrated |
| `.mobile-*` | MobileView — not yet migrated |
| `.office-*`, `.obb-*` | Office layout — not yet migrated |

---

## Commits made this session

```
26c2a94  feat(web): install Tailwind CSS v4 with fantasy-cyberpunk theme
ac94b3b  refactor(web): migrate shell and dashboard to Tailwind utilities
ee16d7d  refactor(web): migrate dashboard panels to Tailwind utilities
485722e  refactor(web): migrate SkillOrchestrationPanel to Tailwind utilities
```

All on branch `feat/tailwind-migration`, merged into `dev/1.0.0` via PR #13.

**Open PR:** `dev/1.0.0 → main` — https://github.com/Loored/atellier-studio/pull/14

---

## Build output

```
dist/assets/index.css   53.78 kB │ gzip: 10.24 kB
dist/assets/index.js   397.27 kB │ gzip: 120.90 kB
Built in 1.79s
```

TypeScript: clean (0 errors). Tests: unchanged.

---

## What Codex should know for next tasks

1. **No `tailwind.config.js`** — Tailwind v4 is configured entirely in `styles.css` via `@theme`.
2. **Token naming** — theme tokens use `--color-*` prefix. Utilities are `bg-purple`, `text-teal`, `border-purple/50` (opacity modifier), etc.
3. **Hybrid model** — components use Tailwind utilities in JSX; `styles.css` still has CSS classes for un-migrated components and runtime-dynamic variants.
4. **`cn()` is at `src/lib/cn.ts`** — use it for any conditional class logic.
5. **`var(--border-card)` and `var(--bg-card)`** are still valid in arbitrary values because `:root` aliases exist.
6. **OfficeView / MobileView still use old CSS classes** — do not remove those classes from `styles.css` until those components are migrated.
