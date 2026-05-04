# UI and Security Review - 2026-05-04

## Scope

- Frontend: `apps/web`
- API: `apps/api`
- Shared contracts: `packages/shared`
- Durable memory: `atelier/wiki`, `atelier/runs`

This review used the installed `playwright`, `security-best-practices`, `security-threat-model`, and `pdf` skill guidance. The threat model section below is an assumption check-in, not a final threat model report.

## UI/UX Improvements

- Dashboard grid now places Agents and Recent Runs together in the first operational row.
- Tasks and Wiki Log remain full-width work surfaces for queue work and memory review.
- Compact panel list scrolling prevents long agent/run lists from pushing the whole dashboard too far down.
- Status badges make task/run states easier to scan.
- Empty task titles and empty run logs now disable their submit buttons.
- Task title and run log fields expose the same length limits that the API enforces.
- Mobile status metrics use two columns, reducing vertical scanning cost.
- The browser API default now uses `127.0.0.1:4000`, avoiding `localhost` IPv6 resolution issues seen during Playwright review.

## Security Best-Practices Findings

| ID | Status | Finding | Action |
| --- | --- | --- | --- |
| SEC-001 | Fixed | API CORS previously reflected arbitrary origins through `origin: true`. | Restricted reflected browser origins to local hosts for Milestone 0. |
| SEC-002 | Fixed | API responses had no explicit baseline security headers. | Added `Referrer-Policy`, `X-Content-Type-Options`, and `X-Frame-Options`. |
| SEC-003 | Fixed | Task titles and run log messages did not have explicit shared length limits. | Added shared limits and enforced them in frontend controls and API routes. |
| SEC-004 | Verified | React UI scan found no raw HTML rendering, direct DOM HTML sinks, browser token storage, or dynamic code execution. | No fix required. Continue avoiding React/browser escape hatches. |
| SEC-005 | Fixed | API process listened on `0.0.0.0` by default even though Milestone 0 is local-first. | Changed default listen host to `127.0.0.1`; LAN exposure now requires `API_HOST=0.0.0.0`. |

## PDF Skill Notes

No PDFs currently exist in `atelier/raw`, so no PDF rendering or layout validation was possible in this pass.

Recommended future PDF intake pattern:

- Store original PDFs immutably under `atelier/raw`.
- Render pages to PNG for visual inspection before summarizing.
- Extract text for search/summarization only after confirming the rendered layout is legible.
- Write human-readable summaries and links into `atelier/wiki`.

## Threat Model Assumption Check-In

Key assumptions that affect risk ranking:

- Atellier Studio is intended for a single trusted local operator right now.
- The API binds to `127.0.0.1` by default; LAN exposure requires an explicit `API_HOST` override.
- No auth, accounts, cloud deployment, MCP, or multiplayer workflows are in scope yet.
- Wiki, raw sources, tasks, runs, and deliverables may contain sensitive personal/client operational memory.
- MongoDB is local infrastructure, not a remote managed service.

Questions before producing a final threat model:

1. Should the API be treated as laptop-only, LAN-accessible, or eventually reachable from a private remote network?
2. Should raw/wiki memory be treated as highly sensitive client data by default?
3. Is multi-user access still explicitly out of scope for the next milestone?
