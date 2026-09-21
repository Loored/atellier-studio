import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import { ControlBundleRunNotFoundError } from "../services/control-bundle.service";
import { badRequest, bodyRecord, notFound, stringField } from "./route-utils";

export async function controlBundlesRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.post("/control-bundles", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body || typeof body.note !== "string" || !body.note.trim() || !body.modelProfiles || !body.limits || !Array.isArray(body.allowedTools)) {
      return badRequest(reply, "Control Bundle draft is invalid.");
    }
    const profiles = body.modelProfiles as Record<string, unknown>;
    const limits = body.limits as Record<string, unknown>;
    if (![
      "cheap",
      "standard",
      "deep",
    ].every((key) => typeof profiles[key] === "string") || ![
      "executionTimeoutMs",
      "maxRetries",
      "contextBytes",
    ].every((key) => Number.isInteger(limits[key]) && Number(limits[key]) > 0) || !body.allowedTools.every((tool) => typeof tool === "string")) {
      return badRequest(reply, "Control Bundle fields are invalid.");
    }
    try {
      return reply.code(201).send(await services.controlBundles.createBundle({
        modelProfiles: profiles as { cheap: string; standard: string; deep: string },
        limits: limits as { executionTimeoutMs: number; maxRetries: number; contextBytes: number },
        allowedTools: body.allowedTools as string[],
        note: body.note,
      }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to create Control Bundle.");
    }
  });

  fastify.get("/control-bundles", async () => ({ bundles: await services.controlBundles.listBundles() }));

  fastify.get("/control-bundles/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const bundle = await services.controlBundles.getBundle(id);
    return bundle ?? notFound(reply, "Control Bundle not found.");
  });

  fastify.post("/control-bundle-proposals", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) return badRequest(reply, "Proposal body is invalid.");
    const experimentId = stringField(body, "experimentId");
    const bundleId = stringField(body, "bundleId");
    const rationale = stringField(body, "rationale");
    if (!experimentId || !bundleId || !rationale || rationale.length > 2000) {
      return badRequest(reply, "Proposal fields are invalid.");
    }
    try {
      return reply.code(201).send(await services.controlBundles.createProposal({ experimentId, bundleId, rationale }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to create proposal.");
    }
  });

  fastify.post("/evaluation-experiments/:id/ledger-pairs", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const baseline = body && typeof body.baseline === "object" && body.baseline !== null ? body.baseline as Record<string, unknown> : undefined;
    const shadow = body && typeof body.shadow === "object" && body.shadow !== null ? body.shadow as Record<string, unknown> : undefined;
    const baselineRunId = baseline ? stringField(baseline, "runId") : undefined;
    const baselineEvaluationId = baseline ? stringField(baseline, "evaluationId") : undefined;
    const shadowRunId = shadow ? stringField(shadow, "runId") : undefined;
    const shadowEvaluationId = shadow ? stringField(shadow, "evaluationId") : undefined;
    if (!id || !baselineRunId || !baselineEvaluationId || !shadowRunId || !shadowEvaluationId) return badRequest(reply, "Experiment ID plus baseline and shadow receipt references are required.");
    try {
      return reply.code(201).send(await services.controlBundles.recordEvaluationLedgerEvidencePair({
        experimentId: id,
        baseline: { runId: baselineRunId, evaluationId: baselineEvaluationId },
        shadow: { runId: shadowRunId, evaluationId: shadowEvaluationId },
      }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to record paired Evaluation Ledger evidence.");
    }
  });

  fastify.get("/evaluation-experiments/:id/ledger-pairs", async (request) => {
    const { id } = request.params as { id: string };
    return { pairs: await services.controlBundles.listEvaluationLedgerEvidencePairs(id) };
  });

  fastify.get("/evaluation-ledger/pairs", async () => ({ pairs: await services.controlBundles.listAllEvaluationLedgerEvidencePairs() }));

  fastify.get("/evaluation-experiments/:id/ledger-comparison", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id) return badRequest(reply, "Experiment ID is required.");
    try {
      return await services.controlBundles.compareEvaluationLedgerEvidence(id);
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to compare paired Evaluation Ledger evidence.");
    }
  });

  fastify.get("/control-bundle-proposals", async () => ({ proposals: await services.controlBundles.listProposals() }));

  fastify.get("/control-bundle-proposals/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const proposal = await services.controlBundles.getProposal(id);
    return proposal ?? notFound(reply, "Control Bundle proposal not found.");
  });

  fastify.post("/control-bundle-proposals/:id/approval", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const note = body ? stringField(body, "note") : undefined;
    const expiresAt = body ? stringField(body, "expiresAt") : undefined;
    if (!id || !note || !expiresAt) return badRequest(reply, "Approval note and expiry are required.");
    try {
      return reply.code(201).send(await services.controlBundles.grantApproval({
        proposalId: id,
        scope: "control-bundle-canary",
        expiresAt,
        note,
      }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to grant approval.");
    }
  });

  fastify.get("/control-bundle-proposals/:id/approval", async (request, reply) => {
    const { id } = request.params as { id: string };
    if (!id) return badRequest(reply, "Proposal ID is required.");
    return services.controlBundles.verifyApproval(id);
  });

  fastify.get("/control-bundle-proposals/:id/approvals", async (request) => {
    const { id } = request.params as { id: string };
    return { approvals: await services.controlBundles.listApprovals(id) };
  });

  fastify.post("/control-bundle-proposals/:id/canary", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const samplePercent = body?.samplePercent === undefined ? undefined : Number(body.samplePercent);
    if (!id || !Number.isInteger(samplePercent)) return badRequest(reply, "Canary sample percent is required.");
    try {
      return reply.code(201).send(await services.controlBundles.planCanary({ proposalId: id, samplePercent: samplePercent! }));
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to plan canary.");
    }
  });

  fastify.post("/control-bundle-canaries/:id/rollback", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const reason = body ? stringField(body, "reason") : undefined;
    if (!id || !reason) return badRequest(reply, "Rollback reason is required.");
    try {
      return await services.controlBundles.rollbackCanary(id, reason);
    } catch (error) {
      return badRequest(reply, error instanceof Error ? error.message : "Unable to rollback canary.");
    }
  });

  fastify.get("/control-bundle-canaries", async () => ({ canaries: await services.controlBundles.listCanaries() }));

  fastify.get("/control-bundle-canaries/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const canary = await services.controlBundles.getCanary(id);
    return canary ?? notFound(reply, "Control Bundle canary not found.");
  });

  fastify.post("/runs/:id/control-budget", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = bodyRecord(request.body);
    const canaryId = body ? stringField(body, "canaryId") : undefined;
    if (!id || !canaryId) return badRequest(reply, "Run ID and Canary ID are required.");
    try {
      const receipt = await services.controlBundles.reserveCanaryExecutionBudget({ canaryId, runId: id });
      return reply.code(receipt.status === "blocked" ? 409 : 201).send(receipt);
    } catch (error) {
      if (error instanceof ControlBundleRunNotFoundError) return notFound(reply, error.message);
      return badRequest(reply, error instanceof Error ? error.message : "Unable to reserve execution budget.");
    }
  });

  fastify.get("/control-bundle-budget-receipts", async () => ({ receipts: await services.controlBundles.listExecutionBudgetReceipts() }));
}
