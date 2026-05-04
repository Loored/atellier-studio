import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { createAppServices, type AppServices } from "./services/app-services";
import { type StorageMode } from "./services/service-utils";
import { agentsRoutes } from "./routes/agents.routes";
import { healthRoutes } from "./routes/health.routes";
import { runsRoutes } from "./routes/runs.routes";
import { tasksRoutes } from "./routes/tasks.routes";
import { wikiRoutes } from "./routes/wiki.routes";

export type BuildServerOptions = {
  storageMode?: StorageMode;
  atelierRoot?: string;
  logger?: boolean;
  services?: AppServices;
};

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({ logger: options.logger ?? false });
  const services = options.services ?? createAppServices(options);

  await services.wiki.ensureWiki();
  await fastify.register(cors, { origin: true });
  await fastify.register(healthRoutes);
  await fastify.register(async (instance) => agentsRoutes(instance, services));
  await fastify.register(async (instance) => tasksRoutes(instance, services));
  await fastify.register(async (instance) => runsRoutes(instance, services));
  await fastify.register(async (instance) => wikiRoutes(instance, services));

  return fastify;
}
