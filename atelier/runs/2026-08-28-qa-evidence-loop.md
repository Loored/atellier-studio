# QA Evidence Loop

Date: 2026-08-28

## Goal

Make local QA decisions evidence-based, stop unproductive semantic loops, and prevent duplicate local workers.

## Implementation

- Scope acceptance criteria are passed explicitly to every QA evaluation.
- QA persists one `PASS` or `FAIL` checklist item with artifact evidence per criterion.
- Materially repeated normalized findings stop the next semantic repair and set `needs-human`.
- `./scripts/dev-local` fails closed when a durable worker for this repository already exists; it never kills it.
- Duplicate manual worker group `80728` was stopped, leaving launcher-owned group `55803` active.

## Validation

- Focused regression validation passed with 33 tests (`agent-response-validator` and `daily-use-loop`) plus API typecheck.
- Real 3-day Mongo/Ollama run `6a91ef00b71d3ad93af71cbd` completed all seven steps. Its initial QA requested changes, semantic repair 1 resolved the finding, QA recheck persisted a complete passing checklist, and Wiki Curator ran only after approval.
- Real 14-day Mongo/Ollama run `6a91efc0b71d3ad93af71dc8` produced a deterministically valid artifact after two focused repairs, then failed closed after QA exhausted two format retries without an explicit verdict or checklist. The run preserved `repair-2` as the last valid artifact and correctly skipped semantic repair and Wiki memory.
- A stale code-oriented smoke goal (`6a91ee4cb71d3ad93af71c0e`) was rejected after Builder referenced unverified paths; it was not counted as QA-loop validation.
- Final validation passed: API 149 tests (`3` opt-in Mongo tests skipped), Web 29 tests, launcher 7 tests, all four workspace typechecks, and all four production builds.
- Vite retained its existing warning for the application chunk exceeding 500 kB.
