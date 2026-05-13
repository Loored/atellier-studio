# Knowledge Graph

**Date:** 2026-05-12 (direction); 2026-05-13 (v2 milestone).
**Status:** v2 shipped — live force-directed map, inspector with markdown render, sesión viva polling, ⌘K search, URL-synced filters, time-travel slider with snapshot ticks, run timeline, mobile tab, Office↔Graph navigation, in-memory snapshot ring buffer.

## Why

Atellier should show not only who is working, but what the system is learning.

The Pixel Office visualizes active agents. The Knowledge Graph should visualize operational memory: how sources, wiki pages, tasks, runs, agents, reviews, deliverables, decisions, contradictions, and dream reports relate to each other over time.

The goal is not a literal neural network or a decorative graph. The goal is a local, inspectable knowledge network that agents help maintain through their work and that the operator can audit.

## Product stance

This is aligned with the current architecture. It does not require Slack, Calendar, Drive, vector search, embeddings, or a graph database for v1.

Start with a read model derived from existing local state:

- `atelier/wiki`
- `atelier/raw`
- `atelier/tasks`
- `atelier/runs`
- MongoDB agents, tasks, runs, logs, deliverables, and review states
- Wiki lint/query/dream outputs

## Initial node types

- Agent
- Role
- Task
- Run
- Run log
- Source
- Wiki page
- Decision
- Contradiction
- Deliverable
- Review
- Dream report
- Skill/workflow

## Initial edge types

- `agent_has_role`
- `agent_ran_task`
- `run_used_source`
- `run_updated_page`
- `run_created_deliverable`
- `deliverable_reviewed_as`
- `page_links_to_page`
- `page_mentions_task`
- `source_supports_page`
- `page_contradicts_page`
- `dream_proposed_action`
- `dream_action_accepted`
- `dream_action_rejected`
- `dream_action_deferred`
- `role_learned_pattern`

## Knowledge quality

Each node and edge should carry enough metadata to support curation:

- source path or database ID
- created/updated timestamp
- producing agent or role when known
- review status when known
- verification state: proposed, verified, contradicted, stale, orphaned
- confidence/source count where derivable without LLM calls

## What shipped (v2 — 2026-05-13)

### Backend (`apps/api`)

- `KnowledgeGraphService` (`apps/api/src/services/knowledge-graph.service.ts`) builds a deterministic read model from:
  - MongoDB-backed agents/tasks/runs (in-memory mode auto-seeds 6 agents / 10 tasks / 5 runs).
  - `atelier/wiki/**/*.md` (curated wiki pages).
  - `atelier/raw/**/*.{md,pdf,txt,json,csv,jsonl,yaml,yml}` (raw assets).
  - `atelier/runs/**/*.md` and `atelier/tasks/**/*.md` (runtime logs).
  - Wiki lint output for issue nodes.
- File mtime stamps `updatedAt` on wiki/raw/runtime nodes so the frontend can time-travel.
- Wiki edges come from three sources: markdown links `[text](path.ext)`, plain-text path mentions matching `(wiki|raw|runs|tasks)/...md`, and the legacy `- Raw path:` metadata field.
- Snapshot ring buffer: up to 48 in-memory snapshots, throttled to one per hour. Exposed via `GET /knowledge/graph/snapshots` and `GET /knowledge/graph/snapshots/:id`.
- Routes: `GET /knowledge/graph`, `GET /knowledge/graph/snapshots`, `GET /knowledge/graph/snapshots/:id`.

### Shared types (`packages/shared`)

- Node types: `agent`, `role`, `task`, `run`, `wiki-page`, `deliverable`, `lint-issue`, `raw-source`, `runtime-log`.
- Edge types: `agent_has_role`, `agent_assigned_task`, `run_by_agent`, `run_for_task`, `run_created_deliverable`, `deliverable_is_wiki_page`, `wiki_page_has_lint_issue`, `wiki_page_links_to`, `wiki_page_mentions_raw_source`, `wiki_page_mentions_runtime_log`.
- Layers: `wiki`, `raw`, `runtime`, `meta`. Quality: `verified | proposed | contradicted | stale | orphaned | generated`.
- `KnowledgeGraphSnapshotMeta` and `KnowledgeGraphSnapshotListResponse`.

