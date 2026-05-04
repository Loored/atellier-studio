# Run: Agent Stream CORS Fix

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/api`, `apps/web`, `atelier/wiki`
- Trigger: Stream request failed in browser with `CORS error` and `failed to fetch` despite successful preflight.

## Actions

- Fixed SSE stream response headers in `POST /agents/:id/run/stream`:
  - Set `Access-Control-Allow-Origin` for validated local origins on stream response.
  - Switched to explicit raw stream headers without dropping CORS compatibility.
- Unified local-origin validation helper and reused it in server CORS and route-level stream handling.
- Hardened id validation and error surfacing:
  - Invalid ids return `400` with clear message.
  - Frontend stream consumer now throws on stream error/missing result and surfaces message in panel.
- Added regression test that asserts stream route returns CORS headers for local origin.

## Validation

- `pnpm test:api` passed (`9 tests`)
- `pnpm --filter @atellier/api typecheck` passed

## Outcome

Agent stream requests now include browser-accepted CORS headers for local origins, preventing false `failed to fetch` on successful preflight.
