import type { FastifyInstance } from "fastify";
import {
  ORCHESTRATION_CONTEXT_MAX_LENGTH,
  ORCHESTRATION_GOAL_MAX_LENGTH,
  ORCHESTRATION_SKILL_IDS,
  type StartSkillOrchestrationInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import {
  badRequest,
  bodyRecord,
  isOneOf,
  isValidObjectId,
  optionalStringField,
  stringField,
} from "./route-utils";

export async function orchestrationsRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/orchestrations/skills", async () => services.skillOrchestrations.listSkills());

  fastify.post("/orchestrations/skills/:skillId/run", async (request, reply) => {
    const { skillId } = request.params as { skillId: string };
    if (!isOneOf(skillId, ORCHESTRATION_SKILL_IDS)) {
      return badRequest(reply, "Orchestration skill is invalid.");
    }

    const body = bodyRecord(request.body);
    if (!body) {
      return badRequest(reply, "Request body must be an object.");
    }

    const goal = stringField(body, "goal");
    if (!goal) {
      return badRequest(reply, "Orchestration goal is required.");
    }
    if (goal.length > ORCHESTRATION_GOAL_MAX_LENGTH) {
      return badRequest(reply, `Goal must be ${ORCHESTRATION_GOAL_MAX_LENGTH} characters or fewer.`);
    }

    const context = optionalStringField(body, "context");
    if (context && context.length > ORCHESTRATION_CONTEXT_MAX_LENGTH) {
      return badRequest(reply, `Context must be ${ORCHESTRATION_CONTEXT_MAX_LENGTH} characters or fewer.`);
    }

    const taskId = optionalStringField(body, "taskId");
    if (taskId && !isValidObjectId(taskId)) {
      return badRequest(reply, "Task id is invalid.");
    }

    const input: StartSkillOrchestrationInput = {
      skillId,
      goal,
      context,
      taskId,
    };

    return reply.code(201).send(await services.skillOrchestrations.start(input));
  });
}
