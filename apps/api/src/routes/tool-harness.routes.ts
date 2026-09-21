import { AGENT_ROLES, type InvokeToolInput, type ToolPolicyRequest } from "@atellier/shared";
import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, isOneOf, isValidObjectId, notFound, stringField } from "./route-utils";
import { ToolHarnessParentRunNotFoundError } from "../services/tool-harness.service";

export async function toolHarnessRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/tool-harness/catalog", async () => services.toolHarness.listCatalog());

  fastify.post("/tool-harness/policy-check", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const toolName = stringField(body, "toolName");
    if (!toolName || !isOneOf(body.agentRole, AGENT_ROLES)) {
      return badRequest(reply, "A registered toolName and valid agentRole are required.");
    }
    const input: ToolPolicyRequest = { toolName, agentRole: body.agentRole };
    return services.toolHarness.evaluatePolicy(input);
  });

  fastify.post("/tool-harness/invoke", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const parentRunId = stringField(body, "parentRunId");
    const toolName = stringField(body, "toolName");
    const input = body.input;
    if (!parentRunId || !isValidObjectId(parentRunId) || !toolName || !isOneOf(body.agentRole, AGENT_ROLES)) {
      return badRequest(reply, "A valid parentRunId, toolName, and agentRole are required.");
    }
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return badRequest(reply, "Tool input must be an object.");
    }
    try {
      const invocation: InvokeToolInput = {
        parentRunId,
        toolName,
        agentRole: body.agentRole,
        input: input as Record<string, unknown>,
      };
      return await services.toolHarness.invoke(invocation);
    } catch (error) {
      if (error instanceof ToolHarnessParentRunNotFoundError) return notFound(reply, error.message);
      return badRequest(reply, error instanceof Error ? error.message : "Tool invocation failed.");
    }
  });
}