### Frontend (`apps/web`)

- `features/knowledge/KnowledgeGraphView.tsx` — main view. Header has live session indicator (15s polling), `LiveTimestamp`, refresh button, ⌘K SearchBar, "Volver a Oficina" navigation.
- `components/ForceGraphCanvas.tsx` — `react-force-graph-2d` canvas with per-layer clustering (custom `clusterForce`), curved edges, halos, directional particles on selected node, density presets (`auto|comfort|sparse`), focus-on-select (`centerAt` + `zoom`), label background pills, persisted viewport across refetches.
- `components/KnowledgeInspector.tsx` — Lectura/Curación tabs, markdown render via `marked`, source content for wiki/raw/runtime/deliverable, **run timeline** for `run` nodes (logs by timestamp).
- `components/SearchBar.tsx` — ⌘K shortcut, fuzzy match on label + path, keyboard nav (arrow keys + Enter to commit), Esc to clear.
- `components/NodeTooltip.tsx` — hover tooltip with type/layer/quality/path.
- `components/LayerBreakdown.tsx` — horizontal bar histogram for the four layers.
- `components/TimelineSlider.tsx` — mtime range + snapshot ticks + Live badge.
- `components/LiveTimestamp.tsx` — relative-time that ticks every 5s.
- `hooks/useKnowledgeGraphPanel.ts` — single source of truth for view state (URL-synced filters, density, selection, search, timeline cursor).
- `hooks/useUrlState.ts` — generic URL ↔ state hooks (`useUrlState`, `useUrlSetState`, `useUrlNullable`).

### Navigation

- `Sidebar` roster avatars are buttons that dispatch `knowledge:select` and switch to Graph view.
- `AgentSidePanel` (Office) has a "Ver en grafo" shortcut.
- `OfficeView` header has "Knowledge Graph →" shortcut.
- `AppShell` exposes `NavigationBridge` that listens for `knowledge:navigate` events from anywhere in the tree (URL-first then deferred event).
- `MobileView` has a "🕸️ Grafo" tab.

### Tests

- 72 API tests including `operational-spine.test.ts` graph case.
- 18 web tests: `App.test.tsx` (canvas mocked), `SearchBar.test.tsx`, `LayerBreakdown.test.tsx`.
- `ResizeObserver` polyfill and `ForceGraphCanvas` mock in `setupTests.ts` so jsdom tolerates the canvas-only feature.

## Architectural choices

- **No external graph DB / embeddings / vector store.** The graph is rebuilt from disk + DB on each request.
- **In-memory snapshots only.** On API restart the snapshot history resets — fine for v2; persisted snapshots are a candidate next iteration.
- **URL is the source of truth for view state.** Filters, density, selected node, and search query are shareable.
- **Custom CustomEvents (`knowledge:select`, `knowledge:navigate`)** for cross-feature navigation. Lightweight, avoids router/store dependency.
- **Marked for markdown** in the inspector with a small `.prose-inspector` CSS scope; no DOMPurify since content is local-first.

## Non-goals for v1

- No external integrations.
- No vector database.
- No graph database.
- No autonomous silent merges.
- No broad agent autonomy without approval.
- No decorative-only graph with no operational meaning.

## Next candidates (post v2)

Ordered by impact vs effort:

1. **WebSocket live updates** — replace 15s polling with push when wiki/runs/tasks change. Closes the sesión-viva loop.
2. **Graph annotations** — operator notes/tags persisted to disk; surfaced both in inspector and as graph attributes feeding lint.
3. **Filter presets** — saved sets like "needs curation", "this week", "wiki orphans"; URL-shareable.
4. **Diff snapshot view** — pick two snapshots, render +/- nodes/edges with deltas.
5. **Office sub-tabs** — promote Office to host the graph as one of its panes (mock alignment: CT/KG/ST tabs).
6. **Persisted snapshots** — write the snapshot ring buffer to `atelier/_runtime/graph-snapshots/` so history survives API restarts.
7. **Performance >300 nodes** — sprite caching, WebGL toggle, virtualised neighbour calc.
8. **Dream proposal → graph curation** — when an operator accepts/rejects a dream proposal, persist that decision as a graph node/edge.
