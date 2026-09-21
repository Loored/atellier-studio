# Operator-Goal Precedence and QA Evaluation Boundary

**Date:** 2026-09-05  
**Status:** Complete — API validation and bounded-context real measurement passed.

## Trigger

The representative `qwen3.5:4b` run `6a9ba267ab62f0b41c87fbb6` let an evidence-only fourteen-day source override the operator's three-day request. Its QA agent also rewrote the artifact instead of issuing the required evaluation verdict.

## Changes

- Add an explicit `Operator-goal precedence` context contract to every orchestration step. It declares the operator goal controlling and prevents retrieved evidence from changing requested count or shape.
- For numbered day plans, require the artifact to contain exactly the requested day range. Extra days are now deterministic validation errors, not silently accepted scope creep.
- When a repair addresses extra day entries, require a complete replacement artifact instead of merging the invalid entries forward.
- Make the QA output contract explicitly evaluation-only and reject QA responses that reproduce `Requested Artifact` or Day-entry headings.

## Validation

- Focused API: 46 tests passed (`agent-response-validator`, `daily-use-loop`).
- API typecheck passed.
- Full API suite: 210 passed; 5 Mongo integration tests intentionally skipped.
- `git diff --check` passed.

## Boundary

No real model was called by these tests. A second real run should measure the changed contract before changing local model mappings or retry limits.

## Follow-up real measurement

Run `6a9bb46dd86e7717bed79af8` preserved the operator's three-day shape against the same conflicting fourteen-day evidence source. Two deterministic repairs removed invented file references and Runtime completed. QA then exceeded the local 240-second limit on all three durable parent attempts; no approval or memory promotion occurred.

This initially isolated the remaining bottleneck to local 4B QA latency rather than goal precedence or artifact count drift. QA now receives only the latest bounded artifact rather than the full prior-step transcript.

## Bounded-context real measurement

Run `6a9f0a5bde9f861dd31d3947` measured that narrowed QA context using the same local `qwen3.5:4b` configuration. An imperative Spanish operator goal (`Crea un plan…`) exposed one additional parser gap: the deterministic requested-day validator recognized `Create` but not `Crea`, so the preceding invalid run `6a9f08decaf376cd8a20fa84` was cancelled before QA after Builder produced fourteen days.

The correction recognizes common Spanish imperative artifact verbs and replaces only PM acceptance criteria that contradict the explicit day count in the operator goal. Focused API validation then passed (47 tests) with API typecheck and `git diff --check` clean.

The corrected run completed Scope, Builder, Runtime, and initial QA without a deterministic repair. QA completed in about 22 seconds instead of timing out at 240 seconds, proving the bounded artifact context resolves the latency bottleneck on this representative flow. It stopped `needs-human` after its one allowed checklist-completion attempt supplied incomplete evidence. No approval or memory promotion occurred.

The next focused slice is therefore QA checklist-format reliability, not a model-profile, global timeout, or retry change.
