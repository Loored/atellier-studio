# Ollama profile routing update

- Date: 2026-08-31
- Executor: Ollama local
- Profiles: `cheap` → `qwen3.5:4b`, `standard` → `qwen3.5:9b`, `deep` → `gpt-oss:20b`

## Verification

- Installed and verified all three models with `ollama list`.
- API `/health` reports `executorMode=ollama`, `executorModel=qwen3.5:9b`, and `modelProfile=standard`.
- Runtime routing tests: 4 passed.
- API typecheck and full API suite: 187 passed, 5 skipped.

## Safety

Profile-specific variables take precedence over the legacy `OLLAMA_MODEL` fallback. Existing role overrides remain opt-in, and changing profiles requires restarting the API/worker so the selected model is captured in runtime metadata.

The orchestration API now accepts an optional `modelProfileOverride` per run. An explicit run profile selects the corresponding Ollama executor while preserving role overrides; omitted values continue using the environment profile.
