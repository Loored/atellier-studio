# Sealed quality v1 — exec2 diagnostic report

Date: 2026-09-18

## Scope

This is the first complete serial execution of the frozen `sealed-quality-v1` suite after semantic-repair budget enforcement moved into the durable orchestration input. The suite hash is `6f9a26f781c5209275142ff106ff36723545931e3b055923a014477448d86190`; it was not edited.

## Result

- 8/8 cases finished under campaign `sealed-v1-exec2` / variant `contract-v3`.
- All eight were `needs-human`; none was promoted or treated as substantively approved.
- Every case respected the 12-minute child-duration budget and the enforced maximum of one semantic repair.
- Three independent negative controls rejected their artifact: the one-receipt factual report lacked receipt grounding or explicit uncertainty; the future procedure used an unsupported operational identifier; the evidence proposal exhausted its single semantic repair.
- The remaining five are `unverified`. This is not a positive quality result; it only means deterministic negative controls did not prove a violation.

## Interpretation

The safe control plane works: it prevented false promotion and prevented the previously observed multi-repair loop. The generation plane is not promotion-ready. The primary next defect is factual grounding: reports about existing receipts must make each claim traceable to server-acquired receipt data, or explicitly say `unverified`.

## Follow-up boundary

Do not edit the sealed suite or tune directly against its prompts. Implement and unit-test the factual-grounding and operational-capability contracts with development fixtures, then run a newly named campaign against this unchanged suite.
