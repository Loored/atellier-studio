import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import {
  ReversibleWorkspaceWritesDisabledError,
  WorkspaceChangeEffectIncompleteError,
  WorkspaceChangeNotFoundError,
  WorkspaceChangeRollbackHandleError,
  WorkspaceChangeVerificationRequiredError,
} from "../services/workspace-change.service";
import { badRequest, bodyRecord, isOneOf, notFound, stringField } from "./route-utils";

export async function workspaceChangesRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/workspace-changes", async () => ({ changes: await services.workspaceChanges.list() }));

  fastify.get("/workspace-changes/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const change = await services.workspaceChanges.get(id);
    return change ?? notFound(reply, "Workspace preview not found.");
  });

  fastify.get("/workspace-changes/:id/approvals", async (request) => {
    const { id } = request.params as { id: string };
    return { approvals: await services.workspaceChanges.approvals(id) };
  });

  fastify.get("/workspace-changes/:id/verifications", async (request) => {
    const { id } = request.params as { id: string };
    return { verifications: await services.workspaceChanges.verifications(id) };
  });

  fastify.post("/workspace-changes/preview", async (request, reply) => {
    const body = bodyRecord(request.body);
    const path = body ? stringField(body, "path") : undefined;
    if (!body || !path || typeof body.before !== "string" || typeof body.after !== "string") {
      return badRequest(reply, "Preview path, before, and after are required.");
    }
    try {
      return reply.code(201).send(await services.workspaceChanges.createPreview({ path, before: body.before, after: body.after }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to create workspace preview.");
    }
  });

  fastify.post("/workspace-changes/:id/approval", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const note = body ? stringField(body, "note") : undefined;
    const expiresAt = body ? stringField(body, "expiresAt") : undefined;
    if (!id || !note || !expiresAt) return badRequest(reply, "Approval note and expiry are required.");
    try {
      return reply.code(201).send(await services.workspaceChanges.approve({ changeId: id, note, expiresAt }));
    } catch (error) {
      if (error instanceof WorkspaceChangeNotFoundError) return notFound(reply, error.message);
      return badRequest(reply, error instanceof Error ? error.message : "Unable to approve workspace change.");
    }
  });

  fastify.post("/workspace-changes/:id/verification", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const commandLabel = body ? stringField(body, "commandLabel") : undefined;
    const summary = body ? stringField(body, "summary") : undefined;
    if (!id || !summary || !commandLabel || !isOneOf(commandLabel, ["api-typecheck", "web-typecheck", "focused-tests"] as const) || typeof body?.passed !== "boolean") {
      return badRequest(reply, "Code verification is invalid.");
    }
    try {
      return reply.code(201).send(await services.workspaceChanges.recordCodeVerification({
        changeId: id,
        commandLabel,
        passed: body.passed,
        summary,
      }));
    } catch (error) {
      if (error instanceof WorkspaceChangeNotFoundError) return notFound(reply, error.message);
      if (error instanceof WorkspaceChangeVerificationRequiredError) return reply.code(409).send({ error: error.message });
      return badRequest(reply, error instanceof Error ? error.message : "Unable to record code verification.");
    }
  });

  fastify.post("/workspace-changes/:id/apply", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await services.workspaceChanges.apply(id);
    } catch (error) {
      if (error instanceof WorkspaceChangeNotFoundError) return notFound(reply, error.message);
      if (error instanceof ReversibleWorkspaceWritesDisabledError || error instanceof WorkspaceChangeVerificationRequiredError || error instanceof WorkspaceChangeEffectIncompleteError) {
        return reply.code(409).send({ error: error.message });
      }
      return badRequest(reply, error instanceof Error ? error.message : "Unable to apply workspace change.");
    }
  });

  fastify.post("/workspace-changes/:id/rollback", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const rollbackHandle = body ? stringField(body, "rollbackHandle") : undefined;
    if (!rollbackHandle) return badRequest(reply, "A rollback handle is required.");
    try {
      return await services.workspaceChanges.rollback({ changeId: id, rollbackHandle });
    } catch (error) {
      if (error instanceof WorkspaceChangeNotFoundError) return notFound(reply, error.message);
      if (error instanceof ReversibleWorkspaceWritesDisabledError || error instanceof WorkspaceChangeRollbackHandleError || error instanceof WorkspaceChangeEffectIncompleteError) return reply.code(409).send({ error: error.message });
      return badRequest(reply, error instanceof Error ? error.message : "Unable to rollback workspace change.");
    }
  });
}
