# Active

Tasks currently in progress.

## 2026-05-12 - Next product spine

- [x] Memory artifact hygiene policy
  - Decide which generated run/deliverable files are durable wiki memory.
  - Decide which generated artifacts should remain local-only or ignored.
  - Keep curated wiki memory readable before the next feature slice.

- [ ] Memory artifact hygiene review
  - Review existing untracked run logs and raw/source files.
  - Track meaningful human-readable run logs and curated sources.
  - Leave auto-generated deliverables local unless promoted into curated memory.

- [x] Knowledge Graph read model
  - Derive graph nodes and edges from existing local state first.
  - Include wiki pages, sources, agents, roles, tasks, runs, deliverables, reviews, decisions, contradictions, dream reports, and skills.
  - Avoid external integrations, vector DB, or graph DB in v1.

- [x] Graph View MVP
  - Add a web page for the operational memory graph.
  - Include filters for role, agent, node type, review state, recency, and knowledge quality.
  - Follow the frontend API chain: service -> API hook -> feature hook -> component.

- [x] Graph visual QA and first polish
  - Run a browser screenshot review.
  - Improve graph layout/readability after seeing real data.
  - Add richer wiki link extraction and dream proposal decision nodes.

- [ ] Graph curation enrichment
  - Add richer wiki page link extraction.
  - Add dream proposal decision nodes and edges.
  - Add role/agent/review/recency filters after real-data usage.

- [ ] Dream report review trail
  - Record accepted/rejected/deferred decisions for dream proposals.
  - Feed those decisions back into graph curation and follow-up tasks.

- [ ] Role memory
  - Build curated per-role learning surfaces for recurring patterns, blockers, decisions, and handoff/cohesion issues.
