import cors from "@fastify/cors";
import Fastify, { type FastifyInstance } from "fastify";
import { createAppServices, type AppServices, type CreateAppServicesOptions } from "./services/app-services";
import { type StorageMode } from "./services/service-utils";
import type { ModelProfile } from "@atellier/shared";
import { agentsRoutes } from "./routes/agents.routes";
import { healthRoutes } from "./routes/health.routes";
import { isAllowedLocalOrigin } from "./routes/route-utils";
import { orchestrationsRoutes } from "./routes/orchestrations.routes";
import { runsRoutes } from "./routes/runs.routes";
import { tasksRoutes } from "./routes/tasks.routes";
import { wikiRoutes } from "./routes/wiki.routes";
import { codexRoutes } from "./routes/codex.routes";
import { knowledgeRoutes } from "./routes/knowledge.routes";

export type BuildServerOptions = {
  storageMode?: StorageMode;
  atelierRoot?: string;
  logger?: boolean;
  services?: AppServices;
} & Pick<
  CreateAppServicesOptions,
  | "agentExecutorMode"
  | "openaiApiKey"
  | "openaiModel"
  | "openaiModelProfile"
  | "anthropicApiKey"
  | "anthropicModel"
  | "anthropicModelProfile"
  | "groqApiKey"
  | "groqModel"
  | "groqModelProfile"
  | "ollamaBaseUrl"
  | "ollamaModel"
  | "ollamaModelProfile"
  | "ollamaModelByProfile"
  | "ollamaModelByRole"
  | "maxHandoffDepth"
  | "executionTimeoutMs"
  | "seedDemoData"
  | "inlineDurableRuntime"
  | "runtimeLeaseMs"
  | "runtimePollMs"
  | "codexWorkerRealEnabled"
  | "codexWorkerTimeoutMs"
  | "codexWorkerMaxOutputBytes"
  | "codexWorkerAllowedWorkingDirectories"
>;

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const fastify = Fastify({
    bodyLimit: 1024 * 1024,
    logger: options.logger ?? false,
  });
  const services = options.services ?? await createAppServices(options);

  await services.wiki.ensureWiki();
  await services.knowledgeGraph.initialize();
  services.knowledgeLive.attach(fastify.server);
  fastify.addHook("onClose", async () => {
    await services.durableRuntime.stop();
  });
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
  const agentExecutorMode = options.agentExecutorMode ?? "mock";
  const executorModel =
    agentExecutorMode === "anthropic"
      ? options.anthropicModel ?? "claude-opus-4-7"
      : agentExecutorMode === "openai"
        ? options.openaiModel ?? "gpt-4.1-mini"
        : agentExecutorMode === "groq"
          ? options.groqModel ?? "llama-3.3-70b-versatile"
          : agentExecutorMode === "ollama"
            ? options.ollamaModel ?? "llama3.2"
            : "mock";
  const modelProfile =
    agentExecutorMode === "anthropic"
      ? options.anthropicModelProfile ?? "standard"
      : agentExecutorMode === "groq"
        ? options.groqModelProfile ?? "standard"
        : agentExecutorMode === "ollama"
          ? options.ollamaModelProfile ?? "standard"
          : options.openaiModelProfile ?? "standard";

  // Per-role overrides only apply when ollama is the active executor; for any
  // other mode we report no overrides regardless of what the env declares,
  // which matches the runtime behavior in app-services.
  const executorRoleOverrides =
    agentExecutorMode === "ollama" && options.ollamaModelByRole
      ? Object.fromEntries(
          Object.entries(options.ollamaModelByRole).filter(([, model]) => Boolean(model)),
        )
      : undefined;

  await fastify.register(async (instance) =>
    healthRoutes(instance, services, {
      storageMode: options.storageMode ?? "mongo",
      agentExecutorMode,
      executorModel,
      modelProfile,
      executorRoleOverrides:
        executorRoleOverrides && Object.keys(executorRoleOverrides).length > 0
          ? executorRoleOverrides
          : undefined,
    }),
  );
  await fastify.register(async (instance) => agentsRoutes(instance, services));
  await fastify.register(async (instance) => orchestrationsRoutes(instance, services));
  await fastify.register(async (instance) => tasksRoutes(instance, services));
  await fastify.register(async (instance) => runsRoutes(instance, services));
  await fastify.register(async (instance) => wikiRoutes(instance, services));
  await fastify.register(async (instance) => codexRoutes(instance, services));
  await fastify.register(async (instance) => knowledgeRoutes(instance, services));

  return fastify;
}
