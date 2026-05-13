import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";

export async function knowledgeRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/knowledge/graph", async () => services.knowledgeGraph.buildGraph());

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
}
