# Exact Model Evidence and Citation Alignment

- Date: 2026-09-11
- Result: verified

## Outcome

Successful provider executions now persist the exact provider-confirmed model as `resolvedModel` in both run output and immutable terminal evaluation receipts. Parent orchestration evaluations inherit the exact model from their most recent evaluated child, while failed calls without a provider response remain honestly unspecified.

Builder's source citation contract now derives its eligible list from the same authority-filtered function used to populate `verifiedRepoFiles`. Retrieved trusted/context-only memory can still guide a response, but the prompt no longer tells Builder to cite a path that deterministic validation will reject.

## Real evidence

QA run `6aa3a9dbc7253eb086bfc141` returned an approved 2/2 checklist. Mongo persisted `resolvedModel: qwen3.5:9b` in both `run.output` and the terminal evaluation receipt.

The citation alignment fixes the internal contradiction observed in full-loop run `6aa3a39f4399a95b8d3f03c8`, where `wiki/workflows/daily-use-operational-loop.md` was presented as eligible by the prompt but rejected as unverified by the validator.

Full-loop run `6aa3aa67c7253eb086bfc151` confirmed the citation fix: Builder and Runtime passed without a citation repair, and QA returned a usable changes-requested checklist through `qwen3.5:9b`. Its three semantic repairs still used 4B and failed deterministic field validation, isolating the next bottleneck.

Semantic repair now requests the `deep` profile only for `semantic-repair-*`; local `deep` maps to `qwen3.5:9b`, while ordinary Scope, Build, Runtime, and deterministic repair remain on 4B. Run `6aa3add470831cd08886cb5f` verified the live handoff and `ollama ps` showed 9B as the sole loaded GPU model. It also exposed an oversized-QA timeout: the child received verbose QA artifact prose and expired at 240 seconds. The semantic prompt now carries only structured failing checklist items and caps output at 1,024 tokens. The timed-out canary was cancelled through the audited run API after its evidence was preserved.

Follow-up run `6aa3b102a6d45fcf05834939` did not reach QA because the stochastic 4B Builder exhausted deterministic repairs. This is evidence about the earlier artifact stage, not a regression in semantic routing.

Focused real child run `6aa3b3bd61a3d2e7a201d094` then exercised the compact correction contract directly. It completed in 32.8 seconds, persisted `resolvedModel: qwen3.5:9b`, and returned all requested Day fields plus `Sources Used`; validation passed with warnings only. A preceding diagnostic run exposed that `apps/api/.env` still mapped deep to 4B, so the local API-specific file was aligned with the repository environment (`deep=9B`, `QA=9B`).

## Safety

- Exact models come from provider responses or the exact submitted provider model fallback, never from UI inference.
- Failed/cancelled calls do not fabricate a resolved model.
- Canary-bound model overrides remain authoritative at request time and are reflected by the provider-confirmed value on success.
- Memory trust authority is unchanged; this only aligns prompt eligibility with the existing validation boundary.

## Validation

- All workspace typechecks passed.
- Focused provider, agent-run, and daily-use tests passed: 31/31.
- Full `corepack pnpm ci:check` passed: API 255 passed / 5 Mongo opt-in skipped, web 31 passed, MCP 2 passed, and dev-local 7 passed; all workspace typechecks passed.
- Focused daily-use tests passed again after semantic specialization: 16/16; API typecheck and `git diff --check` passed.
- Full post-specialization `corepack pnpm ci:check` passed: API 255 passed / 5 Mongo opt-in skipped, web 31 passed, MCP 2 passed, dev-local 7 passed, and all workspace typechecks passed.
