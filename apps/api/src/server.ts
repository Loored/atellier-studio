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

const LOCAL_CORS_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function isAllowedLocalOrigin(origin: string | undefined): boolean {
  if (!origin) {
    return true;
  }

  try {
    const parsedOrigin = new URL(origin);
    return ["http:", "https:"].includes(parsedOrigin.protocol) && LOCAL_CORS_HOSTS.has(parsedOrigin.hostname);
  } catch {
    return false;
  }
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    bodyLimit: 1024 * 1024,
    logger: options.logger ?? false,
  });
  const services = options.services ?? createAppServices(options);

  await services.wiki.ensureWiki();
  fastify.addHook("onRequest", async (_request, reply) => {
    reply.header("Referrer-Policy", "no-referrer");
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("X-Frame-Options", "DENY");
  });

  await fastify.register(cors, {
    origin: (origin, callback) => {
      callback(null, isAllowedLocalOrigin(origin));
    },
  });
  await fastify.register(healthRoutes);
  await fastify.register(async (instance) => agentsRoutes(instance, services));
  await fastify.register(async (instance) => tasksRoutes(instance, services));
  await fastify.register(async (instance) => runsRoutes(instance, services));
  await fastify.register(async (instance) => wikiRoutes(instance, services));

  return fastify;
}
