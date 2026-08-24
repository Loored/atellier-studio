import type { FastifyInstance } from "fastify";
import {
  EXECUTOR_MODES,
  ORCHESTRATION_CONTEXT_MAX_LENGTH,
  ORCHESTRATION_GOAL_MAX_LENGTH,
  ORCHESTRATION_SKILL_IDS,
  type ExecutorMode,
  type StartSkillOrchestrationInput,
  type StartSkillOrchestrationResponse,
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

export async function orchestrationsRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/orchestrations/skills", async () => services.skillOrchestrations.listSkills());

  fastify.get("/orchestrations/:runId/status", async (request, reply) => {
    const { runId } = request.params as { runId: string };
    if (!isValidObjectId(runId)) {
      return badRequest(reply, "Orchestration run id is invalid.");
    }
    const status = await services.skillOrchestrations.getStatus(runId);
    return status ?? notFound(reply, "Orchestration run not found.");
  });

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
    const executorModeOverrideRaw = optionalStringField(body, "executorModeOverride");
    if (executorModeOverrideRaw && !isOneOf(executorModeOverrideRaw, EXECUTOR_MODES)) {
      return badRequest(reply, "Executor mode override is invalid.");
    }
    const executorModeOverride = executorModeOverrideRaw as ExecutorMode | undefined;
    if (executorModeOverride && !services.executor.availableModes.includes(executorModeOverride)) {
      return badRequest(
        reply,
        `Executor mode '${executorModeOverride}' is not available in this API session.`,
      );
    }

    const input: StartSkillOrchestrationInput = {
      skillId,
      goal,
      context,
      taskId,
      executorModeOverride,
    };

    const result: StartSkillOrchestrationResponse = await services.durableRuntime.enqueueSkill(input);
    return reply.code(202).send(result);
  });
}
