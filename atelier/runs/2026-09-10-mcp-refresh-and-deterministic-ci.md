# MCP retrieval parity, operator refresh, and deterministic CI

**Completed:** 2026-09-10T14:15:00Z  
**Scope:** close the remaining harness consolidation block after runtime canary consumption.

## Delivered

- MCP `wiki_query` now declares, validates, and forwards the same `balanced`, `evidence-first`, and `trusted-only` retrieval policies as `POST /wiki/query`; it also rejects invalid source types before making an HTTP request.
- The MCP adapter has its own deterministic tests and remains a thin transport over the API, which retains final policy authority.
- Settings now exposes `Refresh operator state`, invalidating all Tool Harness/governance queries plus health so the operator can recover after API or worker restart without waiting for polling or reloading the whole app.
- Obsolete UI and README claims about non-executable tools and non-consumed canary budgets were corrected.
- `.github/workflows/ci.yml` pins Node 22 and repository pnpm, installs from the frozen lockfile, and runs one package-scoped `ci:check` on pull requests and pushes to `main` or `dev/1.0.0`.
- `ci:check` covers all workspace typechecks, API tests, web tests, MCP adapter tests, and local-launcher tests. Real providers and the opt-in Mongo concurrency suite remain outside deterministic CI.

## Review

- Blockers: none.
- Important fixes completed during review: exclude MCP test sources from production build output and remove stale Tool Harness documentation.
- Architecture: frontend recovery follows query key → API hook data → feature coordinator → component; MCP contains transport validation only and does not duplicate retrieval ranking.

## Validation

- `corepack pnpm ci:check`
- API: 250 passed; 5 Mongo-only tests skipped by design.
- Web: 30 passed.
- MCP: 2 passed.
- Local launcher: 7 passed.
- All workspace typechecks and workflow YAML parsing passed.

## Next

Perform the remaining API-layer maintainability cleanup, then run the representative real 4B evaluation using the corrected QA telemetry.
