# Atellier MCP Server

The MCP server (`apps/mcp-server`) wraps the Atellier REST API as a [Model Context Protocol](https://modelcontextprotocol.io/) server, so MCP-aware clients (Claude Cowork, Claude Code, the future Claude Desktop, etc.) can use Atellier as a tool from within their own conversations.

This is the highest-leverage move from the post-keynote plan: Atellier exposes its **structured work model** (wiki / runs / orchestration / review) over MCP, and consumes the platform's agent runtime via Cowork. We do not reinvent the agent runtime.

Status: **P1.b — full first-cut surface live**. Eight tools cover the wiki, orchestration, and runs surfaces; an MCP client can drive an Atellier session end-to-end without ever opening the FED.

## How it works

- **Transport: stdio.** The MCP client spawns the server as a subprocess and talks to it over stdin/stdout. We never bind a TCP port, so there is no auth question to answer in v1 — only processes the user explicitly launches can speak to it.
- **Backend.** Each tool turns into a regular `fetch` call against the local Atellier REST API (default `http://127.0.0.1:4000`). The MCP server adds no business logic — it is a thin adapter.

```
┌──────────────────┐  stdio   ┌──────────────────┐  HTTP   ┌────────────┐
│  Cowork / Claude │ ───────▶ │ atellier-mcp-    │ ──────▶ │ atellier-  │
│  Code            │ ◀─────── │  server (this)   │ ◀────── │ api        │
└──────────────────┘  JSON-RPC└──────────────────┘  JSON   └────────────┘
```

## Run locally

The Atellier API must be up first (`pnpm --filter @atellier/api dev:memory` or `dev`).

```bash
ATELLIER_API_URL=http://127.0.0.1:4000 \
  pnpm --filter @atellier/mcp-server dev
```

You should see (on stderr):

```
[atellier-mcp-server] listening on stdio (api=http://127.0.0.1:4000)
```

The process stays alive waiting for an MCP client over stdin. Without a client connected there is nothing to interact with — that is normal.

## Connect from Claude Code

Add an entry to your Claude Code MCP config — typically `~/.claude.json` for user-level, or `.claude.json` in the project for project-level. See the Claude Code docs on MCP for the canonical location for your install.

```json
{
  "mcpServers": {
    "atellier": {
      "command": "pnpm",
      "args": ["--filter", "@atellier/mcp-server", "dev"],
      "cwd": "/absolute/path/to/atellier-studio",
      "env": {
        "ATELLIER_API_URL": "http://127.0.0.1:4000"
      }
    }
  }
}
```

Restart Claude Code. The tool `wiki_query` should appear in the tools palette.

## Connect from Claude Cowork

Cowork's MCP integration follows the same shape — point it at the same `command` + `args` + `cwd` + `env`. Refer to Cowork's settings UI for the exact JSON path.

## Tools

All tools are 1:1 adapters over existing REST endpoints. The MCP layer translates schemas and surfaces tool descriptions; it does not reimplement business rules.

| Tool | REST endpoint | Purpose |
|---|---|---|
| `wiki_query` | `POST /wiki/query` | Search the wiki for matches, related pages, and contradictions |
| `wiki_ingest` | `POST /wiki/ingest` | Preserve a raw source + write summary page + log entry + propose tasks |
| `wiki_page_read` | `GET /wiki/page?path=…` | Read a wiki page by path |
| `wiki_page_write` | `POST /wiki/page` | Create or replace a wiki page (auto-logs the write) |
| `orchestration_skills_list` | `GET /orchestrations/skills` | List skills available on this Atellier (with their step layout) |
| `orchestration_run` | `POST /orchestrations/skills/:id/run` | Start a skill in the background, returns a `runId` |
| `orchestration_status` | `GET /orchestrations/:id/status` | Poll per-step progress for a running orchestration |
| `runs_list` | `GET /runs` | List all agent and orchestration runs |

### Required vs optional inputs

| Tool | Required | Optional |
|---|---|---|
| `wiki_query` | `query` | `limit`, `sourceType` (note \| research \| client \| decision \| other) |
| `wiki_ingest` | `title`, `content` | `sourceType`, `sourcePathHint` |
| `wiki_page_read` | `path` | — |
| `wiki_page_write` | `path`, `content` | — |
| `orchestration_skills_list` | — | — |
| `orchestration_run` | `skillId`, `goal` | `context`, `taskId` |
| `orchestration_status` | `runId` | — |
| `runs_list` | — | — |

### Typical end-to-end flow

For an MCP client driving a build cycle:

1. `orchestration_skills_list` — discover available skills.
2. `orchestration_run` with `skillId: "atellier-build-loop"` and a goal — receive a `runId`.
3. `orchestration_status` — poll until `status === "completed"`.
4. `runs_list` — find the agent runs spawned by the orchestration.
5. `wiki_query` — confirm the wiki-curator wrote the expected memory.

For ingesting a research note:

1. `wiki_ingest` with `title`, `content`, `sourceType: "research"` — get back the raw path, summary path, log path, and proposed tasks.
2. `wiki_page_read` on the summary path — verify what the curator wrote.
3. Optionally `wiki_page_write` to amend the page.

### Example call

```json
{
  "name": "wiki_query",
  "arguments": { "query": "anthropic executor", "limit": 5 }
}
```

## Out of scope (intentional)

- **HTTP / SSE transport.** Stdio only in v1. We can add HTTP later when remote consumers exist.
- **Auth.** Stdio means the client owns the spawn; if you don't trust the client, don't add it to your MCP config.
- **New REST endpoints.** Every tool maps 1:1 to an existing endpoint. If the API doesn't expose it yet, the API layer changes first, then the MCP layer.
- **Streaming responses.** `orchestration_run` returns a `runId` and exits; clients poll via `orchestration_status`. SSE-style streaming is a P1.c candidate.

## Scope notes

- **No remote hosting.** Local stdio only in v1.
- **No auth.** Stdio means the client owns the spawn; if you don't trust the client, don't add it to your MCP config.
- **No new endpoints required.** Every tool maps 1:1 to an existing REST endpoint. The MCP layer translates schemas and surfaces tool descriptions; it does not reimplement business rules.
