# Context Receipt Evaluation v1

- Date: 2026-08-30
- Branch: `codex/reflection-trust-hardening`
- Status: completed

## Goal

Create a human labeling boundary for real Agent Memory Context Pack receipts before changing retrieval policy, budgets, or authority.

## Behavior

- A terminal orchestration with a frozen context receipt can receive one overall label: `useful`, `mixed`, or `not-useful`.
- Every included source must be labeled exactly once as `relevant`, `uncertain`, or `irrelevant`; the label remains tied to the receipt hash and optional step role.
- The first evaluation is immutable. Exact retry is idempotent; a different second evaluation fails closed.
- The recorded evaluation is stored on the parent run, appended to its run log, and written idempotently to `atelier/runs/context/<runId>-memory-evaluation.md`.
- The Orchestration receipt panel exposes the terminal-only labeling controls and renders the saved outcome afterward.

## Safety boundaries

- No retrieval policy, budget, source content, trust metadata, or memory authority changes as a result of a label.
- Running, cancelled, manual, or receipt-less runs cannot be labeled.
- No external LLM calls are used in tests.

## Validation

- Context receipt persistence/evaluation tests: 5 passed.
- Full API suite: 182 passed; 4 Mongo-only tests skipped in default mode.
- Mongo concurrency suite: 5 passed against an isolated temporary database.
- Orchestration UI test: 19 passed.
- Workspace typecheck: passed.

## Next evidence gate

Collect several labeled real task receipts, inspect relevance by source authority and role, and only then propose a bounded policy or budget adjustment. Do not aggregate labels into automatic retrieval changes.

## First real local receipt — 2026-08-31

- Run: `6a94ee8f6fbbda91fd282eec` using local Mongo, durable worker, Ollama `llama3.1:8b`, and Builder override `qwen2.5-coder:7b`.
- Task: `6a94ee816fbbda91fd282ee8`, linked to immutable `raw/ingest/2026-08-31-context-pack-evaluation-brief.md` and its generated source summary.
- Receipt: `220905c1549c6ebba058393ef708aec8f184816db8e6f781e25488d903e29929`; it included the raw evidence, the directly linked non-authoritative summary, and role-scoped curator memory. Autonomous generated results were excluded.
- Outcome: Build and Runtime completed without deterministic repair. QA exhausted its two bounded format retries and the parent finished `needs-human`; no approval or memory capture occurred.
- Evaluation: `mixed`. Raw evidence was `relevant`; generated summary `uncertain`; curator memory `irrelevant` because the memory step never ran. The evaluation and frozen receipt are stored under `atelier/runs/context/` for the run ID.
- Interpretation: source grounding and the frozen boundary behaved as intended. This single label is insufficient to change retrieval; local QA format quality is the separate observed limiter.
