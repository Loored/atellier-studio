# Harness governance — Slice 3 paired Evaluation Ledger evidence

**Completed:** 2026-09-10T04:25:00Z  
**Scope:** require receipt-derived baseline/shadow evidence before a Control Bundle proposal can become eligible.

## Delivered

- Added immutable pairs of terminal Evaluation Ledger receipts, each bound to exact receipt fingerprints and a verified experiment.
- Pair creation requires different completed receipts with the same Context Receipt hash, agent role, and logical step. Missing or mismatched provenance fails closed.
- Proposal eligibility now requires at least three paired receipts, no receipt-derived regression, and a strict improving majority. Manual shadow observations remain available as context, but cannot make a proposal eligible.
- Proposals bind the exact evidence digest; later evidence changes make a non-canary proposal `evidence-stale` and prevent new approval.
- Added read endpoints and a Settings receipt view for the pair records. This is governance evidence only: it does not alter a live executor, routing, tools, budgets, or canary assignment.

## Validation

- `corepack pnpm -r typecheck`
- Focused API Tool Harness suite — 12 passed.
- Focused Settings suite — 1 passed.

## Next

Slice 4 can bind a separately approved canary to frozen runtime bundle receipts and enforce the corresponding budgets. It must not rely on the proposal record alone or activate broad routing.
