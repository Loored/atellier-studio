# Orchestration performance soak

- Date: 2026-09-15
- Scope: three sequential real Ollama Build Loop runs
- Runtime: MongoDB, durable worker, `qwen3.5:4b` general roles, `qwen3.5:9b` QA/deep repair
- Result: metrics verified; context-authority reliability remains the next blocker

## Runs

### `6aa8c0812cf3e14c025b0472`

- Outcome: `needs-human`; deterministic repair exhausted 3/3 before Runtime or QA.
- Measured work: 5 child runs, 311,939 ms total.
- Model: 5 runs / 311,939 ms on `qwen3.5:4b`.
- Phase: Plan 39,376 ms; Backend 272,563 ms.
- Finding: Builder copied an irrelevant historical Wiki Curator review from retrieved memory and progressively lost the requested artifact.

### `6aa8c1e32cf3e14c025b048d`

- Outcome: pipeline completed after one semantic repair.
- Measured work: 7 child runs, 306,780 ms total.
- Model: 4 runs / 145,178 ms on `qwen3.5:4b`; 3 runs / 161,602 ms on `qwen3.5:9b`.
- Phase: Plan 24,612 ms; Backend 163,323 ms; Runtime 24,660 ms; QA 65,552 ms; Wiki 28,633 ms.
- Finding: QA approved a complete checklist whose PM-generated criteria referred to historical context-pack and repository validation evidence instead of the current operating-plan goal. This is a scope false-positive despite structurally valid QA.

### `6aa8c32a2cf3e14c025b04a0`

- Outcome: `needs-human`; deterministic repair exhausted 3/3 before Runtime or QA.
- Measured work: 5 child runs, 211,146 ms total.
- Model: 5 runs / 211,146 ms on `qwen3.5:4b`.
- Phase: Plan 21,966 ms; Backend 189,180 ms.
- Finding: every Builder attempt used `- none` as an explicit no-file marker. The validator treated `none` as an unverified path, creating a deterministic repair loop.

## Aggregate

- 3 terminal parent runs; 1 traversed the full pipeline and 2 stopped safely before QA.
- 17 measured child runs; 829,865 ms summed model execution time.
- 14 child runs / 668,263 ms on 4B; 3 child runs / 161,602 ms on 9B.
- No QA format retry or checklist-completion retry was used.
- The unified QA format-recovery refactor did not cause either failed run.

## Immediate correction

Exact no-file sentinels (`none`, `n/a`, `not applicable`, `no file(s)`) are now ignored only inside explicit file-list sections. Values containing those words, such as `wiki/none.md`, remain subject to strict verified-path validation.

## Next boundary

Freeze operator-goal-derived acceptance criteria independently of retrieved memory and require QA evidence to map back to that frozen goal contract. Retrieved evidence may support an artifact, but must not redefine its scope.

## Verification

- API typecheck passed.
- Validator and daily-use suites passed: 58/58.
- Full CI passed: all workspace typechecks, 267 API tests, 34 web tests, 2 MCP tests, and 7 launcher tests; 7 opt-in Mongo tests remained skipped.
