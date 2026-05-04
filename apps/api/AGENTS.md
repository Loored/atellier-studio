# apps/api/AGENTS.md

## Backend conventions

- Fastify owns HTTP routes.
- Mongoose owns MongoDB models.
- Services own business logic.
- Routes should stay thin.
- Use shared types and constants from `packages/shared` when possible.
- API tests should use Fastify `app.inject`.
- Do not start a real HTTP server in tests.
- Do not require real Codex/MCP in tests.
- Do not put business logic directly inside route handlers.
- Do not add auth yet.
- Do not add external integrations yet.

## Suggested structure

```txt
src/
  main.ts
  server.ts
  db/
    mongo.ts
    models/
  routes/
  services/
  test/
```
