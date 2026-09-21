# Frozen Acceptance Criteria Handoff

**Date:** 2026-09-04  
**Status:** Complete — validated locally.

## Goal

Make the PM's acceptance criteria explicit and invariant for each Build Loop step after scoping, so the lightweight local model does not need to infer them from a long prior-output transcript.

## Changes

- Extract the PM acceptance-criteria section from completed prior output.
- Inject it into Builder, repair, Runtime, and QA contexts as a numbered `Frozen acceptance criteria` block.
- State the boundary: later agents may not add, remove, rename, or weaken those criteria.
- Require implementation/runtime evidence and QA evaluation for every frozen item.

## Validation

- Added regression coverage that verifies Build, repair, Runtime, and QA each receive the same frozen criterion.
- Workspace typecheck passed.
- API: 208 passed; 5 Mongo integration tests intentionally skipped.
- Web: 29 passed.
- Production workspace build passed.
- Local dev launcher tests: 7 passed.

## Boundary

This is prompt/context reliability work only. It neither calls a real model in tests nor increases retry limits, model size, or autonomous authority.
