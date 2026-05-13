# Knowledge Graph Direction

**Date:** 2026-05-12
**Status:** First read-only vertical slice landed 2026-05-12.

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

## MVP sequence

1. Add a backend graph read model that builds nodes/edges from existing state.
2. Add a `GET /knowledge/graph` or `GET /wiki/graph` endpoint.
3. Add shared graph types.
4. Add a Graph view in the web app using the existing service -> API hook -> feature hook -> component chain.
5. Add filters for node type, role, agent, review state, recency, and quality.
6. Connect Wiki Dream proposals to graph curation decisions.

Steps 1-4 landed in the first slice. The initial Graph view includes node type and quality filters; richer role/agent/review/recency filters should follow after visual QA against real local data.

## Non-goals for v1

- No external integrations.
- No vector database.
- No graph database.
- No autonomous silent merges.
- No broad agent autonomy without approval.
- No decorative-only graph with no operational meaning.
