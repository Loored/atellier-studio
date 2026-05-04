# Run: OpenAI Output Parser and Handoff Motion Fix

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Agent runs showed `OpenAI execution returned an empty response` and handoff movement looked incorrect.

## Actions

- Updated OpenAI executor response parsing:
  - Parse text from `output[].content[].text` (`output_text` is SDK-only convenience).
  - Parse refusal text when present.
  - Enriched empty-response errors with incomplete/error details when available.
- Improved pixel office movement behavior for real execution/handoff:
  - Added execution zones for agents while working/executing.
  - Movement now shifts from desk to execution zone during active work and returns after.
  - Added slight jitter while executing to reflect live activity.
- Disabled orchestration simulation by default in office view (`orchestrationEnabled=false`) so manual real runs are not overwritten by random status updates.

## Validation

- `pnpm test:api` passed (`9 tests`)
- `pnpm test:web` passed (`3 tests`)
- `pnpm -r typecheck` passed

## Outcome

OpenAI responses are now extracted reliably from the Responses API structure, and handoff execution is visually reflected with intentional movement in the office canvas.
