# Architecture

Atellier Studio uses a small local monorepo.

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

## Current milestone

Milestone 0 builds the operational spine:

agents -> tasks -> runs -> logs -> wiki log

Skill-triggered orchestration now sits on top of that spine:

skill -> parent orchestration run -> child agent runs -> validation/review logs -> wiki memory
