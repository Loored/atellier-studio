# Harness governance — Slice 2 integrity and operator receipts

**Completed:** 2026-09-10T04:00:00Z  
**Scope:** make governance proposals, approvals, canaries, workspace previews, and workspace-change evidence referentially safe and inspectable before any runtime activation.

## Delivered

- Control Bundle proposals, approvals, canaries, and budget receipts now carry deterministic fingerprints that bind them to the exact bundle and proposal they authorize.
- Proposal and workspace-change records derive canonical states from immutable evidence: pending/approved/canary lifecycle for proposals, and preview/approved/applied/rolled-back for workspace changes.
- Approval and verification records reject unknown, stale, altered, already-applied, and already-rolled-back targets. Canary rollback and workspace transitions are append-only events rather than edits to prior evidence.
- Added dedicated list/detail/read endpoints and a read-only Settings surface for Governance and Workspace change receipts.
- This remains governance-only: it does not route live executions to a control bundle, activate canaries, enforce new budgets, or enable normal workspace writes.

## Validation

- `corepack pnpm -r typecheck`
- Focused API: `tool-harness.test.ts`, `workspace-changes.routes.test.ts` — 16 passed.
- Focused web: `SettingsView.test.tsx` — 1 passed.

## Next

Slice 3 must derive paired baseline/shadow evidence from Evaluation Ledger receipts before a proposal can become eligible. It must not infer eligibility from manual claims or alter runtime behavior.
