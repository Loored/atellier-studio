import type { FastifyInstance } from "fastify";
import {
  type AppendWikiLogInput,
  type WikiIngestInput,
  type WikiLogEventType,
  type WikiWritePageInput,
  type WikiQueryInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, optionalStringField, stringField } from "./route-utils";

const WIKI_EVENT_TYPES = [
  "initialization",
  "ingest",
  "query",
  "wiki_write",
  "run_completed",
  "run_log",
  "wiki_lint",
  "decision",
  "manual",
] as const;

export async function wikiRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/wiki/index", async () => services.wiki.readIndex());
  fastify.get("/wiki/log", async () => services.wiki.readLog());
  fastify.get("/wiki/page", async (request, reply) => {
    const query = request.query as { path?: string };
    const wikiPath = typeof query.path === "string" ? query.path.trim() : "";
    if (!wikiPath) {
      return badRequest(reply, "Wiki page path is required.");
    }

    try {
      return await services.wiki.readPage(wikiPath);
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") {
        return reply.code(404).send({ error: "Wiki page not found." });
      }
      return badRequest(reply, error instanceof Error ? error.message : "Wiki page read failed.");
    }
  });

  fastify.post("/wiki/page", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }
    const wikiPath = stringField(body, "path");
    const content = stringField(body, "content");
    if (!wikiPath) {
      return badRequest(reply, "Wiki page path is required.");
    }
    if (!content) {
      return badRequest(reply, "Wiki page content is required.");
    }
    const input: WikiWritePageInput = { path: wikiPath, content };
    try {
      const page = await services.wiki.writePage(input.path, input.content);
      await services.wiki.appendLog({
        eventType: "wiki_write",
        title: "Wiki page updated",
        summary: `Saved ${page.path}`,
        details: {
          path: page.path,
          contentBytes: Buffer.byteLength(page.content, "utf8"),
        },
      });
      return reply.code(201).send(page);
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Wiki page write failed.");
    }
  });

  fastify.post("/wiki/append-log", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    if (typeof body.eventType !== "string" || !WIKI_EVENT_TYPES.includes(body.eventType as WikiLogEventType)) {
      return badRequest(reply, "Wiki event type is invalid.");
    }

    const title = stringField(body, "title");
    if (!title) {
      return badRequest(reply, "Wiki log title is required.");
    }

    const details = body.details && typeof body.details === "object" && !Array.isArray(body.details)
      ? (body.details as Record<string, string | number | boolean | null | undefined>)
      : undefined;

    const input: AppendWikiLogInput = {
      eventType: body.eventType as WikiLogEventType,
      title,
      summary: optionalStringField(body, "summary"),
      runId: optionalStringField(body, "runId"),
      taskId: optionalStringField(body, "taskId"),
      agentId: optionalStringField(body, "agentId"),
      details,
    };

    return reply.code(201).send(await services.wiki.appendLog(input));
  });

  fastify.post("/wiki/ingest", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const title = stringField(body, "title");
    const content = stringField(body, "content");
    if (!title) {
      return badRequest(reply, "Ingest title is required.");
    }
    if (!content) {
      return badRequest(reply, "Ingest content is required.");
    }

    const sourceType = optionalStringField(body, "sourceType");
    const sourcePathHint = optionalStringField(body, "sourcePathHint");
    const input: WikiIngestInput = {
      title,
      content,
      sourceType: sourceType as WikiIngestInput["sourceType"],
      sourcePathHint,
    };

    try {
      return reply.code(201).send(await services.wiki.ingest(input));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Wiki ingest failed.");
    }
  });

  fastify.post("/wiki/query", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const query = stringField(body, "query");
    if (!query) {
      return badRequest(reply, "Query is required.");
    }

    const limitValue = body.limit;
    const limit = typeof limitValue === "number" && Number.isFinite(limitValue)
      ? Math.floor(limitValue)
      : undefined;
    const sourceType = optionalStringField(body, "sourceType");
    const input: WikiQueryInput = {
      query,
      limit,
      sourceType: sourceType as WikiQueryInput["sourceType"],
    };

    try {
      return reply.code(200).send(await services.wiki.query(input));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Wiki query failed.");
    }
  });

  fastify.post("/wiki/lint", async (_request, reply) => {
    return reply.code(200).send(await services.wiki.lint());
  });
}
