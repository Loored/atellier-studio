# Run: UI/UX and Security Review

- Date: 2026-05-04
- Operator: Codex
- Scope: `apps/web`, `apps/api`, `packages/shared`, `atelier/wiki`
- Trigger: Install requested skills and improve Atellier Studio UI/UX with Playwright and security/PDF review guidance.

## Inputs

- Installed skills: `pdf`, `security-threat-model`, `security-best-practices`, `playwright`.
- Product constraints: local-first private workflow, no auth/cloud/MCP/pixel UI yet.
- Current local services: API on `http://127.0.0.1:4000`, web on `http://127.0.0.1:5174`.

## Actions

- Reviewed the dashboard in a real browser with Playwright desktop and mobile viewports.
- Reworked the dashboard grid so Agents and Recent Runs occupy the first operational row, removing the large empty desktop space.
- Added compact panel counts, scannable status badges, capped panel list heights, and mobile two-column metrics.
- Added shared input limits for task titles and run log messages, enforced in both API and UI.
- Hardened local API defaults with localhost-only CORS reflection, explicit body limit, and baseline response security headers.
- Added a favicon to remove the dev-console 404 noise during UI review.
- Aligned the browser API default to `127.0.0.1:4000` after Playwright exposed `localhost` connection failures on this machine.
- Changed the API listen host default from `0.0.0.0` to `127.0.0.1`, keeping LAN exposure opt-in through `API_HOST`.

## Security Notes

- React scan found no `dangerouslySetInnerHTML`, direct DOM HTML sinks, browser storage token handling, or dynamic code execution in `apps/web`.
- The prior `origin: true` CORS behavior reflected arbitrary origins; this is now local-only for Milestone 0.
- No auth was added because auth is explicitly out of scope for this milestone.

## PDF Notes

- No PDFs are currently present in `atelier/raw`, so there was nothing to render or inspect.
- Future PDF source ingestion should preserve raw PDFs under `atelier/raw`, render pages for visual verification, then summarize into durable wiki pages.

## Residual Questions

- A final threat model should wait for confirmation of intended exposure: strictly local laptop only, LAN-accessible, or eventual remote/private network use.
- Data sensitivity should be confirmed before ranking risks around raw sources, wiki memory, and deliverables.
