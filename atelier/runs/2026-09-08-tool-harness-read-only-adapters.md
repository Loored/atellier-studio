# Tool Harness read-only adapters — 2026-09-08

## Goal

Turn the Tool Harness catalog into a real but deliberately narrow execution path without granting arbitrary command, network, or write access.

## Implemented

- Added `ToolInvocation` and `InvokeToolInput` shared contracts.
- Made `wiki.query`, `wiki.lint`, and `runs.read` available adapters.
- Required a valid parent run for every invocation.
- Bounded Wiki queries to a 500-character query and 1–10 results.
- Kept lint input-free and reduced `runs.read` to a metadata summary.
- Persisted up to 50 invocation receipts on the parent run and wrote one concise run log per call.
- Left `workspace.search` and `workspace.read` as `policy-only` capabilities.

## Safety outcome

Unknown tools, unauthorized roles, and catalogued-but-unimplemented capabilities are denied and recorded. Raw tool output is returned only to the immediate caller; the durable receipt stores a digest, summary, paths, policy decision, status, and timestamps.

## Validation

- `corepack pnpm --filter @atellier/api test -- tool-harness.test.ts` — 4 passing tests.
- `corepack pnpm --filter @atellier/api typecheck` — passed.
- `corepack pnpm --filter @atellier/web typecheck` — passed.
- `git diff --check` — passed.

## Next

Introduce an explicit, schema-bounded tool-request/result exchange in the agent executor and orchestration loop, using these adapters and receipts. Do not enable any write-capable capability in that change.
