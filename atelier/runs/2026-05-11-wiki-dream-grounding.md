# Wiki Dream Grounding - 2026-05-11

- Run type: implementation
- Goal: Ground `wiki-dream-loop` audit context with real wiki state.
- Branch: `feat/wiki-dream-grounding`

## Summary

- Added `WikiService.listWikiMarkdownPaths()` so backend services can retrieve a fresh, canonical list of markdown pages under `atelier/wiki`.
- Updated `SkillOrchestrationService` to inject a `Wiki Dream Grounding` block only for the `wiki-dream-loop` `audit` step.
- Grounding includes `wiki.lint()` output, real wiki markdown paths, and an instruction to mark unlisted paths as unverified instead of inventing them.
- Added API coverage proving the audit run context includes a real lint issue and a real wiki path.
- Updated roadmap/current-state docs so P2.b is marked done and P2.c is the next recommended slice.

## Validation

- `pnpm --filter @atellier/api typecheck`
- `pnpm test:api`

## Next

- Build P2.c: Wiki Dream UI surface with explicit report save approval.
- Curate existing untracked memory artifacts before the next commit.
