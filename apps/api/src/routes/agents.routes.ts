import type { FastifyInstance } from "fastify";
import { AGENT_ROLES, AGENT_STATUSES, type CreateAgentInput } from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, isOneOf, notFound, optionalStringField, stringField } from "./route-utils";

export async function agentsRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/agents", async () => services.agents.list());

  fastify.post("/agents", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const name = stringField(body, "name");
    if (!name) {
      return badRequest(reply, "Agent name is required.");
    }

    if (!isOneOf(body.role, AGENT_ROLES)) {
      return badRequest(reply, "Agent role is invalid.");
    }

    if (body.status !== undefined && !isOneOf(body.status, AGENT_STATUSES)) {
      return badRequest(reply, "Agent status is invalid.");
    }

    const input: CreateAgentInput = {
      name,
      role: body.role,
      status: body.status,
      currentTaskId: optionalStringField(body, "currentTaskId"),
      lastRunId: optionalStringField(body, "lastRunId"),
    };

    return reply.code(201).send(await services.agents.create(input));
  });

  fastify.patch("/agents/:id/status", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    if (!isOneOf(body.status, AGENT_STATUSES)) {
      return badRequest(reply, "Agent status is invalid.");
    }

    const agent = await services.agents.updateStatus(id, {
      status: body.status,
      currentTaskId: optionalStringField(body, "currentTaskId"),
      lastRunId: optionalStringField(body, "lastRunId"),
    });

    return agent ?? notFound(reply, "Agent not found.");
  });
}
