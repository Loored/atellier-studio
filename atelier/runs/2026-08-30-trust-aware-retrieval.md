# Run Log — Trust-Aware Retrieval

- Date: 2026-08-30
- Branch: `codex/memory-trust-contract`
- Status: implementation validated

## Goal

Use the memory trust contract during retrieval without adding opaque infrastructure or allowing generated content to become authoritative.

## Result

- Wiki query now searches both durable Wiki pages and immutable raw Markdown.
- Added explicit `balanced`, `evidence-first`, and `trusted-only` retrieval policies.
- Ranking combines deterministic lexical relevance with a small documented authority adjustment.
- Every match returns lexical, trust-adjustment, total score, and a readable ranking reason.
- `trusted-only` fails closed by excluding non-trusted matches and related pages.
- The Wiki UI exposes the policy selector and ranking explanation.

## Boundary

No embeddings, vector database, opaque reranker, autonomous promotion, or external LLM call was added. Trust classification remains visible on every result.

## Validation

- Workspace typecheck: passed.
- API suite: 163 passed; 3 opt-in Mongo integration tests skipped.
- Web suite: 29 passed.
