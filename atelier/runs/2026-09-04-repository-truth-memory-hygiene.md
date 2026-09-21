# Repository Truth and Memory Hygiene

**Date:** 2026-09-04  
**Status:** Complete — local validation passed.

## Goal

Make repository memory reproducible and safe for autonomous context use by separating local generated evidence from curated Markdown memory.

## Changes

- Curated deliverables index now excludes ObjectId/UUID-generated run artifacts.
- Default Wiki query and reflection candidate collection exclude those local generated artifacts.
- Runtime projections under `atelier/_runtime/` are local-only.
- Active operational status, roadmap, task projection, and compact Codex handoff now identify one current engineering sequence.
- Root package scripts use Corepack so validation works without a global `pnpm` command.

## Validation

- Focused API tests passed: generated deliverables are absent from the curated index and default Wiki retrieval, while deliberately named curated deliverables remain indexed.
- Workspace typecheck passed.
- Deterministic suite passed: 207 API tests (5 opt-in Mongo tests skipped), 29 web tests, and 7 launcher tests.
- Workspace build passed.
- Git verification confirmed 0 tracked generated deliverables and 0 tracked runtime projections; 1,480 local generated deliverables and the historical graph snapshot remain on disk.

## Boundary

This maintenance slice does not delete local evidence, change run ownership, promote knowledge automatically, or call a real model.
