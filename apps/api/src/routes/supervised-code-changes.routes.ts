import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import {
  SupervisedCodeChangeNotFoundError,
  SupervisedCodeChangesDisabledError,
  SupervisedCodeChangeStateError,
} from "../services/supervised-code-change.service";
import { badRequest, bodyRecord, notFound, stringField } from "./route-utils";

export async function supervisedCodeChangesRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/supervised-code-changes", async () => ({ changes: await services.supervisedCodeChanges.list() }));

  fastify.get("/supervised-code-changes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const change = await services.supervisedCodeChanges.get(id);
    return change ?? notFound(reply, "Supervised code change not found.");
  });

  fastify.post("/supervised-code-changes/prepare", async (request, reply) => {
    const body = bodyRecord(request.body);
    const changeId = body ? stringField(body, "changeId") : undefined;
    if (!changeId) return badRequest(reply, "A workspace change id is required.");
    try {
      return reply.code(201).send(await services.supervisedCodeChanges.prepare(changeId));
    } catch (error) {
      return supervisedError(reply, error, "Unable to prepare supervised code change.");
    }
  });

  fastify.post("/supervised-code-changes/:id/verify", async (request, reply) => {
    const { id } = request.params as { id: string };
    const controller = new AbortController();
    const abort = () => controller.abort();
    request.raw.once("aborted", abort);
    try {
      return await services.supervisedCodeChanges.verify(id, controller.signal);
    } catch (error) {
      return supervisedError(reply, error, "Unable to verify supervised code change.");
    } finally {
      request.raw.off("aborted", abort);
    }
  });

  fastify.post("/supervised-code-changes/:id/discard", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await services.supervisedCodeChanges.discard(id);
    } catch (error) {
      return supervisedError(reply, error, "Unable to discard supervised code change.");
    }
  });
}

function supervisedError(reply: import("fastify").FastifyReply, error: unknown, fallback: string) {
  if (error instanceof SupervisedCodeChangeNotFoundError) return notFound(reply, error.message);
  if (error instanceof SupervisedCodeChangesDisabledError || error instanceof SupervisedCodeChangeStateError) {
    return reply.code(409).send({ error: error.message });
  }
  return badRequest(reply, error instanceof Error ? error.message : fallback);
}
