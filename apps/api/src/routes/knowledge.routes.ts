import type { FastifyInstance } from "fastify";
import type {
  KnowledgeFilterPresetCreateInput,
  KnowledgeGraphLayer,
  KnowledgeGraphNodeType,
  KnowledgeGraphQualityState,
  KnowledgeNodeAnnotationUpsertInput,
} from "@atellier/shared";
import type { AppServices } from "../services/app-services";
import { bodyRecord, optionalStringField, stringField } from "./route-utils";

export async function knowledgeRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/knowledge/graph", async () => services.knowledgeGraph.buildGraph());
  fastify.get("/knowledge/role-memory", async () => services.knowledgeGraph.buildRoleMemory());

  fastify.get("/knowledge/graph/snapshots", async () => ({
    snapshots: services.knowledgeGraph.listSnapshots(),
  }));

  fastify.get("/knowledge/graph/snapshots/:id", async (request, reply) => {
    const params = request.params as { id?: string };
    const id = typeof params.id === "string" ? decodeURIComponent(params.id) : "";
    if (!id) {
      return reply.code(400).send({ error: "Snapshot id is required." });
    }
    const snapshot = services.knowledgeGraph.getSnapshot(id);
    if (!snapshot) {
      return reply.code(404).send({ error: "Snapshot not found." });
    }
    return snapshot;
  });

  fastify.get("/knowledge/graph/diff", async (request, reply) => {
    const query = request.query as { base?: string; head?: string };
    const base = typeof query.base === "string" ? decodeURIComponent(query.base) : "";
    const head = typeof query.head === "string" ? decodeURIComponent(query.head) : "";
    if (!base || !head) {
      return reply.code(400).send({ error: "base and head snapshot ids are required." });
    }
    const diff = services.knowledgeGraph.buildSnapshotDiff(base, head);
    if (!diff) {
      return reply.code(404).send({ error: "Snapshot not found." });
    }
    return diff;
  });

  fastify.get("/knowledge/annotations", async () => ({
    annotations: await services.knowledgeGraph.listAnnotations(),
  }));

  fastify.post("/knowledge/annotations", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return reply.code(400).send({ error: "Request body must be an object." });
    }
    const nodeId = stringField(body, "nodeId");
    const note = stringField(body, "note");
    if (!nodeId || !note) {
      return reply.code(400).send({ error: "nodeId and note are required." });
    }
    const tagsRaw = Array.isArray(body.tags) ? body.tags : [];
    const tags = tagsRaw.filter((tag): tag is string => typeof tag === "string");
    const input: KnowledgeNodeAnnotationUpsertInput = { nodeId, note, tags };
    try {
      return reply.code(201).send(await services.knowledgeGraph.upsertAnnotation(input));
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Annotation failed." });
    }
  });

  fastify.get("/knowledge/filter-presets", async () => ({
    presets: await services.knowledgeGraph.listFilterPresets(),
  }));

  fastify.post("/knowledge/filter-presets", async (request, reply) => {
    const body = bodyRecord(request.body);
    if (!body) {
      return reply.code(400).send({ error: "Request body must be an object." });
    }
    const name = stringField(body, "name");
    if (!name) {
      return reply.code(400).send({ error: "Preset name is required." });
    }
    const nodeTypeFilter = (optionalStringField(body, "nodeTypeFilter") ?? "all") as KnowledgeGraphNodeType | "all";
    const qualityFilter = (optionalStringField(body, "qualityFilter") ?? "all") as KnowledgeGraphQualityState | "all";
    const dreamDecisionFilter = (optionalStringField(body, "dreamDecisionFilter") ?? "all") as
      | "all"
      | "accepted"
      | "rejected"
      | "deferred";
    const densityMode = (optionalStringField(body, "densityMode") ?? "auto") as "auto" | "comfort" | "sparse";
    const activeLayersRaw = Array.isArray(body.activeLayers) ? body.activeLayers : [];
    const activeLayers = activeLayersRaw.filter((layer): layer is KnowledgeGraphLayer => typeof layer === "string");
    const input: KnowledgeFilterPresetCreateInput = {
      name,
      nodeTypeFilter,
      qualityFilter,
      activeLayers,
      dreamDecisionFilter,
      densityMode,
    };
    try {
      return reply.code(201).send(await services.knowledgeGraph.createFilterPreset(input));
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Preset creation failed." });
    }
  });
}
