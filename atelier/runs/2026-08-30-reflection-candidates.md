# Run Log — Reflection Candidates

- Date: 2026-08-30
- Branch: `codex/memory-trust-contract`
- Status: implementation validated

## Goal

Detect reusable patterns across repeated episodic artifacts without allowing reflection to silently become trusted memory.

## Result

- Added deterministic reflection over runs, tasks, deliverables, and Dream reports.
- A pattern must occur in at least two distinct episodic files; duplicates inside one file count once.
- Candidate evidence retains exact artifact paths as provenance.
- Candidates are `semantic / generated / context-only` and are not persisted by generation.
- The Wiki UI can generate candidates and prepare a proposed review draft in the existing editor.
- Saving remains a separate operator action and the saved reflection remains generated context.

## Boundary

No LLM call, schedule, autonomous write, semantic promotion, or role-learning promotion was added. Structured accept/reject/promotion is a later explicit-review slice.

## Validation

- Workspace typecheck: passed.
- API suite: 164 passed; 3 opt-in Mongo integration tests skipped.
- Web suite: 29 passed.
