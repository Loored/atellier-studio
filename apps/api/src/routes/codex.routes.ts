import { CODEX_WORKER_MODES, CODEX_WORKER_PROFILES } from "@atellier/shared";
import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import { badRequest, bodyRecord, isOneOf, isValidObjectId, notFound, stringField } from "./route-utils";

export async function codexRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.post("/codex/runs", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const goal = stringField(body, "goal");
    if (!goal) return badRequest(reply, "Goal is required.");
    if (!isOneOf(body.mode, CODEX_WORKER_MODES)) return badRequest(reply, "Codex worker mode is invalid.");
    if (!isOneOf(body.profile, CODEX_WORKER_PROFILES)) return badRequest(reply, "Codex worker profile is invalid.");
    const run = await services.codexWorkers.create({ goal, mode: body.mode, profile: body.profile });
    return reply.code(201).send(run);
  });

  fastify.get("/codex/runs/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const run = await services.codexWorkers.getById(id);
    return run ?? notFound(reply, "Codex worker run not found.");
  });

  fastify.post("/codex/runs/:id/plan", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const run = await services.codexWorkers.plan(id);
    return run ?? notFound(reply, "Codex worker run not found.");
  });

  fastify.post("/codex/runs/:id/approve-step", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const stepId = stringField(body, "stepId");
    if (!stepId) return badRequest(reply, "stepId is required.");
    const run = await services.codexWorkers.approveStep(id, stepId);
    return run ?? notFound(reply, "Codex worker run not found.");
  });

  fastify.post("/codex/runs/:id/execute-next", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const result = await services.codexWorkers.executeNext(id);
    if (!result) return notFound(reply, "Codex worker run not found.");
    if ("error" in result) return badRequest(reply, result.error);
    return result;
  });

  fastify.post("/codex/runs/:id/retry-step", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Request body must be an object.");
    const stepId = stringField(body, "stepId");
    if (!stepId) return badRequest(reply, "stepId is required.");
    const result = await services.codexWorkers.retryStep(id, stepId);
    if (!result) return notFound(reply, "Codex worker run not found.");
    if ("error" in result) return badRequest(reply, result.error);
    return result;
  });

  fastify.post("/codex/runs/:id/cancel", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const run = await services.codexWorkers.cancel(id);
    return run ?? notFound(reply, "Codex worker run not found.");
  });

  fastify.post("/codex/runs/:id/finalize", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!isValidObjectId(id)) return badRequest(reply, "Run id is invalid.");
    const body = bodyRecord(request.body) ?? {};
    const summary = stringField(body, "summary");
    const changedFiles = Array.isArray(body.changedFiles)
      ? body.changedFiles.filter((value): value is string => typeof value === "string")
      : undefined;
    const testEvidence = Array.isArray(body.testEvidence)
      ? body.testEvidence.filter((value): value is string => typeof value === "string")
      : undefined;
    const run = await services.codexWorkers.finalize(id, { summary, changedFiles, testEvidence });
    return run ?? notFound(reply, "Codex worker run not found.");
  });
}
