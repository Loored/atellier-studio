# QA format recovery deduplication

- Date: 2026-09-14
- Scope: Build Loop maintainability
- Result: implemented and verified

## Change

The initial QA response and every post-semantic QA recheck now use one bounded format-recovery runner and one canonical recovery instruction. The runner owns retry IDs, labels, logs, verdict parsing, explicit-verdict detection, and attempt accounting.

Targeted checklist evidence completion and semantic artifact repair remain explicit, separate paths: the former completes missing evidence without changing the verdict, while the latter changes the artifact in response to a valid QA failure.

## Compatibility

- Initial retries retain `qa-format-retry-N` IDs.
- Recheck retries retain `qa-recheck-N-format-retry-M` IDs.
- The frozen `AC-N` contract and retry limit are unchanged.
- Existing durable step reuse remains keyed by the same IDs.
- Exhaustion still routes to human review without consuming an additional semantic repair.

## Verification

- API typecheck passed.
- All 17 daily-use loop tests passed, including initial exhaustion and malformed recheck recovery.
- Full CI passed: all workspace typechecks, 265 API tests, 34 web tests, 2 MCP tests, and 7 launcher tests; 7 opt-in Mongo tests remained skipped.
