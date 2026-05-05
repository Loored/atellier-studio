# Agent Protocol

Agents are operational records with controlled execution history. They are not broad autonomous workers.

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

Do not implement MCP, broad Codex worker behavior, cloud execution, or wide autonomy until Wiki Brain, model safety, and review controls are stable. Pixel office exists as a visualization layer; do not prioritize pixel polish over memory and execution quality.
