# Automatic model profile routing

- Date: 2026-08-31
- Scope: deterministic per-orchestration model profile selection.

## Behavior

- An explicit `modelProfileOverride` always wins.
- Without an override, short routine requests with cheap signals use `cheap`; risky architectural/production/database requests use `deep`; all other requests use `standard`.
- The resolved profile is persisted in the orchestration input and passed to every child step, so the selected Ollama model is auditable.
- No secondary LLM is used as a classifier; ambiguous requests remain on `standard`.

## Validation

- Shared/API/web typechecks passed.
- Router and runtime profile tests: 8 passed.

## Live verification and capacity decision

- Real runs confirmed automatic persistence of `cheap`, `standard`, and `deep` profiles.
- Running the three profiles concurrently saturated the local Mac while loading `gpt-oss:20b`, and the API/worker became unavailable.
- Safe local configuration now maps all three profiles to `qwen3.5:4b`. The profile contract remains intact so larger models can be opted into on a machine with more capacity.
