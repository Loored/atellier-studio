# Agent Skill Orchestration

## Summary

Atellier Studio should coordinate agents through explicit skills, not ad hoc chat instructions. A skill is the trigger and schema for a repeatable process; the app records the parent orchestration run and each agent step as durable operational memory.

## Source

- Raw source: [2026-05-05-llm-wiki-agent-orchestration.md](../../raw/references/2026-05-05-llm-wiki-agent-orchestration.md)
- Related skill: [atellier-agent-orchestrator](../../../.agents/skills/atellier-agent-orchestrator/SKILL.md)

## Current Implementation

- Shared orchestration types define skill ids, step summaries, start input, and orchestration results.
- API route `GET /orchestrations/skills` lists available orchestration skills.
- API route `POST /orchestrations/skills/:skillId/run` creates a parent `orchestration` run and sequential child agent runs.
- The dashboard Orchestration panel can trigger the process with a goal and optional context.
- Missing named agents are created automatically for the skill role/persona.
- Child step runs keep logs/messages but suppress automatic deliverables; the parent orchestration run is the reviewable deliverable.

## Skills

### `atellier-build-loop`

Coordinates:

1. PM scopes the vertical slice.
2. Builder plans or implements the slice.
3. Runtime agent checks compile/run readiness.
4. QA reports blockers.
5. Builder plans the fix pass.
6. QA approves or blocks.
7. Wiki curator files memory.

### `llm-wiki-ingest-loop`

Coordinates:

1. Intake preserves the raw source.
2. Wiki curator summarizes.
3. Wiki curator integrates pages and contradictions.
4. PM proposes follow-up tasks.
5. Wiki curator appends the chronological log.

## Design Decision

This is not yet a full Codex worker or MCP layer. The current slice uses the existing local agent run spine so orchestration is visible, inspectable, and testable. Real tool-running Codex subagents remain a later worker capability, but the local skill and API contract now describe the process that future workers should execute.

## Guardrails

- Keep raw sources immutable.
- File reusable decisions and outputs into the wiki.
- Keep parent orchestration runs readable.
- Use one fix loop by default, then ask for human review if uncertainty remains.
- Do not add auth, MCP, cloud deployment, or pixel UI for this slice.

## Follow-ups

- Add persisted orchestration templates if the hard-coded skill list needs operator editing.
- Link parent orchestration runs to child runs in the UI.
- Add a future Codex worker executor that can run real commands through allowlisted tools.
- Add wiki lint orchestration once ingest pages grow beyond the current index/log scale.
