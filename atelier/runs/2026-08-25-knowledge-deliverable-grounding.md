# Knowledge deliverable grounding and validation

## Goal

Turn the first real source-to-memory soak failure into a bounded operational-spine improvement: linked sources must be readable by agents, knowledge artifacts must be present before approval, and Review must show actionable validation instead of duplicated false positives.

## Triggering evidence

- Parent orchestration: `6a8e15830337eb9bb30593f0`
- Linked task: `6a8e155b0337eb9bb30593d6`
- The source existed at `wiki/sources/2026-08-25-plan-operativo-de-14-d-as-para-usar-atellier-diariamente.md`, but agents received only paths and repeatedly promised to review it later.
- The validator treated the verified Wiki path as invalid, applied Builder sections to Toto Runtime, and Review repeated the same alert across three runs.
- Final QA approved without a complete 14-day plan; the parent deliverable contained only step metadata.

## Implemented slice

- Load bounded, read-only contents for linked `raw/...` and `wiki/...` paths into every orchestration step.
- Add those successfully loaded vault paths to per-run verified file hints and accept `atelier/...` aliases.
- Use `artifact-builder` and `runtime` validation profiles instead of applying the generic Builder contract to every builder-role step.
- Require Builder/Fix to include the full result under `Requested Artifact`; promises of future work are blocking validation errors.
- Preserve Markdown subheadings inside `Requested Artifact`, accept bold Markdown QA verdict labels, and deterministically require every day when the goal requests an N-day plan.
- Feed validation issues forward to later orchestration steps so Fix receives exact blocking evidence instead of only prior prose.
- Aggregate final Fix and QA evidence on the parent run, persist readiness, and block approval when the artifact or validation evidence is missing.
- Render the requested artifact as readable Markdown before execution JSON in the generated deliverable.
- Deduplicate Review's aggregate issues and invalid references while naming the number of affected runs.
- Raise the documented local execution timeout from 45 to 120 seconds so Ollama can return a complete knowledge artifact.

## Safety boundaries

- Raw sources remain immutable.
- Source contents are explicitly labeled read-only data and cannot override operator/orchestration instructions.
- Grounding is bounded per file and across all sources; previous step output is also bounded while preserving the most recent artifact.
- No new endpoint, external provider, auth, cloud, or autonomous write path was added.
- Automated tests use the mock executor only.

## Validation

- Focused API validator + daily-use loop: passed, including Markdown artifact headings, bold verdicts, rejection of collapsed day ranges, and avoidance of technical-duration false positives.
- Full API suite after live-evidence hardening: 127 passed, 3 opt-in Mongo tests skipped.
- Full Web suite: 26/26 passed.
- Monorepo typecheck: passed for Shared, API, Web, and MCP server.
- Browser validation at `http://127.0.0.1:5174/`: Review deduplicated three historical failures into three affected runs, one invalid reference, and three unique issues.
- Live Mongo + Ollama validation: run `6a8e6329c777ea7207017b8b` completed all seven steps in one attempt, loaded both linked source paths with zero invalid references, persisted the readable artifact, and finished `changes-required` because Builder/Fix collapsed the plan instead of rendering every requested day.
- The final Fix child `6a8e63c01d18db92b36a42d9` was rejected with `artifact-builder.incomplete_enumerated_artifact`; its exact missing-day evidence is now propagated to later steps and parent validation.

## Result

The run parent now carries the actual artifact plus an approval-blocking validation contract. A completed step list, a plausible QA verdict, or a collapsed `Día 2-14` range is no longer sufficient evidence for human approval.
