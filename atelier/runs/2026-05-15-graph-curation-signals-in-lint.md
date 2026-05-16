# Run Log - Graph Curation Signals In Lint

- Date: 2026-05-15
- Scope: Enrich `wiki/lint` with deterministic curation signals sourced from graph annotations and Dream decision trail.

## Implemented

- Extended wiki lint issue contract with `code: "curation_signal"`.
- Updated `WikiService.lint()` to include curation signals from:
  - `atelier/_runtime/graph-annotations.json` entries targeting `wiki-page:*` nodes tagged with curation-oriented tags (`stale`, `orphan`, `contradict*`, `needs-review`).
  - `atelier/wiki/decisions/*.md` records where Dream decisions are `deferred` or `rejected`, mapped to their `Report path`.
- Added lint issue de-duplication (`code + path + message`) to avoid noisy repeated signals.
- Added helper extraction logic for markdown decision sections used by the new lint branch.

## Validation

- `pnpm --filter @atellier/shared typecheck` ✅
- `pnpm --filter @atellier/api typecheck` ✅
- `pnpm --filter @atellier/web typecheck` ✅
- `pnpm --filter @atellier/api test` ✅ (83/83)
- `pnpm --filter @atellier/web test` ✅ (21/21)

## Test Coverage

- Added API test in `operational-spine.test.ts` that verifies:
  - annotation signal -> `curation_signal` issue for the tagged wiki page
  - deferred Dream decision -> `curation_signal` issue for the referenced dream report
