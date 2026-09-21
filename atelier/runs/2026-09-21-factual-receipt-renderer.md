# Factual receipt renderer

Date: 2026-09-21

## Context

The complete sealed `exec3` campaign confirmed that the 4B Builder could still omit a usable factual artifact even after receipt-grounding instructions were added. The independent evaluator correctly prevented promotion, but prompt-only remediation was not reliable.

## Change

For a fact-report with succeeded server-acquired preflight receipts, the Build Loop now supplies a deterministic artifact fallback when Builder omits `Requested Artifact` or omits any required `Receipt <run-id>` block. The fallback renders only the returned receipt record for each requested ID, marks absent records `unverified`, includes the normal artifact-builder sections, and explicitly states that it grants no approval.

## Boundary

The fallback does not run without successful preflight receipts and does not apply to templates, procedures, or proposals. QA and the independent quality receipt remain authoritative for promotion decisions.

## Verification

- Focused Build Loop, artifact-quality, calibration, and operational-contract tests passed (29 tests in the final factual-renderer validation).
- Full workspace typecheck and `git diff --check` passed.
