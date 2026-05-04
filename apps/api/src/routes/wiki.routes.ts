import type { FastifyInstance } from "fastify";
import { type AppendWikiLogInput, type WikiLogEventType } from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, optionalStringField, stringField } from "./route-utils";

const WIKI_EVENT_TYPES = [
  "initialization",
  "ingest",
  "query",
  "run_completed",
  "run_log",
  "wiki_lint",
  "decision",
  "manual",
] as const;

export async function wikiRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/wiki/index", async () => services.wiki.readIndex());
  fastify.get("/wiki/log", async () => services.wiki.readLog());

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
}
