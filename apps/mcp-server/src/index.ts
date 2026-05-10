/**
 * Atellier MCP server.
 *
 * Wraps the Atellier REST API so that MCP clients (Claude Cowork, Claude Code,
 * etc.) can use Atellier as a tool: query the wiki, ingest sources, run
 * orchestration skills, list runs, etc.
 *
 * Status: P1.a — first end-to-end tool is `wiki_query`. Other tools land in
 * follow-up steps (see docs/next-iteration-plan-2026-05-06.md, P1).
 *
 * Transport: stdio (the standard for desktop integrations). The MCP client
 * spawns this process and talks to it over stdin/stdout. We never bind a
 * network port, which sidesteps the auth question for v1 — only processes
 * that the user explicitly launches can talk to it.
 *
 * Configuration via env:
 *   ATELLIER_API_URL  default: http://127.0.0.1:4000
 *
 * Run locally:
 *   ATELLIER_API_URL=http://127.0.0.1:4000 \
 *     pnpm --filter @atellier/mcp-server dev
 *
 * Connect from Claude Code / Cowork: see docs/mcp-server.md.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
  type Tool,
} from "@modelcontextprotocol/sdk/types.js";
import type { WikiQueryInput, WikiQueryResponse } from "@atellier/shared";

const ATELLIER_API_URL = process.env.ATELLIER_API_URL ?? "http://127.0.0.1:4000";

const TOOLS: Tool[] = [
  {
    name: "wiki_query",
    description:
      "Search the Atellier wiki for matching pages, related notes, and known contradictions. " +
      "Returns structured matches with snippets and source paths so the calling agent can decide what to read next.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Free-text query. Required.",
        },
        limit: {
          type: "number",
          description: "Maximum number of matches to return (default: server-side default).",
        },
        sourceType: {
          type: "string",
          enum: ["page", "log", "raw"],
          description: "Restrict matches to a specific source type.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
];

async function callAtellierApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  const hasBody = body !== undefined;
  const response = await fetch(`${ATELLIER_API_URL}${path}`, {
    method,
    headers: hasBody ? { "Content-Type": "application/json" } : {},
    body: hasBody ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Atellier API ${method} ${path} → ${response.status}: ${text}`);
  }
  return response.json() as Promise<T>;
}

async function handleWikiQuery(rawArgs: unknown): Promise<CallToolResult> {
  const args = (rawArgs ?? {}) as Record<string, unknown>;
  const query = typeof args.query === "string" ? args.query.trim() : "";
  if (!query) {
    return {
      isError: true,
      content: [{ type: "text", text: "wiki_query requires a non-empty 'query' string." }],
    };
  }

  const input: WikiQueryInput = {
    query,
    limit: typeof args.limit === "number" ? args.limit : undefined,
    sourceType: args.sourceType as WikiQueryInput["sourceType"] | undefined,
  };

  try {
    const result = await callAtellierApi<WikiQueryResponse>("POST", "/wiki/query", input);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `wiki_query failed: ${(error as Error).message}`,
        },
      ],
    };
  }
}

async function main(): Promise<void> {
  const server = new Server(
    {
      name: "atellier-mcp-server",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name === "wiki_query") {
      return handleWikiQuery(request.params.arguments);
    }
    return {
      isError: true,
      content: [{ type: "text", text: `Unknown tool: ${request.params.name}` }],
    };
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // The SDK keeps the process alive while the transport is connected.
  // We log a single line to stderr so MCP clients can confirm startup
  // without polluting stdout (which the protocol owns).
  process.stderr.write(
    `[atellier-mcp-server] listening on stdio (api=${ATELLIER_API_URL})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[atellier-mcp-server] fatal: ${(error as Error).message}\n`);
  process.exit(1);
});
