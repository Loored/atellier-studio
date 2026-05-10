import type { FastifyInstance } from "fastify";
import {
  RUN_LOG_LEVELS,
  RUN_LOG_MESSAGE_MAX_LENGTH,
  RUN_REVIEW_STATUSES,
  RUN_STATUSES,
  RUN_TYPES,
  type AppendRunLogInput,
  type CaptureRunMemoryInput,
  type CompleteRunInput,
  type CreateRunInput,
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
  fastify.get("/runs", async () => services.runs.list());

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
}
