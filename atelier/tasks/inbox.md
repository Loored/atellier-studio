# Inbox

Draft tasks that still need triage.

## 2026-05-05 - Proposed next Atellier work

1. Executor/model safety visibility
   - Show executor mode, model, and model profile in `/health` and UI.
   - Warn clearly before OpenAI-backed runs.
   - Keep mock mode obvious and easy to select.

2. Wiki Brain MVP
   - Add deterministic `POST /wiki/ingest`, `POST /wiki/query`, and `POST /wiki/lint`.
   - Preserve raw source references, update summaries, update index/log, and propose tasks.

3. Codex Worker design doc
   - Define command execution, sandbox approvals, model profiles, run logging, UI controls, and tests before implementation.

4. Orchestration reliability
   - Keep skill templates readable.
   - Split templates out of `SkillOrchestrationService` only when adding more workflows.

5. Tailwind remainder
   - Migrate Office/Mobile legacy CSS only when a real feature or regression requires it.
