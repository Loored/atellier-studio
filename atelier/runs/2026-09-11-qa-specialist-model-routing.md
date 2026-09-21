# QA Specialist Model Routing

- Date: 2026-09-11
- Result: verified locally
- General model: `qwen3.5:4b`
- QA override: `qwen3.5:9b`

## Outcome

Atellier's existing role-aware Ollama router now uses the documented local default `OLLAMA_MODEL_QA=qwen3.5:9b`, while cheap, standard, and deep profile fallbacks remain on 4B for Mac stability. Settings renders active role overrides returned by `/health`, so the operator can see that the default model and QA model differ.

## Real evidence

- `/health` reported `executorModel: qwen3.5:4b` and `executorRoleOverrides.qa: qwen3.5:9b` after restart.
- Full-loop run `6aa3a39f4399a95b8d3f03c8` stopped safely before QA because Builder exhausted deterministic repairs; it did not waste a 9B call.
- Isolated production-path QA run `6aa3a4ce4399a95b8d3f056f` loaded `qwen3.5:9b`, returned an explicit `APPROVED` verdict, covered 2/2 `AC-N` criteria with concrete evidence, and passed QA validation with no issues.
- The same contract had repeatedly failed through bounded retries on 4B.

## Memory safety

Ollama's default residency briefly kept 4B and 9B loaded together. The local server was relaunched with `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=30s`, preventing sustained dual-model GPU residency. Atellier orchestration remains sequential.

## Validation

- Full `corepack pnpm ci:check` passed: API 254 passed / 5 Mongo opt-in skipped, web 31 passed, MCP 2 passed, and dev-local 7 passed; all workspace typechecks passed.
- `git diff --check` passed.
- After the configured 30-second idle lifetime, `ollama ps` reported no resident model.

## Review

- Blockers: none for role routing.
- Important follow-up: improve Builder's source-reference discipline independently; it prevented the full-loop comparison from reaching QA.
- Nice to have: persist the exact resolved model name on every evaluation receipt rather than only the model profile.
