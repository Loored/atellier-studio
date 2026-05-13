import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";

export async function knowledgeRoutes(fastify: FastifyInstance, services: AppServices): Promise<void> {
  fastify.get("/knowledge/graph", async () => services.knowledgeGraph.buildGraph());
}
