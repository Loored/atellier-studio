# Architecture

Atellier Studio uses a small local monorepo for a private, local-first AI operating system. The core product is not the pixel office; it is the memory, execution, review, and deliverable loop.

## Packages

- `apps/api`: Fastify API, MongoDB connection, Mongoose models, route handlers, and wiki/run services.
- `apps/web`: Vite React dashboard and API hooks.
- `packages/shared`: shared TypeScript types for agents, tasks, runs, and wiki data.

## Knowledge layers

- `atelier/raw`: immutable source material.
- `atelier/wiki`: durable synthesized knowledge and operational memory.
- `atelier/tasks`: markdown task views.
- `atelier/runs`: run history and outputs.

MongoDB stores operational state. Markdown stores inspectable memory.

## Current stage

The project has moved beyond Milestone 0 into:

```txt
Operational Spine + Agent Orchestration + Deliverables + Review UI
```

The core loop is:

```txt
source/input -> wiki update -> task -> agent run -> review -> deliverable -> memory update
```

Skill-triggered orchestration now sits on top of that spine:

skill -> parent orchestration run -> child agent runs -> validation/review logs -> wiki memory

## Design direction

The next architecture work should follow the Karpathy-style agentic system pattern:

- context manager: curate files, history, wiki pages, tools, constraints, and examples per task
- memory layer: keep session memory, persistent wiki memory, and Mongo operational state separate
- verification layer: expose evidence, logs, diffs, previews, and tests
- permission layer: require approval for sensitive, expensive, or destructive actions
- autonomy slider: explain, suggest, prepare artifact, execute with approval, execute monitored

## Near-term priorities

1. Codex Worker evidence pass (per-step output and finalize evidence surfaces).
2. Wiki Brain v2 (safe write/update routes and reusable memory capture).
3. Orchestration reliability and template modularization.
4. MCP after the above is stable.
