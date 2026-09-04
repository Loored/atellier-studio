# Reflection Trust Hardening

- Date: 2026-08-30
- Branch: `codex/reflection-trust-hardening`
- Status: validated locally

## Goal

Close the trust, path-integrity, signal-quality, and recovery gaps discovered when the reflection loop was audited against the real local vault.

## Scope

- Canonicalize writable Wiki paths and reject category traversal.
- Preserve immutable raw inputs without overwriting conflicting content.
- Prevent generic drafts or path selection from silently granting trusted authority.
- Remove structural JSON, IDs, paths, and boilerplate from reflection candidates.
- Give candidates stable collision-resistant identities.
- Rehydrate durable reflection decisions and promotions after refresh or restart.
- Make conflicting concurrent decisions fail closed and exact retries idempotent.

## Safety Boundaries

- No real-vault accept or promotion during implementation.
- No external LLM calls in automated tests.
- No automatic approval or promotion.
- Existing raw sources and runtime snapshots remain untouched.

## Validation

- API tests: 171 passed; 3 opt-in Mongo tests skipped.
- Web tests: 29 passed.
- Workspace typecheck: passed.
- Production build: passed; only the existing Vite chunk-size warning remains.
- Operational spine: 75 passed, including traversal, concurrent raw ingest, conflicting reflection decisions, durable rehydration, and fake-promotion rejection.
- Real-vault read-only audit: 1,532 episodic artifacts scanned; zero candidates returned by the strict narrative extractor; no decision or promotion was written.
- Mongo concurrency: 3 integration tests passed against a unique temporary database, which the test harness dropped afterward.
- Controlled Ollama soak: 6 isolated `llama3.1:8b` episodes produced exactly one two-episode narrative candidate, ignored duplicated JSON noise, and kept contradictory lessons separate.
- Restart recovery: fresh Wiki service instances rehydrated `accepted` and then `promoted`; `trusted-only` returned the canonical decision and promoted note.

## Outcome

- Generic Wiki writes cannot grant themselves authority through path or content.
- Raw evidence is preserved under exact retries and concurrent same-title ingests.
- Reflection candidate identity is stable and collision-resistant.
- Review state survives refresh/restart and only recognizes a promotion with a complete trusted provenance chain.
- Query-generated drafts remain saveable but non-authoritative, and manual edits detach stale automatic provenance.

## Next

Build Agent Memory Context Pack v1 with direct-source priority, trusted/evidence-first retrieval, bounded content, and a durable context receipt. Keep primary-vault promotion blocked until labeled real episodes produce a useful candidate.
