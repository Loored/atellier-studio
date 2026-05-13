# 2026-05-12 - Knowledge Graph direction

## Summary

Captured the next product direction for Atellier Studio: add a local Knowledge Graph surface that visualizes the operational memory agents are building across sources, wiki pages, agents, roles, tasks, runs, reviews, deliverables, decisions, contradictions, dream reports, and skills.

## Decision

The graph is aligned with Atellier's current spine. It should start as a local read model over existing state, not as a new external integration layer.

The graph should represent knowledge quality, not just relationships:

- proposed
- verified
- contradicted
- stale
- orphaned
- accepted/rejected/deferred dream actions

## Next sequence

1. Memory artifact hygiene.
2. Knowledge Graph read model.
3. Graph View MVP.
4. Dream report review trail and graph curation.
5. Role memory.
6. Per-run executor override.
7. Codex Worker Evidence Pass v1.1.

## Updated files

- `docs/roadmap.md`
- `docs/knowledge-graph.md`
- `CODEX_MEMORY.md`
- `README.md`
- `atelier/tasks/active.md`
- `atelier/wiki/index.md`
- `atelier/wiki/log.md`

