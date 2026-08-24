# Codex Worker Design (v1)

## Purpose

Define how Atellier executes Codex-style coding work safely inside the product without losing reviewability, memory quality, or cost control.

This is a design doc. It does not require broad autonomy or MCP integration yet.

## Scope For v1

- Local execution only.
- Explicit operator approval for risky actions.
- Run-linked logs and artifacts.
- Markdown-first memory capture.
- Testable with fakes (no real Codex calls in tests).

Out of scope:

- Cloud execution
- Multi-tenant auth
- Broad MCP tool orchestration
- Fully autonomous long-lived workers

## Principles

1. Human approval is a first-class control surface.
2. Every execution step should leave inspectable evidence.
3. Small, verifiable tasks are preferred over long opaque runs.
4. Memory updates are part of done criteria, not optional cleanup.
5. Default posture is safe and cheap unless operator opts in.

## Execution Modes

- `dry_run`: plan and command preview only, no command execution.
- `approved_step`: execute one approved step at a time.
- `monitored_run`: execute queued approved steps with live status and stop control.

Autonomy slider mapping:

- Explain -> plan only
- Suggest -> plan + proposed commands
- Prepare artifact -> patch/script draft only
- Execute with approval -> `approved_step`
- Execute monitored -> `monitored_run`

## Model Profiles

- `cheap`: fastest, lower depth, default for drafts and summaries.
- `standard`: balanced implementation tasks.
- `deep`: higher reasoning depth for architecture/debug investigations.

The selected profile and model must be shown before execution starts and recorded in run metadata/logs.

## Safety And Approval Policy

Approval required before:

- networked commands
- filesystem writes outside workspace policy
- package install/update
- destructive operations (`rm`, reset, force overwrite, schema-destructive ops)
- long-running commands above configured timeout budget

No-approval path (v1):

- read-only repo inspection
- lint/typecheck/test commands within local policy
- local markdown generation

## Proposed API Surface (v1)

All routes should stay thin; service owns behavior.

- `POST /codex/runs`
  - create worker run from task/goal + mode + profile.
- `GET /codex/runs/:id`
  - return status, step queue, logs, and artifacts.
- `POST /codex/runs/:id/plan`
  - generate/refresh step plan.
- `POST /codex/runs/:id/approve-step`
  - approve one step or command envelope.
- `POST /codex/runs/:id/execute-next`
  - execute next approved step.
- `POST /codex/runs/:id/cancel`
  - stop pending/running execution.
- `POST /codex/runs/:id/finalize`
  - produce summary + wiki memory payload.

## Command Envelope

Each executable command should be persisted with:

- `id`
- `summary`
- `command`
- `workingDirectory`
- `riskLevel` (`low|medium|high`)
- `needsApproval` (boolean)
- `approvedBy` and `approvedAt` (nullable)
- `startedAt` / `finishedAt`
- `exitCode`
- `stdoutPath` / `stderrPath` (artifact references)

## Data And Artifacts

Operational state:

- Mongo run record for status, queue, approvals, timestamps.

Durable artifacts:

- `atelier/runs/YYYY-MM-DD-codex-worker-*.md` session summary
- optional artifact files under `atelier/runs/artifacts/`
- `atelier/wiki/log.md` event entry
- wiki page updates when reusable knowledge changed

## UI Requirements (v1)

Minimum operator controls:

- mode + profile selector
- visible safety badge (`mock/safe` vs `real/risky`)
- plan panel with per-step approval chips
- execute next / execute monitored / cancel buttons
- command output viewer
- final review panel with:
  - changed files
  - test evidence
  - memory update checklist

## Verification Requirements

Before marking complete:

1. Relevant tests/lint/typecheck executed or explicitly skipped with reason.
2. Changed files listed in run summary.
3. Wiki/log updates confirmed.
4. If command failed, failure reason + next action captured.

## Testing Strategy

API/service tests (no real Codex calls):

- plan generation and step queue persistence
- approval gate enforcement
- blocked execution when approval missing
- cancel behavior
- finalize writes run log and wiki log event

Frontend tests:

- mode/profile visibility
- approval required state
- execute/cancel controls
- run detail rendering

## Phased Implementation Plan

### Phase 1

- Create `CodexWorkerService` with in-memory fake executor adapter.
- Add routes for create/plan/approve/execute/cancel/get.
- Persist to existing run model or parallel worker-run model (choose minimal change).
- Add API tests for approval and execution flow.

### Phase 2

- Add dashboard/office UI panel for worker runs.
- Add output viewer and approval controls.
- Add focused web tests.

### Phase 3

- Add finalize flow that writes:
  - run markdown summary
  - wiki log event
  - optional `CODEX_MEMORY.md` updates when active memory changed

## Definition Of Done (v1)

Codex Worker v1 is done when:

- operator can create a worker run from a goal,
- preview and approve steps,
- execute safely with logs and cancel control,
- review evidence,
- and close with durable markdown memory updates.

## Controlled Local Adapter

The real adapter is available only when `CODEX_WORKER_REAL_ENABLED=true`; fake-safe execution remains the default. The API records the active adapter in `/health`, each Codex run, step evidence, and the dashboard safety badge.

The fixed plan uses four ordered envelopes:

1. `rg --files` for repository inspection
2. `codex exec` for the approved implementation effect
3. `git diff --no-ext-diff` for a durable patch artifact
4. `pnpm typecheck` for the final contract check

Persisted command names are lookup keys, not shell input. The adapter constructs argv internally, uses `shell: false`, confines real paths to the configured repository/allowed subpaths, bounds output and runtime, and rejects dangerous Codex bypass/configuration flags. The implementation prompt is passed as one argv value.

`codex exec` runs with `--sandbox workspace-write`, the installed CLI's `--approve-for-me` automatic review, and `--ephemeral` only after the Atellier operator approves that step. It is wrapped by the irreversible-effect ledger using a key derived from run, step, and approved attempt plus a deterministic execution fingerprint. Explicit retries increment the attempt and require fresh approval.

Cancelling the run aborts the active process, then persists blocked step state and stdout/stderr evidence. Automated tests inject a fake process runner and never invoke Codex or another external executor.

Configuration:

```bash
CODEX_WORKER_REAL_ENABLED=true
CODEX_WORKER_ALLOWED_DIRS=.,apps/api
CODEX_WORKER_TIMEOUT_MS=120000
CODEX_WORKER_MAX_OUTPUT_BYTES=1048576
```
