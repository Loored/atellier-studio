# Orchestration performance metrics

- Date: 2026-09-14
- Scope: phase/model duration observability
- Result: implemented and verified

## Source of truth

Performance is derived only from terminal child-run Evaluation Ledger receipts. No parallel clocks or client-provided timing are accepted. Each measured child contributes its immutable `durationMs`, provider-confirmed `resolvedModel` when available, and server-recorded orchestration phase.

## Summary

The parent orchestration exposes and persists a versioned summary with:

- number of measured child runs;
- summed child execution duration;
- duration and run count grouped by phase;
- duration and run count grouped by exact resolved model;
- explicit `unknown` model grouping for executors that do not report one.

Retries and repair attempts are intentionally included so the total describes actual model work rather than only the winning path. This is summed execution time, not wall-clock latency.

## Operator view

The Orchestration panel shows a compact Performance disclosure with human-readable duration and expandable phase/model breakdowns. It states that terminal child receipts are summed and retries are included.

## Verification

- Shared/API/Web typechecks passed.
- Daily-use loop verifies five measured phases and persisted output.
- App rendering verifies total duration plus phase and model entries.
- Full CI passed: 265 API tests, 34 web tests, 2 MCP tests, and 7 launcher tests; 7 opt-in Mongo tests remained skipped.
