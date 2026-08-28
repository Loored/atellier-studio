# Semantic QA Repair Loop

- Date: 2026-08-26
- Status: complete
- Branch: `codex/knowledge-deliverable-grounding`
- Scope: bounded QA-to-Builder corrections after deterministic validation

## Goal

Allow the build loop to correct qualitative QA findings autonomously without bypassing deterministic validation, finite attempt budgets, or human approval.

## Implementation

- Added a separate `semanticRepair` summary beside deterministic `repair` evidence.
- Added stable `semantic-repair-N` Builder steps and `qa-recheck-N` QA steps, capped at three attempts.
- Builder receives the full latest artifact and exact QA response, then returns a complete corrected artifact.
- Each corrected artifact retains deterministic validation before QA recheck.
- Wiki Curator runs only after explicit final QA approval.
- Exhaustion sets `readiness: needs-human`, preserves blockers, omits memory, and keeps approval disabled.
- Dashboard renders a distinct semantic repair summary and labels semantic timeline steps.

## Automated validation

- API: 133 passed; 3 opt-in Mongo tests skipped.
- Web: 28 passed.
- Shared, API, Web, and MCP typechecks passed.
- Integration coverage includes one-attempt semantic success and three-attempt exhaustion with memory omission.
- No automated test calls a real external model.

## Real Ollama evidence

- Parent run: `6a8f74b45eb53eb0cba161d4`.
- Build and Runtime passed; initial QA requested changes.
- The runtime executed `semantic-repair-1..3` and `qa-recheck-1..3` in durable order.
- Final state: `semanticRepair.attemptsUsed: 3`, `resolved: false`, `exhausted: true`, `finalStepId: qa-recheck-3`.
- Memory did not run and the parent ended for human intervention.
- The approval-guard check exposed that `semantic-repair-*` initially inherited the generic Builder validation profile. The classifier now treats every semantic repair as `artifact-builder`, and integration coverage asserts a persisted passing artifact-builder validation before QA recheck.
- The historical live run remains safely blocked with HTTP 409; it is not treated as successful evidence for the corrected classifier.

## Remaining boundary

The control plane is complete for bounded semantic correction. The local QA model still produced inconsistent or low-specificity verdicts, so the next improvement should focus on deterministic acceptance-criteria coverage or a stronger QA model/profile rather than adding more retries.

## Corrected-classifier soak — 2026-08-27

- Parent run: `6a90d2aba1f9703a01ae32cb`.
- `semantic-repair-1` persisted `repairKind: semantic`, input/output profile `artifact-builder`, a complete `Requested Artifact`, and passing deterministic validation before `qa-recheck-1`.
- `semantic-repair-2` and `semantic-repair-3` omitted `Requested Artifact`; both failed deterministic artifact-builder validation and correctly skipped their QA rechecks.
- The parent exhausted 3/3 semantic attempts, omitted memory, and rejected direct approval with HTTP 409.
- Defect found: completion selected the newest invalid semantic repair instead of preserving `semantic-repair-1` as the last valid artifact. The parent therefore reported a missing artifact even though a prior valid corrected artifact existed.
- Required fix: track and persist the last deterministically valid artifact separately from the latest attempted repair; final QA/blockers may reference the latest attempt, but the reviewable deliverable must not regress to an invalid response.

## Last-valid-artifact preservation — 2026-08-28

- Semantic repair state now records the latest attempted step, last deterministically valid artifact step, and last completed QA step independently.
- Parent completion selects the newest persisted artifact-builder response that contains `Requested Artifact` and passed deterministic validation, while retaining the latest invalid attempt's blockers.
- Semantic exhaustion continues to set `needs-human`, omit Wiki memory, and reject approval even when an earlier valid artifact remains available for review.
- Deterministic integration coverage verifies `valid -> invalid -> invalid` preserves the valid semantic repair and `all semantic invalid` falls back to the valid pre-semantic artifact.
- Targeted evidence: API daily-use loop 7/7 passed, Web App 18/18 passed, and Shared/API/Web typechecks passed.
- Real Ollama verification follows after the full automated suite and code review.

## Last-valid-artifact real soak — 2026-08-28

- Parent run: `6a912ec756b741dc192de796`.
- Build produced and deterministically validated a complete 14-day artifact; initial QA requested semantic changes.
- `semantic-repair-1..3` each omitted the required `Requested Artifact`, failed artifact-builder validation, and correctly skipped QA rechecks.
- The terminal summary persisted `finalStepId: semantic-repair-3`, `lastValidArtifactStepId: build`, and `lastQaStepId: qa`.
- Parent evidence retained the complete Build artifact (`sourceRunId: 6a912ee4956764dc8e2428f2`) instead of regressing to the invalid final repair.
- Final readiness remained `needs-human`, Wiki memory did not run, and an approval attempt was rejected with HTTP 409.
- This closes the defect discovered by run `6a90d2aba1f9703a01ae32cb` with both deterministic and real local-model evidence.

