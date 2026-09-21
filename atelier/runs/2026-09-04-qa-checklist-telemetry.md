# QA Checklist Telemetry Separation

**Date:** 2026-09-04  
**Status:** Complete — validated locally.

## Goal

Ensure the system can distinguish a malformed QA response from a readable QA verdict that omitted evidence for frozen acceptance criteria.

## Changes

- Added `BuildOrchestrationOutput` as the shared shape for persisted Build Loop output.
- Added `qaChecklistCompletion`, separate from `qaRetry`, with the missing criteria and the result of the bounded targeted attempt.
- Kept `qaRetry` exclusive to malformed/no-verdict QA responses.
- Updated orchestration status, dashboard panel, Review, and live-flow reporting so their labels and metrics match the persisted meaning.

## Validation

- `daily-use-loop.test.ts`: verified the success and needs-human checklist-completion paths without incrementing QA format retries.
- `live-flow-result.test.ts`: verified live metrics report `qa-checklist-completion` independently from `qa-format`.
- Workspace typecheck passed.
- API: 208 passed; 5 Mongo integration tests intentionally skipped.
- Web: 29 passed.
- Production workspace build passed.
- Local dev launcher tests: 7 passed.

## Boundary

This changes observability and persisted semantics only. It does not relax QA approval gates, increase retry limits, or call a real model.
