# Context Receipt evaluation soak — cycle two

- Date: 2026-08-31
- Goal: collect three sequential, representative real runs using the lightweight local Ollama configuration before proposing any retrieval-policy change.

## Scenarios

1. Code and architecture review.
2. Operational documentation and planning.
3. Wiki and persistent-memory maintenance.

## Guardrails

- Runs execute sequentially to preserve local capacity.
- Each parent receipt remains frozen and must be evaluated source by source before aggregation.
- No retrieval ranking, authority, byte budget, or promotion policy changes during collection.

## Runtime correction

- The lightweight `qwen3.5:4b` model fits local memory but enables reasoning by default. Its hidden trace exhausted bounded agent-output budgets before it emitted content.
- Ollama requests now use an 8192-token context window and `reasoning_effort: "none"`. A direct local completion returned `listo` with `finish_reason: stop`; the corrected architecture scenario advanced through scope, build, runtime, and QA.
- Builder artifacts on `qwen3.5:4b` can exceed the earlier 120-second local deadline. The safe local timeout is now 240 seconds; this changes wait tolerance only, not concurrency or memory usage.

## Evidence collected

- Three new terminal receipts were evaluated by the operator; all were labeled `useful`.
- The aggregate includes four evaluated receipts total: 3 useful and 1 mixed.
- `evidence-only` sources are relevant in 3/3 evaluated items. `trusted` sources are relevant in 3/4, with one irrelevant curator-memory observation retained as a counter-signal.
- The new read-only Dashboard summary exposes these counts by authority, role, and direct/retrieval source. It does not alter retrieval ranking, authority, byte budgets, or promotion policy.

## Automatic evidence assessments

- The system now appends one idempotent automatic assessment whenever a Context Receipt orchestration completes. A one-time backfill can assess older terminal receipts without rerunning the agents.
- It checks only whether each frozen source path appears explicitly in the terminal output. Results are `supported`, `partial`, or `unverified`; they are deliberately distinct from operator usefulness/relevance labels.
- Backfill on 2026-09-01 assessed 10 real terminal receipts: 0 supported, 1 partial, and 9 unverified. A reviewed useful plan receipt was unverified because the terminal artifact did not cite either receipt path; a previously failed run was also unverified because it had no terminal artifact. These are traceability signals, not a conclusion that the agent output or retrieval was poor.
- No ranking, authority, budget, or promotion policy changed. The next evidence-based slice is explicit receipt citations in artifacts, then a second automatic sample to measure whether traceability improves.

## Explicit source citations

- Artifact-producing agents now receive the eligible frozen source paths for their role and must add a `### Sources Used` subsection inside `## Requested Artifact`.
- The automatic assessment now counts only those deliberate declarations, never an incidental path mentioned in prose. `- none` is valid when no frozen source materially supported an artifact.
- A direct-source validation run correctly declared its immutable raw source. Its initial `partial` result exposed that terminal assessment was also scoring role-scoped curator memory unavailable to the builder. The assessment now excludes role-scoped-only items from its aggregate outcome while retaining them in the durable evidence list; this prevents a correct shared-source citation from being downgraded by inaccessible context.
