# Structured orchestration step context references

- Date: 2026-09-14
- Scope: orchestration context assembly
- Result: implemented and focused tests passed

## Problem

Prior step results were stored internally as pre-rendered strings. Artifact selection for QA therefore depended on matching human-readable headings and removing validation text with string splitting. A label or prose collision could silently select the wrong source.

## Change

Each prior step is now represented internally with explicit fields for step ID, label, agent, role, run ID, bounded response, validation feedback, and artifact eligibility. Rendering to the model-facing text contract happens only at the final context boundary.

QA selects the latest artifact through the structured `isArtifact` field and extracts the requested artifact directly from that step response. Frozen acceptance criteria select the PM scope by stable `stepId` rather than assuming the first formatted string is always scope.

## Compatibility

The rendered prompt keeps the existing headings, agent/run metadata, validation feedback, total context budget, and truncation markers. No shared API schema or persisted run format changed; recovery can still reconstruct references from completed child runs.

## Verification

- API typecheck passed.
- Daily-use loop passed all 17 behavior tests.
- Existing QA assertions confirm that Runtime prose and validation feedback do not leak into the artifact handoff.
- A full-suite run exposed a parallel-CI timing flake in the operational-spine polling assertion; the bounded test-only window was raised from 400 ms to 2 seconds, and the isolated test plus full API suite then passed.
