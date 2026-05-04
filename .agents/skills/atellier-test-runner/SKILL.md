---
name: atellier-test-runner
description: Use before finishing a code task, after modifying API routes, frontend hooks, components, shared types, or wiki services.
---

# Atellier Test Runner Skill

Run the smallest relevant validation first, then broader validation.

## Preferred commands

If backend changed:

```bash
pnpm test:api
pnpm --filter @atellier/api typecheck
```

If frontend changed:

```bash
pnpm test:web
pnpm --filter @atellier/web typecheck
```

If shared types changed:

```bash
pnpm -r typecheck
pnpm test
```

If setup/scripts changed:

```bash
pnpm install --frozen-lockfile
pnpm build
```

## Rules

- Do not call real Codex/MCP/external LLMs in tests.
- Do not add large snapshots.
- Prefer behavior tests.
- API tests should use Fastify inject.
- Web tests should use React Testing Library.
- Report exact failing command and error.
