import type { FastifyInstance } from "fastify";
import {
  AGENT_INSTRUCTION_MAX_LENGTH,
  AGENT_MESSAGE_MAX_LENGTH,
  AGENT_ROLES,
  AGENT_STATUSES,
  type AgentRunStreamEvent,
  type CreateAgentInput,
  type RunAgentInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import {
  badRequest,
  bodyRecord,
  isOneOf,
  isAllowedLocalOrigin,
  isValidObjectId,
  notFound,
  optionalStringField,
  stringField,
} from "./route-utils";

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
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Agent id is invalid.");
    }
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

  fastify.get("/agents/:id/messages", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Agent id is invalid.");
    }
    const agent = await services.agents.getById(id);
    if (!agent) {
      return notFound(reply, "Agent not found.");
    }

    return services.messages.listByAgent(id);
  });

  fastify.post("/agents/:id/run", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Agent id is invalid.");
    }
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const instruction = stringField(body, "instruction");
    if (!instruction) {
      return badRequest(reply, "Instruction is required.");
    }
    if (instruction.length > AGENT_INSTRUCTION_MAX_LENGTH) {
      return badRequest(reply, `Instruction must be ${AGENT_INSTRUCTION_MAX_LENGTH} characters or fewer.`);
    }

    const context = optionalStringField(body, "context");
    if (context && context.length > AGENT_MESSAGE_MAX_LENGTH) {
      return badRequest(reply, `Context must be ${AGENT_MESSAGE_MAX_LENGTH} characters or fewer.`);
    }
    const handoffInstruction = optionalStringField(body, "handoffInstruction");
    if (handoffInstruction && handoffInstruction.length > AGENT_MESSAGE_MAX_LENGTH) {
      return badRequest(reply, `Handoff instruction must be ${AGENT_MESSAGE_MAX_LENGTH} characters or fewer.`);
    }
    const handoffAgentId = optionalStringField(body, "handoffAgentId");

    const input: RunAgentInput = {
      instruction,
      context,
      handoffAgentId,
      handoffInstruction,
    };

    const result = await services.agentRuns.run(id, input);
    return result ?? notFound(reply, "Agent not found.");
  });

  fastify.post("/agents/:id/run/stream", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) {
      return badRequest(reply, "Agent id is invalid.");
    }
    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const instruction = stringField(body, "instruction");
    if (!instruction) {
      return badRequest(reply, "Instruction is required.");
    }
    if (instruction.length > AGENT_INSTRUCTION_MAX_LENGTH) {
      return badRequest(reply, `Instruction must be ${AGENT_INSTRUCTION_MAX_LENGTH} characters or fewer.`);
    }

    const context = optionalStringField(body, "context");
    if (context && context.length > AGENT_MESSAGE_MAX_LENGTH) {
      return badRequest(reply, `Context must be ${AGENT_MESSAGE_MAX_LENGTH} characters or fewer.`);
    }
    const handoffInstruction = optionalStringField(body, "handoffInstruction");
    if (handoffInstruction && handoffInstruction.length > AGENT_MESSAGE_MAX_LENGTH) {
      return badRequest(reply, `Handoff instruction must be ${AGENT_MESSAGE_MAX_LENGTH} characters or fewer.`);
    }
    const handoffAgentId = optionalStringField(body, "handoffAgentId");

    const input: RunAgentInput = {
      instruction,
      context,
      handoffAgentId,
      handoffInstruction,
    };

    const agent = await services.agents.getById(id);
    if (!agent) {
      return notFound(reply, "Agent not found.");
    }

    const requestOrigin = request.headers.origin;
    if (requestOrigin && isAllowedLocalOrigin(requestOrigin)) {
      reply.raw.setHeader("Access-Control-Allow-Origin", requestOrigin);
      reply.raw.setHeader("Vary", "Origin");
    }

    reply.raw.statusCode = 200;
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");
    reply.raw.flushHeaders?.();

    const emit = (event: AgentRunStreamEvent) => {
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    };

    try {
      const result = await services.agentRuns.runWithStream(id, input, emit);
      if (!result) {
        emit({ type: "error", message: "Agent not found." });
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown execution error.";
      emit({ type: "error", message });
    } finally {
      reply.raw.end();
    }
  });
}
