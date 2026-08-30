import type { FastifyInstance } from "fastify";
import {
  type AppendWikiLogInput,
  type WikiIngestInput,
  type WikiLogEventType,
  WIKI_DREAM_DECISION_VALUES,
  type WikiDreamDecisionRecordInput,
  type WikiWritePageInput,
  type WikiQueryInput,
  WIKI_RETRIEVAL_POLICIES,
  type WikiReflectionInput,
  WIKI_REFLECTION_DECISIONS,
  type WikiReflectionDecisionInput,
  type WikiReflectionPromotionInput,
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
    const retrievalPolicy = optionalStringField(body, "retrievalPolicy");
    if (retrievalPolicy && !WIKI_RETRIEVAL_POLICIES.includes(retrievalPolicy as (typeof WIKI_RETRIEVAL_POLICIES)[number])) {
      return badRequest(reply, "Invalid retrieval policy.");
    }
    const input: WikiQueryInput = {
      query,
      limit,
      sourceType: sourceType as WikiQueryInput["sourceType"],
      retrievalPolicy: retrievalPolicy as WikiQueryInput["retrievalPolicy"],
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

  fastify.post("/wiki/reflections", async (request, reply) => {
    const body = bodyRecord(request.body) ?? {};
    const input: WikiReflectionInput = {
      minOccurrences: typeof body.minOccurrences === "number" ? Math.floor(body.minOccurrences) : undefined,
      limit: typeof body.limit === "number" ? Math.floor(body.limit) : undefined,
    };
    return reply.code(200).send(await services.wiki.reflect(input));
  });

  fastify.post("/wiki/reflections/decisions", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const candidateId = stringField(body, "candidateId");
    const decision = stringField(body, "decision");
    const note = stringField(body, "note");
    if (!candidateId || !note || !decision || !WIKI_REFLECTION_DECISIONS.includes(decision as (typeof WIKI_REFLECTION_DECISIONS)[number])) {
      return badRequest(reply, "Candidate ID, accepted/rejected decision, and operator note are required.");
    }
    try {
      return reply.code(201).send(await services.wiki.recordReflectionDecision({
        candidateId,
        decision: decision as WikiReflectionDecisionInput["decision"],
        note,
      }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Reflection decision failed.");
    }
  });

  fastify.post("/wiki/reflections/promote", async (request, reply) => {
    const body = bodyRecord(request.body);
    const decisionPath = body ? stringField(body, "decisionPath") : undefined;
    if (!decisionPath) return badRequest(reply, "Decision path is required.");
    try {
      return reply.code(201).send(await services.wiki.promoteReflection({ decisionPath } satisfies WikiReflectionPromotionInput));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Reflection promotion failed.");
    }
  });

  fastify.post("/wiki/dream-decisions", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }
    const reportPath = stringField(body, "reportPath");
    const proposal = stringField(body, "proposal");
    const decision = optionalStringField(body, "decision");
    if (!reportPath) {
      return badRequest(reply, "Dream report path is required.");
    }
    if (!proposal) {
      return badRequest(reply, "Dream proposal is required.");
    }
    if (!decision || !WIKI_DREAM_DECISION_VALUES.includes(decision as (typeof WIKI_DREAM_DECISION_VALUES)[number])) {
      return badRequest(reply, "Dream decision must be one of: accepted, rejected, deferred.");
    }
    const input: WikiDreamDecisionRecordInput = {
      reportPath,
      proposal,
      decision: decision as WikiDreamDecisionRecordInput["decision"],
      rationale: optionalStringField(body, "rationale"),
      taskId: optionalStringField(body, "taskId"),
    };

    try {
      return reply.code(201).send(await services.wiki.recordDreamDecision(input));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Dream decision record failed.");
    }
  });
}
