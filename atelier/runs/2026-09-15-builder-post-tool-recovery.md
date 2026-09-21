# Builder post-tool artifact recovery — 2026-09-15

## Scope

The initial Build Loop Builder previously returned another `TOOL_REQUEST` after receiving its one authorized read-only result. That response became an invalid artifact and consumed deterministic repair. Its semantic repair could also repeat a circular request to prove that the plan itself had already been executed.

## Change and boundaries

After one successful bounded tool invocation, the initial Builder alone may receive one final artifact-only completion if it repeats a tool request. The second request is never invoked. A third repeated request still fails existing validation. The model passes share the same execution deadline, and a frozen canary budget with zero retries prevents the extra pass. Semantic feedback now asks for future, observable task/run checks and forbids assertions of already-run verification. Existing operator-goal authority, QA PASS evidence, human approval, and tool policy remain unchanged.

## Verification

`corepack pnpm ci:check` passed: 273 API tests, web tests, 2 MCP tests, 7 launcher tests, and all workspace typechecks. Focused mocks cover exactly one invocation and a valid artifact after two model tool requests. No real LLM was called by tests.

## Operational limitation and next measurement

The API at 127.0.0.1:4000 was unreachable. `./scripts/dev-local` detected existing repository worker PIDs 2193 and 80870 and refused duplicate startup; neither was stopped. Reconcile that local runtime before measuring two sequential real Build Loops, comparing first-pass artifact success, QA evidence, repair counts, model receipts, and elapsed durations. Stop at human review if evidence remains insufficient.

## Follow-up — 2026-09-16

Host-level checks showed that the API and Ollama were healthy outside the command sandbox; the existing worker could safely process sequential work. Four comparable real runs and the corrections they exposed are recorded in `2026-09-16-builder-citation-and-qa-evidence-soak.md`. The initial worker processes were not stopped.
