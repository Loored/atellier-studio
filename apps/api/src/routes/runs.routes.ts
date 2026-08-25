import type { FastifyInstance } from "fastify";
import {
  AGENT_ROLES,
  REVIEW_LEARNING_MAX_LENGTH,
  REVIEW_LEARNING_SIGNAL_PATH_MAX_LENGTH,
  REVIEW_LEARNING_SIGNALS,
  RUN_LOG_LEVELS,
  RUN_LOG_MESSAGE_MAX_LENGTH,
  RUN_REVIEW_STATUSES,
  RUN_STATUSES,
  RUN_TYPES,
  type AppendRunLogInput,
  type CaptureRunMemoryInput,
  type CompleteRunInput,
  type CurateRunLearningInput,
  type CreateRunInput,
  type RunStatus,
  type UpdateRunReviewInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import {
  badRequest,
  bodyRecord,
  isOneOf,
  isValidObjectId,
  notFound,
  optionalStringField,
  stringField,
} from "./route-utils";

export async function runsRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/runs", async (request, reply) => {
    const query = request.query as { type?: string; status?: string; limit?: string };
    if (query.type && !isOneOf(query.type, RUN_TYPES)) {
      return badRequest(reply, "Run type is invalid.");
    }
    const statuses = query.status
      ?.split(",")
      .map((status) => status.trim())
      .filter(Boolean);
    if (statuses?.some((status) => !isOneOf(status, RUN_STATUSES))) {
      return badRequest(reply, "Run status filter is invalid.");
    }
    const parsedLimit = query.limit === undefined ? undefined : Number(query.limit);
    if (parsedLimit !== undefined && (!Number.isInteger(parsedLimit) || parsedLimit < 1)) {
      return badRequest(reply, "Run limit must be a positive integer.");
    }
    return services.runs.list({
      type: query.type as CreateRunInput["type"] | undefined,
      statuses: statuses as RunStatus[] | undefined,
      limit: parsedLimit,
    });
  });

  fastify.get("/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const run = await services.runs.getById(id);
    return run ?? notFound(reply, "Run not found.");
  });

  fastify.get("/runs/:id/events", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const run = await services.runs.getById(id);
    if (!run) {
      return notFound(reply, "Run not found.");
    }
    const query = request.query as { after?: string; limit?: string };
    const after = query.after === undefined ? 0 : Number(query.after);
    const limit = query.limit === undefined ? undefined : Number(query.limit);
    if (!Number.isInteger(after) || after < 0) {
      return badRequest(reply, "Event cursor must be a non-negative integer.");
    }
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      return badRequest(reply, "Event limit must be a positive integer.");
    }
    return services.runEvents.list(id, { after, limit });
  });

  fastify.get("/runs/:id/events/stream", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const run = await services.runs.getById(id);
    if (!run) {
      return notFound(reply, "Run not found.");
    }
    const query = request.query as { after?: string };
    let cursor = query.after === undefined ? 0 : Number(query.after);
    if (!Number.isInteger(cursor) || cursor < 0) {
      return badRequest(reply, "Event cursor must be a non-negative integer.");
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    let closed = false;
    request.raw.on("close", () => {
      closed = true;
    });

    const pushEvents = async (): Promise<boolean> => {
      const response = await services.runEvents.list(id, { after: cursor, limit: 200 });
      for (const event of response.events) {
        reply.raw.write(`id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
      }
      cursor = response.nextCursor;
      const latest = await services.runs.getById(id);
      const terminal = latest
        ? ["completed", "failed", "blocked", "cancelled"].includes(latest.status)
        : true;
      if (terminal) {
        reply.raw.end();
        closed = true;
      }
      return terminal;
    };

    try {
      while (!closed && !await pushEvents()) {
        await new Promise<void>((resolve) => setTimeout(resolve, 750));
      }
    } catch {
      if (!closed) {
        reply.raw.end();
      }
    }
  });

  fastify.post("/runs/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    if (!await services.runs.getById(id)) {
      return notFound(reply, "Run not found.");
    }
    try {
      return await services.durableRuntime.requestCancel(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to cancel run.";
      return reply.code(409).send({ error: message });
    }
  });

  fastify.post("/runs/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    if (!await services.runs.getById(id)) {
      return notFound(reply, "Run not found.");
    }
    try {
      return await services.durableRuntime.retry(id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to retry run.";
      return reply.code(409).send({ error: message });
    }
  });

  fastify.post("/runs", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    if (!isOneOf(body.type, RUN_TYPES)) {
      return badRequest(reply, "Run type is invalid.");
    }

    if (body.status !== undefined && !isOneOf(body.status, RUN_STATUSES)) {
      return badRequest(reply, "Run status is invalid.");
    }

    const input: CreateRunInput = {
      type: body.type,
      status: body.status,
      taskId: optionalStringField(body, "taskId"),
      agentId: optionalStringField(body, "agentId"),
      input: body.input,
    };

    return reply.code(201).send(await services.runs.create(input));
  });

  fastify.patch("/runs/:id/log", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const message = stringField(body, "message");
    if (!message) {
      return badRequest(reply, "Run log message is required.");
    }
    if (message.length > RUN_LOG_MESSAGE_MAX_LENGTH) {
      return badRequest(reply, `Run log message must be ${RUN_LOG_MESSAGE_MAX_LENGTH} characters or fewer.`);
    }

    if (body.level !== undefined && !isOneOf(body.level, RUN_LOG_LEVELS)) {
      return badRequest(reply, "Run log level is invalid.");
    }

    const input: AppendRunLogInput = {
      level: body.level,
      message,
    };

    const run = await services.runs.appendLog(id, input);
    return run ?? notFound(reply, "Run not found.");
  });

  fastify.patch("/runs/:id/complete", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const body = bodyRecord(request.body) ?? {};
    const reviewStatus = optionalStringField(body, "reviewStatus");
    if (reviewStatus !== undefined && !isOneOf(reviewStatus, RUN_REVIEW_STATUSES)) {
      return badRequest(reply, "Run review status is invalid.");
    }
    const input: CompleteRunInput = {
      output: body.output,
      summary: optionalStringField(body, "summary"),
      reviewStatus,
      deliverablePath: optionalStringField(body, "deliverablePath"),
    };

    const run = await services.runs.complete(id, input);
    return run ?? notFound(reply, "Run not found.");
  });

  fastify.patch("/runs/:id/review", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }
    if (!isOneOf(body.reviewStatus, RUN_REVIEW_STATUSES)) {
      return badRequest(reply, "Run review status is invalid.");
    }

    const input: UpdateRunReviewInput = {
      reviewStatus: body.reviewStatus,
    };

    try {
      const run = await services.runs.updateReviewStatus(id, input.reviewStatus);
      return run ?? notFound(reply, "Run not found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to update run review status.";
      return reply.code(409).send({ error: message });
    }
  });

  fastify.patch("/runs/:id/promote-deliverable", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }

    const run = await services.runs.promoteDeliverable(id);
    return run ?? notFound(reply, "Run not found.");
  });

  fastify.patch("/runs/:id/unlink-deliverable", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }

    const run = await services.runs.unlinkDeliverable(id);
    return run ?? notFound(reply, "Run not found.");
  });

  fastify.post("/runs/:id/capture-memory", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }

    const body = bodyRecord(request.body) ?? {};
    const input: CaptureRunMemoryInput = {
      summary: optionalStringField(body, "summary"),
    };

    try {
      const result = await services.runs.captureMemory(id, input);
      return result ? reply.code(201).send(result) : notFound(reply, "Run not found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to capture run memory.";
      return reply.code(409).send({ error: message });
    }
  });

  fastify.post("/runs/:id/curate-learning", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Run id is invalid.");
    }

    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }
    const role = stringField(body, "role");
    if (!role || !isOneOf(role, AGENT_ROLES)) {
      return badRequest(reply, "Role learning target is invalid.");
    }
    const lesson = stringField(body, "lesson");
    if (!lesson) {
      return badRequest(reply, "Role learning lesson is required.");
    }
    if (lesson.length > REVIEW_LEARNING_MAX_LENGTH) {
      return badRequest(
        reply,
        `Role learning lesson must be ${REVIEW_LEARNING_MAX_LENGTH} characters or fewer.`,
      );
    }
    const signal = optionalStringField(body, "signal");
    if (signal && !isOneOf(signal, REVIEW_LEARNING_SIGNALS)) {
      return badRequest(reply, "Role learning signal is invalid.");
    }
    const signalPath = optionalStringField(body, "signalPath");
    if (signalPath && signalPath.length > REVIEW_LEARNING_SIGNAL_PATH_MAX_LENGTH) {
      return badRequest(
        reply,
        `Role learning signal path must be ${REVIEW_LEARNING_SIGNAL_PATH_MAX_LENGTH} characters or fewer.`,
      );
    }

    const input: CurateRunLearningInput = {
      role,
      lesson,
      signal: signal as CurateRunLearningInput["signal"],
      signalPath,
    };
    try {
      const result = await services.runs.curateLearning(id, input);
      return result ? reply.code(201).send(result) : notFound(reply, "Run not found.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to curate role learning.";
      return reply.code(409).send({ error: message });
    }
  });
}
