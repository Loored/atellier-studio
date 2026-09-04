# 2026-05-12 - Memory artifact hygiene

## Summary

Started the memory artifact hygiene pass before building the Knowledge Graph.

The key issue was that generated validation artifacts were visible in `git status`, especially UUID-prefixed deliverables and Codex Worker finalize logs. Those are useful local evidence, but they should not become publishable durable memory unless promoted into curated wiki pages, synthesis notes, or narrative run logs.

## Changes

- Added UUID-prefixed generated deliverables to `.gitignore`.
- Added generated Codex Worker finalize logs to `.gitignore`.
- Added `docs/memory-artifact-hygiene.md` as the policy for what to track and what to keep local.
- Updated roadmap, README, Codex memory, wiki index, wiki log, and active tasks to point at the hygiene policy.

## Result

Generated deliverables and generated Codex Worker evidence are local artifacts by default.

Trackable memory is now clearer:

- raw inputs
- source summaries
- synthesis pages
- narrative run logs
- wiki log and index
- docs and task files

## Follow-up

- Review remaining untracked narrative run logs and source files.
- Decide whether `atelier/wiki/notes/my-note.md` is a scratch note or should be promoted into a meaningful page.
- Build the Knowledge Graph read model against curated memory first.

