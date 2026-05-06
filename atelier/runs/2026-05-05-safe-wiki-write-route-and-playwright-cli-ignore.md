# Run: Safe Wiki Write Route and Playwright CLI Ignore

- Date: 2026-05-05
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `packages/shared`, `.gitignore`, `atelier/wiki`, `CODEX_MEMORY.md`
- Trigger: Continue the wiki write-path work, ignore local Playwright CLI artifacts, and validate the change set.

## Actions

- Added a guarded wiki page write route:
  - `POST /wiki/page`
  - accepts `path` and `content`
  - writes only to allowed wiki markdown categories
  - rejects reserved or unsafe paths
- Extended shared wiki contracts with `WikiWritePageInput` and the `wiki_write` event type.
- Wired the web wiki panel to:
  - save a wiki page directly
  - promote a query result into a draft page
- Ignored `.playwright-cli/` in `.gitignore` so local browser automation artifacts stay out of the working tree.
- Updated memory and wiki log to record the change.

## Validation

- `pnpm test:api` passed
- `pnpm test:web` passed
- `pnpm -r typecheck` passed

## Outcome

The wiki now has a safe writeback path from the UI, query results can be turned into draft notes intentionally, and local Playwright CLI artifacts no longer pollute Git status.
