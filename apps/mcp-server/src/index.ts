/**
 * Atellier MCP server.
 *
 * Wraps the Atellier REST API so that MCP clients (Claude Cowork, Claude Code,
 * etc.) can use Atellier as a tool: query and write the wiki, ingest sources,
 * run orchestration skills, and inspect runs.
 *
 * Status: P1.b — full first-cut tool surface. Eight tools, all 1:1 adapters
 * over existing REST endpoints. No business logic lives here.
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
import type {
  OrchestrationSkillSummary,
  OrchestrationStatusResult,
  Run,
  StartSkillOrchestrationInput,
  StartSkillOrchestrationResponse,
  WikiIngestInput,
  WikiIngestResponse,
  WikiPageResponse,
  WikiQueryInput,
  WikiQueryResponse,
  WikiWritePageInput,
} from "@atellier/shared";

const ATELLIER_API_URL = process.env.ATELLIER_API_URL ?? "http://127.0.0.1:4000";

// ─── HTTP helpers ──────────────────────────────────────────────────────────
async function callApi<T>(method: string, path: string, body?: unknown): Promise<T> {
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

// ─── Result helpers ────────────────────────────────────────────────────────
function ok(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

function fail(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" && v.trim().length > 0 ? v.trim() : undefined;
}
function asNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}

// ─── Tool definitions ──────────────────────────────────────────────────────
const TOOLS: Tool[] = [
  {
    name: "wiki_query",
    description:
      "Search the Atellier wiki for matching pages, related notes, and known contradictions. " +
      "Returns structured matches with snippets and source paths so the calling agent can decide what to read next.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Free-text query. Required." },
        limit: { type: "number", description: "Maximum number of matches to return." },
        sourceType: {
          type: "string",
          enum: ["note", "research", "client", "decision", "other"],
          description: "Restrict matches to a specific source type.",
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "wiki_ingest",
    description:
      "Ingest a new source into the Atellier wiki. Preserves the raw content under atelier/raw, " +
      "writes a summary page under atelier/wiki, appends an entry to the wiki log, and proposes follow-up tasks.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Short human-readable title for the source." },
        content: { type: "string", description: "Full raw content to preserve and summarize." },
        sourceType: {
          type: "string",
          enum: ["note", "research", "client", "decision", "other"],
          description: "Optional source type used for filing and later filtering.",
        },
        sourcePathHint: {
          type: "string",
          description: "Optional filename hint for the raw file (slug-only, no slashes).",
        },
      },
      required: ["title", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "wiki_page_read",
    description:
      "Read a wiki page by its path (relative to atelier/wiki). " +
      "Returns the markdown content plus a `ready` flag indicating whether the page is fully populated.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Wiki page path, e.g. 'wiki/index.md' or 'wiki/decisions/...'." },
      },
      required: ["path"],
      additionalProperties: false,
    },
  },
  {
    name: "wiki_page_write",
    description:
      "Create or replace a wiki page. The server appends a 'wiki_write' entry to the wiki log automatically. " +
      "Use wiki_ingest instead when adding net-new source material — this tool is for direct edits.",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Wiki page path to write." },
        content: { type: "string", description: "Full markdown content to save." },
      },
      required: ["path", "content"],
      additionalProperties: false,
    },
  },
  {
    name: "orchestration_skills_list",
    description:
      "List the orchestration skills available on this Atellier instance. Each skill describes the multi-agent " +
      "loop it runs (e.g. atellier-build-loop, llm-wiki-ingest-loop) and the steps it goes through.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "orchestration_run",
    description:
      "Start an orchestration skill in the background. Returns a runId immediately; use orchestration_status " +
      "to poll progress. The orchestration drives multiple agents through the skill's defined steps.",
    inputSchema: {
      type: "object",
      properties: {
        skillId: {
          type: "string",
          description: "Skill id from orchestration_skills_list (e.g. 'atellier-build-loop').",
        },
        goal: {
          type: "string",
          description: "Concrete operational goal for the orchestration.",
        },
        context: {
          type: "string",
          description: "Optional extra context the agents should consider.",
        },
        taskId: {
          type: "string",
          description: "Optional Atellier task id this orchestration belongs to.",
        },
      },
      required: ["skillId", "goal"],
      additionalProperties: false,
    },
  },
  {
    name: "orchestration_status",
    description:
      "Get the live status of an orchestration run started by orchestration_run. " +
      "Returns per-step progress (pending | running | completed | failed) plus the active and next steps.",
    inputSchema: {
      type: "object",
      properties: {
        runId: { type: "string", description: "Orchestration run id returned by orchestration_run." },
      },
      required: ["runId"],
      additionalProperties: false,
    },
  },
  {
    name: "runs_list",
    description:
      "List all agent and orchestration runs known to the Atellier API. Useful as a discovery tool before " +
      "fetching a specific run's status. Returns the full Run array as stored.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

// ─── Handlers ──────────────────────────────────────────────────────────────
async function handleWikiQuery(args: Record<string, unknown>): Promise<CallToolResult> {
  const query = asString(args.query);
  if (!query) return fail("wiki_query requires a non-empty 'query' string.");
  const input: WikiQueryInput = {
    query,
    limit: asNumber(args.limit),
    sourceType: args.sourceType as WikiQueryInput["sourceType"] | undefined,
  };
  return ok(await callApi<WikiQueryResponse>("POST", "/wiki/query", input));
}

async function handleWikiIngest(args: Record<string, unknown>): Promise<CallToolResult> {
  const title = asString(args.title);
  const content = asString(args.content);
  if (!title) return fail("wiki_ingest requires a non-empty 'title' string.");
  if (!content) return fail("wiki_ingest requires a non-empty 'content' string.");
  const input: WikiIngestInput = {
    title,
    content,
    sourceType: args.sourceType as WikiIngestInput["sourceType"] | undefined,
    sourcePathHint: asString(args.sourcePathHint),
  };
  return ok(await callApi<WikiIngestResponse>("POST", "/wiki/ingest", input));
}

async function handleWikiPageRead(args: Record<string, unknown>): Promise<CallToolResult> {
  const path = asString(args.path);
  if (!path) return fail("wiki_page_read requires a non-empty 'path' string.");
  const queryString = `?path=${encodeURIComponent(path)}`;
  return ok(await callApi<WikiPageResponse>("GET", `/wiki/page${queryString}`));
}

async function handleWikiPageWrite(args: Record<string, unknown>): Promise<CallToolResult> {
  const path = asString(args.path);
  const content = asString(args.content);
  if (!path) return fail("wiki_page_write requires a non-empty 'path' string.");
  if (!content) return fail("wiki_page_write requires a non-empty 'content' string.");
  const input: WikiWritePageInput = { path, content };
  return ok(await callApi<WikiPageResponse>("POST", "/wiki/page", input));
}

async function handleOrchestrationSkillsList(): Promise<CallToolResult> {
  return ok(await callApi<OrchestrationSkillSummary[]>("GET", "/orchestrations/skills"));
}

async function handleOrchestrationRun(args: Record<string, unknown>): Promise<CallToolResult> {
  const skillId = asString(args.skillId);
  const goal = asString(args.goal);
  if (!skillId) return fail("orchestration_run requires a non-empty 'skillId' string.");
  if (!goal) return fail("orchestration_run requires a non-empty 'goal' string.");
  const input: Pick<StartSkillOrchestrationInput, "goal" | "context" | "taskId"> = {
    goal,
    context: asString(args.context),
    taskId: asString(args.taskId),
  };
  return ok(
    await callApi<StartSkillOrchestrationResponse>(
      "POST",
      `/orchestrations/skills/${encodeURIComponent(skillId)}/run`,
      input,
    ),
  );
}

async function handleOrchestrationStatus(args: Record<string, unknown>): Promise<CallToolResult> {
  const runId = asString(args.runId);
  if (!runId) return fail("orchestration_status requires a non-empty 'runId' string.");
  return ok(
    await callApi<OrchestrationStatusResult>(
      "GET",
      `/orchestrations/${encodeURIComponent(runId)}/status`,
    ),
  );
}

async function handleRunsList(): Promise<CallToolResult> {
  return ok(await callApi<Run[]>("GET", "/runs"));
}

const HANDLERS: Record<
  string,
  (args: Record<string, unknown>) => Promise<CallToolResult>
> = {
  wiki_query: handleWikiQuery,
  wiki_ingest: handleWikiIngest,
  wiki_page_read: handleWikiPageRead,
  wiki_page_write: handleWikiPageWrite,
  orchestration_skills_list: handleOrchestrationSkillsList,
  orchestration_run: handleOrchestrationRun,
  orchestration_status: handleOrchestrationStatus,
  runs_list: handleRunsList,
};

// ─── Server bootstrap ──────────────────────────────────────────────────────
async function main(): Promise<void> {
  const server = new Server(
    { name: "atellier-mcp-server", version: "0.1.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const handler = HANDLERS[request.params.name];
    if (!handler) {
      return fail(`Unknown tool: ${request.params.name}`);
    }
    try {
      const args = (request.params.arguments ?? {}) as Record<string, unknown>;
      return await handler(args);
    } catch (error) {
      return fail(`${request.params.name} failed: ${(error as Error).message}`);
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.stderr.write(
    `[atellier-mcp-server] listening on stdio (api=${ATELLIER_API_URL}, tools=${TOOLS.length})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`[atellier-mcp-server] fatal: ${(error as Error).message}\n`);
  process.exit(1);
});
