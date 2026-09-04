# Historical Orchestration Recovery

- Date: 2026-08-31
- Branch: `codex/reflection-trust-hardening`
- Status: completed

## Goal

Make terminal orchestration receipts recoverable from the Runs view after a refresh, so operators can label Context Pack usefulness without relying on an active Dashboard session.

## Change

- Runs now exposes `Open orchestration` for orchestration records.
- The action navigates to Dashboard and rehydrates the orchestration panel with the selected historical run.
- The existing receipt evaluation form remains terminal-only and continues using the service → API hook → feature hook → component chain.

## Safety

- No backend contract, retry budget, trust policy, or memory authority changed.
- The action only selects an existing run; it does not start or retry work.
- Repeated semantic attempts render with their persisted child run ID, avoiding duplicate React keys during historical recovery.

## Validation

- Web typecheck passed.
- App test suite passed.
- Production build remains the next broad gate after this UI-only slice.
