# Lightweight Artifact and QA Handoff Reliability

- Date: 2026-09-14
- Result: verified

## Outcome

The 4B Builder no longer enters deterministic repair for equivalent Markdown field labels such as `**Objective**` on a standalone line or deeper `#### Day N` headings. Required fields remain exact and day counts remain strict.

QA now receives the exact latest Builder/repair artifact rather than whichever later step mentions its label. Frozen memory excerpts and wrapper validation telemetry are omitted from QA input, while the receipt hash, operator goal, frozen acceptance criteria, and complete artifact remain visible.

For numbered plans, PM criteria that incorrectly demand proof of future execution are replaced by deterministic artifact criteria. Safe artifact requirements from PM remain preserved. Artifact source authority is enforced through explicit `Sources Used`; incidental paths remain telemetry, while an unverified declared source still blocks validation.

## Real evidence

- Run `6aa3b102a6d45fcf05834939` originally exhausted three repairs even though its 4B output contained all required fields as standalone Markdown labels. The reproduced format now passes deterministic validation.
- Run `6aa79afb65462e2226991057` proved Builder could pass without repair, then exposed Runtime-output misselection in QA.
- Run `6aa79d3a5f3599ae8da4c9a9` confirmed QA memory compaction but still selected a Runtime mention of `Implement the slice`.
- Run `6aa79ebbe1ab2302e3bcb40a` confirmed the full artifact reached QA, then exposed validation warnings leaking into the artifact payload.
- Run `6aa7a175de3a4d59ef336896` confirmed clean artifact/telemetry separation, then exposed PM criteria requiring evidence that a requested plan had already been executed.
- Final clean run `6aa7a33a2bfb89fd979f74d6` completed all five steps with readiness `ready-for-human-review`, QA 5/5 pass, zero deterministic repairs, zero QA-format retries, and zero semantic repairs.

## Safety

- Raw sources were not modified.
- QA still receives a frozen receipt hash and fixed acceptance criteria.
- Candidate and changed files remain strictly validated.
- Only explicit artifact source declarations use the source-authority gate; path telemetry is still retained.
- No external provider or destructive workspace authority was introduced.

## Validation

- Focused API suites: 56/56 passed.
- API typecheck passed.
- `git diff --check` passed.
- Full `corepack pnpm ci:check` passed: API 259 passed / 5 Mongo opt-in skipped, web 31 passed, MCP 2 passed, dev-local 7 passed, and all workspace typechecks passed.

## Follow-up

An old test orchestration (`6aa79ebbe1ab2302e3bcb40a`) and child remained `running` after cancellation plus maximum durable retries across hot reloads. This is separate from artifact/QA correctness and should be the next runtime recovery slice.
