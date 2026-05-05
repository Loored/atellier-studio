# Agent Protocol

Agents in Milestone 0 are operational records, not autonomous workers.

## Current responsibilities

- Track role and status.
- Link to current tasks and latest runs.
- Support task execution history through runs.
- Append meaningful outcomes to the wiki log.
- Participate in skill-triggered orchestration runs for build and wiki-ingest loops.

## Skill orchestration

Atellier can now start a parent orchestration run from a named skill:

- `atellier-build-loop`: PM -> builder -> runtime -> QA -> fix -> QA -> wiki curator.
- `llm-wiki-ingest-loop`: intake -> wiki curator -> wiki curator -> PM -> wiki curator.

These runs use the existing local agent/run spine. They are not yet full Codex worker execution or MCP tool orchestration.

## Future responsibilities

- Intake sources.
- Curate wiki pages.
- Plan tasks.
- Execute builder work.
- Review and lint outputs.

Do not implement MCP, Codex worker behavior, cloud execution, or pixel UI in Milestone 0.
