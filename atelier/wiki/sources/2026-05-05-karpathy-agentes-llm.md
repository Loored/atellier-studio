# Karpathy Agentic Systems Insights

## Source

- Raw PDF: [2026-05-05-insights-karpathy-agentes-llm.pdf](../../raw/references/2026-05-05-insights-karpathy-agentes-llm.pdf)
- Raw path: raw/references/2026-05-05-insights-karpathy-agentes-llm.pdf
- Original local file: `/Users/e.juarez/Downloads/Insights_Karpathy_Agentes_LLM.pdf`
- Extracted with temporary `pypdf` install because Poppler was not available locally.
- Date captured: 2026-05-05

## Summary

The document argues for a sober agentic architecture: LLMs are programmable with natural language, but reliable products need curated context, explicit memory, tools, permissions, verification, logs, and human supervision. The right design target is not a fully autonomous "magic agent"; it is a small operating system around the LLM.

## Main Insights

- Software 3.0 means prompts, instructions, examples, constraints, and context become part of the program.
- The LLM behaves like a new compute substrate; the product must manage context as limited working memory.
- Context engineering is more important than prompt styling: decide which task, files, state, history, tools, examples, and constraints enter each step.
- LLM intelligence is irregular. Agents should be treated like fast collaborators with supervision, not senior autonomous workers.
- Autonomy should be a slider: explain, suggest, prepare artifact, execute with approval, execute monitored.
- The winning loop is generation plus verification: diffs, previews, sources, logs, tests, accept/reject, rollback.
- Keep work small and verifiable to avoid giant diffs, hidden assumptions, and brittle output.
- A demo is not a product. Production agent systems need reliability, recovery, and auditability.
- Human taste, judgment, and supervision remain the authority layer.
- Build for agents with Markdown, schemas, APIs, reproducible commands, logs, and eventually protocols such as MCP.

## Application To Atellier Studio

Atellier already matches several of these ideas:

- Markdown wiki as persistent memory.
- `atelier/raw`, `atelier/wiki`, `atelier/tasks`, and `atelier/runs` as inspectable operating memory.
- Run lifecycle with logs, deliverables, review states, and approval audit entries.
- Skill-triggered orchestration that creates parent and child runs.
- Conservative Codex instructions and no real external LLM calls in tests.

The next work should strengthen the missing product layers:

- Executor/model visibility before more real OpenAI orchestration.
- A Wiki Brain API that makes ingest/query/lint first-class.
- A Codex Worker design before letting the app run coding commands.
- UI surfaces for autonomy level, approvals, warnings, evidence, and rollback.

## Autonomy Slider For Atellier

| Level | Meaning | Atellier behavior |
| --- | --- | --- |
| 0 | Explain only | Chat/report output, no writes |
| 1 | Suggest | Plan, risks, checklist, no writes |
| 2 | Prepare artifact | Draft diff/spec/wiki page/deliverable for review |
| 3 | Execute with approval | Tool/file/API work only after human confirmation |
| 4 | Monitored execution | Low-risk workflows with logs, limits, timeouts, rollback |
| 5 | Broad autonomy | Not appropriate yet |

Current recommendation: keep most Atellier work at levels 1-3 until Wiki Brain, cost safety, and Codex Worker guardrails mature.

## Design Rules To Carry Forward

- Every agent run needs an explicit goal and success criteria.
- Build context packs per workflow instead of dumping all repo/wiki context into prompts.
- Show evidence for important output: source paths, commands, logs, diffs, screenshots, or tests.
- Require approval for sensitive writes, external effects, expensive models, and destructive commands.
- Preserve raw sources and create durable source summaries.
- Make errors product states, not opaque model text.
- Keep rollback/recovery visible before increasing autonomy.

## Contradictions Found

- No direct contradiction with existing Atellier direction.
- The main tension is priority: the pixel office arrived earlier than planned. Keep it, but do not let visual polish outrank Wiki Brain, safety, and reviewability.

## Proposed Tasks

- Add executor/model safety visibility.
- Build deterministic Wiki Brain MVP routes.
- Write Codex Worker design doc before implementation.
- Add autonomy-level language to orchestration/run UX when implementing the next runtime slice.
