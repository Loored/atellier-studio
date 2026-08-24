# Active

Tasks currently in progress.

## 2026-05-12 - Next product spine

- [x] Memory artifact hygiene policy
  - Decide which generated run/deliverable files are durable wiki memory.
  - Decide which generated artifacts should remain local-only or ignored.
  - Keep curated wiki memory readable before the next feature slice.

- [x] Memory artifact hygiene review
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

- [x] Graph curation enrichment
  - Add richer wiki page link extraction.
  - Add dream proposal decision nodes and edges.
  - Add role/agent/review/recency filters after real-data usage.

- [x] Dream report review trail
  - Record accepted/rejected/deferred decisions for dream proposals.
  - Feed those decisions back into graph curation and follow-up tasks.

- [x] Role memory
  - Build curated per-role learning surfaces for recurring patterns, blockers, decisions, and handoff/cohesion issues.

- [x] Graph snapshot diff view
  - Compare two persisted graph snapshots.
  - Expose +/− node and edge deltas.
  - Surface the diff in Knowledge Graph UI for operational auditing.

- [x] Graph curation signals in lint
  - Feed annotation-based curation tags into `wiki/lint`.
  - Feed deferred/rejected dream decisions into `wiki/lint`.
  - Keep lint output explicit and deterministic for operator review.

- [x] Knowledge graph performance hardening (>300 nodes)
  - Reduce per-frame render work in canvas mode.
  - Avoid high-cost visual effects on large graph states.
  - Keep selection/navigation behavior intact while improving responsiveness.

- [x] Office sub-tabs for graph context
  - Add local tab switch between Office canvas and Knowledge Graph.
  - Keep graph curation workflow accessible without global view switch.
  - Preserve existing Office controls when returning to Office tab.

- [x] Role memory overlay in graph canvas
  - Expose role-memory signal map in knowledge panel state.
  - Add overlay toggle in graph controls.
  - Render role/agent risk badges from blocked/failed/pending-review counts.

- [x] Role memory focus filters in graph
  - Add quick focus modes for high-risk and pending-review role clusters.
  - Project focused subgraphs from role/agent memory signals.
  - Keep graph selection behavior coherent when focus mode changes.

## 2026-08-24 - Durable runtime reliability spine

- [x] Align roadmap and active memory after PRs #35 and #36
  - Mark shipped Knowledge Graph follow-ups as complete.
  - Record Durable Local Runtime v1 as the current execution foundation.
  - Make runtime hardening and controlled real Codex execution the next sequence.

- [x] Run the post-merge durability drill
  - Use an isolated Mongo database and local Ollama executor.
  - Verify offline queueing, restart/reclaim, completed-step reuse, event replay, cancellation, retry, and UI rehydration.
  - Record evidence and convert any failure into a bounded hardening task.

- [x] Durable Runtime hardening v1.1
  - [x] Expose retry for failed/blocked orchestrations from Runs history.
  - [x] Settle interrupted child runs when a parent is reclaimed or retried.
  - [x] Add multi-worker Mongo contention/reclaim integration coverage.
  - [x] Reject stale-worker step events after lease ownership changes.
  - [x] Add worker lifecycle diagnostics and graceful shutdown behavior.
  - [x] Propagate cancellation to supported provider requests with a cooperative fallback.
  - [x] Require a durable idempotency key and fingerprint before irreversible effects.

- [ ] Controlled real Codex Worker adapter
  - Keep the adapter behind a feature flag and human approval flow.
  - Constrain working directories and command execution.
  - Persist diffs, logs, tests, artifacts, and durations as review evidence.