## Review + field-complete semantic patches — 2026-08-28

- Review now exposes the preserved artifact content, source step, latest semantic attempt, last QA step, and exhausted-state warning directly on the orchestration card.
- Artifact-builder validation infers explicitly requested daily fields from the goal and reports exact missing day/field pairs.
- Semantic repairs now return only corrected Day entries. The backend replaces those entries in the last valid artifact, preserves unaffected days, and deterministically revalidates the merge before QA.
- Latest invalid semantic validation messages are labeled as latest-attempt failures, avoiding the false impression that the parent lost its preserved artifact.
- Automated evidence: API 137 passed (3 Mongo opt-in skipped), Web 29 passed, and all workspace typechecks passed.

## Field-validation real soak and bounded repair batching — 2026-08-28

- Run `6a913d43ca37bbc03e80e4bb` proved the daily-field validator against Ollama: Build collapsed Days 5–13 and omitted acceptance, risk, and human-boundary fields; validation reported every missing day/field exactly and blocked Runtime/QA.
- The initial broad correction exceeded 120 seconds on all three durable execution attempts. Scope and Build were reused safely, but the run finished failed before QA or memory.
- Deterministic correction now selects at most five failing days per repair, requests complete entries only for that batch, and replaces those entries in the prior artifact. Three bounded passes can cover all 14 days without a monolithic rewrite.
- Post-fix validation: API 137 passed (3 Mongo opt-in skipped) and all workspace typechecks passed.

## Batched-build real verification — 2026-08-28

- Parent run: `6a913fe9af35cca136a9008b`.
- Earlier monolithic Build attempts timed out, then the recovered attempt used the live batching contract: Build produced Days 1–5; `repair-1` added 6–10; `repair-2` added 11–14; `repair-3` corrected the remaining Day 14 human-approval boundary.
- Deterministic repair resolved 3/3 without exhaustion and advanced to Runtime and QA with an 8,960-character, field-complete artifact preserved from `repair-3`.
- Local QA returned no explicit verdict and misclassified the document as a template. Three semantic attempts remained invalid and were rejected without replacing the valid artifact.
- Final semantic evidence: `finalStepId: semantic-repair-3`, `lastValidArtifactStepId: repair-3`, `lastQaStepId: qa`; memory was omitted and approval returned HTTP 409.
- The implementation succeeds at bounded deterministic construction and safe preservation. Local QA/model instruction-following remains the next quality boundary.
- Operational anomaly: the parent business status is `completed` and `/health` reports zero active runs, but its execution envelope remained at `finalizing` with no terminal event after the worker released it. This should be the next durable-runtime reconciliation fix; it does not weaken the review, approval, or memory gates.

## QA contract retry and terminal reconciliation — 2026-08-28

- QA responses without an explicit verdict now receive up to two bounded format retries before semantic repair. Stable retry IDs make recovery reusable and visible.
- A malformed QA response is never forwarded as semantic repair feedback. Exhaustion preserves the latest valid artifact, omits memory, blocks approval, and records `qaRetry.exhausted` with `readiness: needs-human`.
- QA rechecks after a semantic repair use the same guard, with IDs scoped to the recheck, so malformed recheck output cannot consume another semantic attempt.
- Completed parent runs left at `execution.phase: finalizing` are atomically reconciled to terminal `completed`, stale lease fields are cleared, and exactly one terminal event is emitted.
- Automated evidence: API 143 passed with 3 opt-in Mongo tests skipped; Web 29 passed; all workspace typechecks passed. Deterministic tests do not call external models.

## Real QA/reconciliation soak — 2026-08-28

- Run `6a915382678c0ba79e6a2e40` ended after deterministic repair exhaustion. Its parent briefly reached `completed + finalizing`; the next worker cycle atomically emitted event 19 (`completed by terminal-state reconciliation`) and settled the envelope to `completed`.
- Run `6a9154f6678c0ba79e6a2e8f` used a deterministically valid three-day artifact, received valid `CHANGES REQUESTED` verdicts through three semantic repairs, then got malformed output at `qa-recheck-3`.
- The runtime executed `qa-recheck-3-format-retry-1` and `qa-recheck-3-format-retry-2`; it did not create another semantic repair or run Wiki memory.
- Terminal evidence persisted `qaRetry.attemptsUsed: 2`, `exhausted: true`, `lastValidArtifactStepId: semantic-repair-3`, and `lastQaStepId: qa-recheck-3-format-retry-2`. Approval returned HTTP 409 with the exact QA-format exhaustion blocker.
- Event 40 completed the durable envelope through reconciliation with no duplicate terminal event.
- Post-soak observability keeps the already-consumed semantic repair summary when a later QA-format guard exhausts; deterministic coverage asserts that a malformed recheck cannot start the next semantic repair.
