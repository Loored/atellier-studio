# Wiki Dream UI Surface - 2026-05-11

- Run type: implementation
- Goal: Add the Wiki Dream UI surface after grounding the dream loop.
- Branch: `feat/wiki-dream-grounding`

## Summary

- Added a Dream section to the Wiki panel with a `Dream now` action.
- The action starts `wiki-dream-loop` through the existing orchestration service/API hook path.
- The panel tracks orchestration status, finds the `draft-report` step run, previews the report, extracts the suggested `wiki/dreams/*.md` path, and saves only after explicit operator approval.
- Added `wiki/dreams` to the safe wiki write path so approved reports can be persisted.
- Added web coverage for running a dream and saving the approved report.

## Validation

- `pnpm --filter @atellier/api typecheck`
- `pnpm --filter @atellier/web typecheck`
- `pnpm test:api`
- `pnpm test:web`

## Next

- Curate existing untracked memory artifacts before committing/publishing.
- Then revisit per-run executor override or Codex Worker Evidence Pass v1.1.
