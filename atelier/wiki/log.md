# Atellier Studio Wiki Log

## [2026-05-04T00:00:00.000Z] initialization | Milestone 0 wiki log created

- Summary: Initial durable wiki log for Atellier Studio operational memory.

## [2026-05-04T08:45:00.000Z] decision | Codex project memory added

- Summary: Created root CODEX_MEMORY.md and project-scoped Codex workflow files so future sessions can reuse setup decisions and avoid repeated mistakes.
- Pages updated: atelier/wiki/index.md, AGENTS.md

## [2026-05-04T08:34:56.571Z] run_completed | Manual run completed from dashboard
- Run ID: 192cb6a6-6914-4222-b02f-b54e9059538c
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:35:00.317Z] run_completed | Manual run completed from dashboard
- Run ID: 58339eb0-5ab7-4db0-b7aa-a1363d5970d1
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:46:15.068Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85cd5ce37ffaf49e8d4c3
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:50:05.249Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85dbcce37ffaf49e8d4d3
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:50:06.225Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85dbbce37ffaf49e8d4d0
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:50:18.442Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85dc8ce37ffaf49e8d4e2
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T08:56:41.416Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85e8050b17b38fa0eef7f
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T09:26:10.000Z] decision | UI/UX and security review captured

- Summary: Installed PDF, Playwright, and security skills; improved dashboard usability; hardened local API host, CORS, headers, and input bounds; captured threat-model assumptions for follow-up.
- Run log: atelier/runs/2026-05-04-ui-security-review.md
- Wiki page: atelier/wiki/synthesis/2026-05-04-ui-security-review.md

## [2026-05-04T09:32:31.074Z] run_completed | Manual run completed from dashboard
- Run ID: 69f867a3cb724968181cff6b
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T09:32:44.569Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85f4e50b17b38fa0eef9a
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T10:02:12.204Z] run_completed | Manual run completed from dashboard
- Run ID: 69f85f4a50b17b38fa0eef95
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T10:02:14.300Z] run_completed | Manual run completed from dashboard
- Run ID: 69f86ea5396bef24839c87d8
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T10:09:05.992Z] run_completed | Manual run completed from dashboard
- Run ID: 69f86ea6396bef24839c87dd
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T10:12:13.364Z] run_completed | Manual run completed from dashboard
- Run ID: 69f87043396bef24839c87f0
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T11:16:27.291Z] run_completed | Manual run completed from dashboard
- Run ID: 69f876e2396bef24839c8869
- Summary: Manual run completed from dashboard
- type: manual
- status: completed

## [2026-05-04T20:22:00.000Z] decision | Agent run execution spine implemented

- Summary: Added real local agent run execution endpoint, persistent per-agent message history, mock executor, and UI wiring from panel send action to run logs and stored responses.
- Run log: atelier/runs/2026-05-04-agent-run-execution.md

## [2026-05-04T20:30:00.000Z] decision | OpenAI executor mode added

- Summary: Added configurable executor modes so agent runs can use mock execution by default or real OpenAI execution via environment variables without changing frontend contracts.
- Run log: atelier/runs/2026-05-04-agent-executor-openai-mode.md

## [2026-05-04T20:55:00.000Z] decision | Agent panel streaming output added

- Summary: Added SSE-based stream route and frontend live-output rendering so users can see partial agent response while run execution is in progress.
- Run log: atelier/runs/2026-05-04-agent-run-streaming.md

## [2026-05-04T21:05:00.000Z] decision | Agent handoff MVP implemented

- Summary: Added real handoff flow where one agent can pass work to a target agent with carried context, creating chained runs and persisted handoff messages.
- Run log: atelier/runs/2026-05-04-agent-handoff-mvp.md

## [2026-05-04T21:12:00.000Z] decision | Handoff guardrails and execution timeout added

- Summary: Added configurable max handoff depth and execution timeout, with skip/cycle logs to prevent runaway orchestration chains and control cost/latency risk.
- Run log: atelier/runs/2026-05-04-agent-handoff-policy-guardrails.md

## [2026-05-04T21:28:00.000Z] decision | Stream CORS handling fixed for local dev origins

