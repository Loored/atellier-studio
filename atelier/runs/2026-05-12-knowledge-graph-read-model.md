# 2026-05-12 - Knowledge Graph read model

## Summary

Implemented the first Knowledge Graph vertical slice.

The graph is read-only and derived from existing local Atellier state. It does not use external integrations, embeddings, vector search, or a graph database.

## Implemented

- Shared graph types in `packages/shared`.
- Backend `KnowledgeGraphService`.
- `GET /knowledge/graph`.
- Graph nodes for agents, roles, tasks, runs, wiki pages, deliverables, and lint issues.
- Graph edges for role assignment, task assignment, run/task/agent relationships, deliverable links, and wiki lint quality.
- Web API chain: service -> API hook -> feature hook -> visual component.
- Sidebar Graph view.
- Initial Graph page with stats, filters, graph preview, node list, and relationship list.

## Validation

- `pnpm --filter @atellier/api typecheck`
- `pnpm --filter @atellier/web typecheck`
- `pnpm test:api`
- `pnpm test:web`
- Playwright screenshot review at `http://127.0.0.1:5174/` with API on `4001`.

## Visual QA follow-up

The first real-data graph exposed a useful issue: ignored/generated deliverable artifacts were still being read by the graph because the read model listed all wiki markdown paths. The graph initially ballooned to more than 1,400 generated nodes.

Fixed in the read model:

- UUID/ObjectId-generated deliverable pages are excluded from graph wiki-page nodes by default.
- Curated `wiki/deliverables/index.md` remains visible.
- Relationship cards now show readable labels instead of raw graph IDs.
- The Graph view now includes a node-type legend.

## Next

- Improve graph curation by connecting dream proposal decisions to accepted/rejected/deferred nodes and edges.
- Add richer wiki page link extraction and role-memory summaries.
- Add browser screenshot review again after adding real agents/tasks/runs to the local memory state.
