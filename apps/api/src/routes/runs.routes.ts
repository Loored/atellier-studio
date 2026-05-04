import type { FastifyInstance } from "fastify";
import {
  RUN_LOG_LEVELS,
  RUN_STATUSES,
  RUN_TYPES,
  type AppendRunLogInput,
  type CompleteRunInput,
  type CreateRunInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, isOneOf, notFound, optionalStringField, stringField } from "./route-utils";

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
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const message = stringField(body, "message");
    if (!message) {
      return badRequest(reply, "Run log message is required.");
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
    const body = bodyRecord(request.body) ?? {};
    const input: CompleteRunInput = {
      output: body.output,
      summary: optionalStringField(body, "summary"),
    };

    const run = await services.runs.complete(id, input);
    return run ?? notFound(reply, "Run not found.");
  });
}
