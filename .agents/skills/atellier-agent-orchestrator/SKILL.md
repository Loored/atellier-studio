---
name: atellier-agent-orchestrator
description: Use when coordinating multi-agent Atellier work through a skill-triggered process, including build/fix/validate loops, LLM Wiki ingest/query/lint loops, and visible orchestration runs across PM, builder, runtime, QA, frontend, and wiki-curator agents.
---

# Atellier Agent Orchestrator Skill

Use this skill when the operator wants several agents to coordinate a task through a repeatable process.

The process must leave durable traces:

- a parent orchestration run
- child agent runs or Codex subagent summaries
- blocker/fix handoffs
- validation results
- wiki and run-log updates when reusable knowledge is created

## Preflight

1. Read `CODEX_MEMORY.md`, `AGENTS.md`, and relevant app-level `AGENTS.md`.
2. Read `atelier/wiki/index.md` and recent entries from `atelier/wiki/log.md`.
3. Identify whether the goal is:
   - `atellier-build-loop`: plan, build, validate, QA, fix, approve, file memory
   - `llm-wiki-ingest-loop`: preserve source, summarize, integrate pages, propose tasks, append log
4. Create or update a human-readable run log under `atelier/runs/`.

## Runtime Path

If working inside the Atellier app runtime, trigger the matching orchestration skill through the API/dashboard:

- `GET /orchestrations/skills`
- `POST /orchestrations/skills/:skillId/run`

Use the dashboard Orchestration panel when reviewing visually.

## Codex Agent Path

When the user explicitly asks for Codex subagents or parallel agent work, split the work into bounded roles:

- PM agent: scopes the vertical slice and acceptance criteria.
- Code agent: implements the smallest useful code change.
- Runtime agent: runs build/typecheck/dev-server checks and reports blockers.
- QA agent: tests behavior and returns actionable defects.
- Fix agent: addresses only the reported defects.
- Frontend agent: handles UI slice when the backend contract is stable.
- Wiki curator: preserves source context, updates wiki pages, and appends the log.

Keep write scopes disjoint when workers edit files. Tell workers they are not alone in the codebase and must not revert other edits.

## Loop

Default to one fix loop:

1. Plan the slice.
2. Implement the first pass.
3. Run compile/runtime checks.
4. QA reports blockers.
5. Builder fixes blockers.
6. Runtime/QA revalidates.
7. Human review or `needs-human` if uncertainty remains.
8. Wiki curator files durable memory.

Ask before continuing into additional fix loops unless the user has already requested persistence.

## Guardrails

- Do not build auth, MCP, cloud deploy, multiplayer, or pixel UI unless explicitly requested.
- Do not call real external LLMs, Codex, or MCP tools in tests.
- Do not hide important context only in MongoDB.
- Do not overwrite raw sources.
- Prefer explicit markdown artifacts over chat-only decisions.
- Keep updates short and status-oriented, with blockers named plainly.

## Finalization

Before finishing:

1. Run the smallest relevant tests/typechecks.
2. Update `atelier/wiki/index.md` and `atelier/wiki/log.md` if reusable knowledge changed.
3. Update `CODEX_MEMORY.md` for durable setup or workflow decisions.
4. Summarize files changed, validation run, and any remaining blockers.