- Summary: Fixed SSE stream route response headers to preserve local CORS compatibility and added regression coverage for `Access-Control-Allow-Origin` on stream responses.
- Run log: atelier/runs/2026-05-04-agent-stream-cors-fix.md

## [2026-05-04T21:36:00.000Z] decision | OpenAI output parsing and handoff motion corrected

- Summary: Updated executor to parse Responses API `output[].content[].text` and refusal payloads, then improved office animation so executing/handoff agents move to execution zones instead of staying static.
- Run log: atelier/runs/2026-05-04-openai-output-parser-and-handoff-motion-fix.md

## [2026-05-04T21:46:00.000Z] decision | Agent panel now supports unblock + interactive terminal commands

- Summary: Added active unblock controls and a working in-panel terminal command surface so operators can recover blocked agents, run commands, and set statuses without leaving the office panel.
- Run log: atelier/runs/2026-05-04-agent-panel-unblock-and-terminal.md

## [2026-05-04T20:25:54.057Z] run_completed | Builder Agent completed execution and requests review.
- Run ID: 69f900d21661ff12a5751f51
- Agent ID: 69f85dc0ce37ffaf49e8d4da
- Summary: Builder Agent completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:55:37.951Z] run_completed | u better design! completed execution and requests review.
- Run ID: e58bac4f-2ab7-45e9-ad31-f66470d54cc4
- Agent ID: 82ca1ab5-0997-49e7-ad3d-178bf8c1f4ee
- Summary: u better design! completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:55:46.486Z] run_completed | u better design! completed execution and requests review.
- Run ID: 6842ee6b-5c55-4412-92ee-8a6ae5ad62c6
- Agent ID: 82ca1ab5-0997-49e7-ad3d-178bf8c1f4ee
- Summary: u better design! completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:55:48.720Z] run_completed | u better design! completed execution and requests review.
- Run ID: 5fbefc28-f8b0-4387-8702-a7d48bb65ae7
- Agent ID: 82ca1ab5-0997-49e7-ad3d-178bf8c1f4ee
- Summary: u better design! completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:55:49.387Z] run_completed | u better design! completed execution and requests review.
- Run ID: e6651484-2660-4dc5-b7da-8a9603358720
- Agent ID: 82ca1ab5-0997-49e7-ad3d-178bf8c1f4ee
- Summary: u better design! completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:56:58.666Z] run_completed | designer 1 completed execution and requests review.
- Run ID: 69f9081a092c7f8fdfe947dc
- Agent ID: 69f86e98396bef24839c87d3
- Summary: designer 1 completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T20:58:33.430Z] run_completed | designer 1 completed execution and requests review.
- Run ID: 69f9087997e3ca0c6ca07177
- Agent ID: 69f86e98396bef24839c87d3
- Summary: designer 1 completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T21:24:04.782Z] run_completed | Ana Designer completed execution and requests review.
- Run ID: 69f90e7473d5caa92f2844b6
- Agent ID: 69f86e5a396bef24839c87d0
- Summary: Ana Designer completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T21:33:21.475Z] run_completed | Ana Designer completed execution and requests review.
- Run ID: 69f9109f4e7d6e8f0f429d04
- Agent ID: 69f86e5a396bef24839c87d0
- Summary: Ana Designer completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T21:39:49.446Z] run_completed | Ana Designer completed execution and requests review.
- Run ID: 69f912224e7d6e8f0f429d2a
- Agent ID: 69f86e5a396bef24839c87d0
- Summary: Ana Designer completed execution and requests review.
- type: manual
- status: completed

## [2026-05-04T21:39:53.744Z] run_completed | designer 1 completed handoff execution.
- Run ID: 69f912254e7d6e8f0f429d37
- Agent ID: 69f86e98396bef24839c87d3
- Summary: designer 1 completed handoff execution.
- type: manual
- status: completed

## [2026-05-04T22:05:00.000Z] decision | Terminal handoff command added for faster delegation

- Summary: Added `handoff <agent-name-or-id> :: <instruction>` command in the panel terminal so operators can delegate tasks directly without switching to form controls.
- Run log: atelier/runs/2026-05-04-agent-terminal-handoff-command.md
