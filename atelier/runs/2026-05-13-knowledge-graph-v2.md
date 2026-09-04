# 2026-05-13 — Knowledge Graph v2

## Summary

The Knowledge Graph evolved from a static 22-node hub-and-spoke SVG into a 94-node interactive live map clustered by layer. Four PRs landed on `dev/1.0.0`:

- **#29** — Force-directed canvas (react-force-graph-2d), markdown inspector, ⌘K search, URL-synced filters, sesión viva polling, layer breakdown, hover tooltip. Backend ingestion of wiki/raw assets/runtime logs with markdown-link and plain-text mention parsing.
- **#30** — In-memory seed (6 agents/10 tasks/5 runs), file-mtime time-travel, "Volver a Oficina" button, SearchBar + LayerBreakdown unit tests, App.test fixed with canvas mock + ResizeObserver polyfill.
- **#31** — Roster avatars become clickable buttons; AgentSidePanel gets "Ver en grafo" shortcut; AppShell exposes NavigationBridge; URL-first nav avoids listener-not-mounted race.
- **#32** — In-memory snapshot ring buffer (48 max, throttle 1/hour); TimelineSlider shows snapshot ticks; inspector renders run timeline; Office gets "Knowledge Graph →" button; MobileView adds 🕸️ Grafo tab; perf gates for >250 nodes.

## Metrics

| | Before | After |
|---|---|---|
| Nodes | 22 | 94 |
| Edges | 2 | 59 |
| Node types | 7 | 9 (+raw-source, +runtime-log) |
| Edge types | 7 | 10 |
| API tests | 71 | 72 |
| Web tests | 13 | 18 |

## Decisions

- **No external graph DB / vector store / embeddings.** The graph rebuilds from disk + DB on each request. Fast enough for local-first scale.
- **URL is the source of truth for view state.** Filters, density, selection, search query are shareable.
- **CustomEvents for cross-feature nav.** `knowledge:select` and `knowledge:navigate` listened to in AppShell.NavigationBridge and useKnowledgeGraphPanel. Avoided introducing a router or store.
- **Snapshots in-memory only for v2.** Persisting to disk is a candidate next iteration but not blocking.
- **Marked for markdown without DOMPurify.** Content is local-first; XSS surface is limited to operator-authored files.

## Next candidates

Documented in `docs/knowledge-graph.md` "Next candidates" section. Top three by leverage:

1. WebSocket live updates (replace 15s polling).
2. Graph annotations + filter presets.
3. Dream proposal → graph curation feedback loop.

## Validation

- `pnpm typecheck` clean across 4 workspaces.
- `pnpm --filter @atellier/api test` — 72/72.
- `pnpm --filter @atellier/web test` — 18/18.
- Manual smoke against Ollama+memory-mode: graph renders 94/59, polling refreshes, ⌘K search filters with highlight, run timeline shows seed run logs, Office↔Graph nav works in both directions, mobile tab renders without canvas errors.
