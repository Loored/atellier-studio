# Agent Memory Context Pack v1

- Date: 2026-08-30
- Branch: `codex/reflection-trust-hardening`
- Status: completed

## Goal

Give orchestration steps a bounded, deterministic package of direct evidence and relevant trusted memory, while persisting an inspectable receipt that is reused during retry and recovery.

## Scope

- Direct task sources remain highest priority.
- Trusted semantic/learning memory and immutable evidence may be retrieved automatically.
- Generated context is excluded from the default pack and never presented as instruction.
- Each included item records path, trust metadata, score/reason, content hash, byte count, and truncation.
- The parent run persists the context receipt; child steps reference the same immutable receipt.
- Review surfaces enough receipt detail for the operator to inspect what influenced execution.

## Safety Boundaries

- No automatic memory promotion.
- No embeddings or opaque reranking.
- No external LLM calls in tests.
- Retries must not silently retrieve a different context pack.

## Validation

- API context-pack, receipt persistence, and daily-use flow: 22 tests passed.
- Full API suite: 180 tests passed; 4 Mongo-only tests skipped in the default mode.
- Mongo concurrency suite: 4 tests passed against an isolated temporary database.
- Web suite: 29 tests passed, including the read-only receipt panel.
- Workspace typecheck: passed.
- Production build: passed (existing Vite bundle-size warning only).

## Outcome

- The parent orchestration now freezes one receipt before its first child step. It stores the full bounded excerpts, hashes, authority metadata, retrieval reason/score, budgets, and exclusions on the parent run.
- A retry or reclaimed run reuses that durable receipt rather than retrieving fresh context. A conflicting receipt fails closed; Mongo writes are atomic under the active worker lease.
- Direct task sources keep priority. Linked generated sources may appear only under a `NON-AUTHORITATIVE CONTEXT` label; autonomous retrieval excludes context-only artifacts.
- Trusted role memory is included once in the parent receipt and rendered only for its matching agent role. Evidence and direct paths are supplied as read-only data, never as instructions.
- The receipt is also written idempotently to `atelier/runs/context/<runId>-memory-context.md` and is visible from the orchestration panel for operator inspection.

## Follow-up boundary

This slice does not add embeddings, model reranking, autonomous promotion, or a wider authority surface. The next slice should use real labeled tasks to evaluate retrieval quality and receipt usefulness before changing retrieval policy or budgets.
