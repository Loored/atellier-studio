# Atellier MCP Server

The MCP server (`apps/mcp-server`) wraps the Atellier REST API as a [Model Context Protocol](https://modelcontextprotocol.io/) server, so MCP-aware clients (Claude Cowork, Claude Code, the future Claude Desktop, etc.) can use Atellier as a tool from within their own conversations.

This is the highest-leverage move from the post-keynote plan: Atellier exposes its **structured work model** (wiki / runs / orchestration / review) over MCP, and consumes the platform's agent runtime via Cowork. We do not reinvent the agent runtime.

Status: **P1.a — first end-to-end tool**. Currently exposes one tool (`wiki_query`). Remaining tools land in P1.b: `wiki_ingest`, `wiki_page`, `orchestration_run`, `runs_list`, `runs_get`.

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

### `wiki_query`

Search the Atellier wiki for matching pages, related notes, and known contradictions.

**Input:**

```json
{
  "query": "string (required)",
  "limit": "number (optional)",
  "sourceType": "page | log | raw (optional)"
}
```

**Output:** the raw `WikiQueryResponse` JSON from `POST /wiki/query` (matches with snippets + source paths, related pages, contradictions).

**Example call:**

```json
{
  "name": "wiki_query",
  "arguments": {
    "query": "anthropic executor",
    "limit": 5
  }
}
```

## Roadmap (P1.b → full surface)

The following tools are planned but not yet exposed; the REST endpoints already exist on `apps/api`:

| Tool | REST endpoint | Status |
|---|---|---|
| `wiki_ingest` | `POST /wiki/ingest` | planned |
| `wiki_page_read` | `GET /wiki/page` | planned |
| `wiki_page_write` | `POST /wiki/page` | planned |
| `orchestration_run` | `POST /orchestrations/skills/:id/run` | planned |
| `runs_list` | `GET /runs` | planned |
| `runs_status` | `GET /orchestrations/:id/status` | planned |

Once these land, an MCP client can drive a full Atellier session end-to-end without ever opening the FED.

## Scope notes

- **No remote hosting.** Local stdio only in v1.
- **No auth.** Stdio means the client owns the spawn; if you don't trust the client, don't add it to your MCP config.
- **No new endpoints required.** Every tool maps 1:1 to an existing REST endpoint. The MCP layer translates schemas and surfaces tool descriptions; it does not reimplement business rules.
