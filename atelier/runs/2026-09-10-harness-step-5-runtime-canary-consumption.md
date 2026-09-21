# Harness step 5 — Runtime canary consumption

**Completed:** 2026-09-10T14:05:00Z  
**Scope:** consume a server-reserved Control Bundle budget in durable orchestration execution.

## Delivered

- `POST /orchestrations` accepts an optional validated `canaryId`; the server creates the run, performs deterministic reservation, and binds a selected receipt only while the orchestration is queued before attempt one.
- The durable worker revalidates the bound receipt and live canary at claim time and before every step. A rollback after reservation fails closed instead of silently switching configuration.
- Selected child runs inherit the frozen profile model, execution timeout, context byte limit, allowed-tool set, bundle fingerprint, receipt ID, and assignment fingerprint.
- Tool requests excluded by the bundle produce a durable `budget-tool-denied` invocation receipt.
- Terminal child evaluations receive the server-owned Control Bundle fingerprint, making later baseline/shadow evidence attributable to the configuration actually executed.
- The frozen retry budget sets the parent orchestration attempt ceiling. Non-selected reservations remain baseline runs and receive no bound budget.

## Validation

- API TypeScript check passed.
- Focused runtime, cancellation/model-budget, and Tool Harness suites: 23 passed.
- Full API suite: 250 passed, 5 Mongo-only tests skipped by design.
- A raw root-level Vitest invocation was intentionally disregarded because it included frontend tests without jsdom and unrelated `.claude/worktrees`; package-scoped API validation passed cleanly.

## Next

Align MCP retrieval-policy behavior with the HTTP/API path, add operator refresh recovery, and make CI selection deterministic.
