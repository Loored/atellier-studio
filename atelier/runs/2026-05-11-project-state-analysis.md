# Project State Analysis - 2026-05-11

- Run type: manual analysis
- Operator request: Analyze current project/code state and recommend next steps.
- Branch observed: main, aligned with origin/main.
- Validation:
  - `pnpm typecheck` passed after restoring workspace dependencies.
  - `pnpm test` passed: 71 API tests, 11 web tests.
  - `pnpm build` passed for shared, API, web, and MCP server packages.

## Findings

- Atellier Studio is in a strong operational-spine phase: Fastify API, React/Vite web app, Markdown wiki, runs, deliverables, orchestration skills, Codex Worker control-plane, MCP server wrapper, and multi-provider executors are present.
- P1-P4 from the 2026-05-06 platform-alignment plan are merged into `main`.
- The most important product gap is now Wiki Dream grounding: the `wiki-dream-loop` prompt does not preload real lint output or a current wiki path listing, which lets the curator invent page paths during live runs.
- The local checkout had missing MCP workspace dependencies because the new `apps/mcp-server` package had not been linked locally. `pnpm install --frozen-lockfile` restored the workspace.
- The working tree contains many untracked raw/wiki/run artifacts from May 8. These should be curated before the next commit so generated deliverables do not hide meaningful memory files.

## Recommended Next Steps

1. Implement P2.b Wiki Dream grounding in the orchestration call path.
2. Add focused tests proving the dream-loop audit step receives lint findings and real wiki paths.
3. Add the Wiki Dream UI trigger and report approval flow after grounding is stable.
4. Clean/curate the untracked May 8 memory artifacts.
5. Revisit Codex Worker Evidence Pass v1.1 after the wiki memory loop is grounded.
