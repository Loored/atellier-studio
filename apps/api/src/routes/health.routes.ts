import type { FastifyInstance } from "fastify";
import type { AppServices } from "../services/app-services";
import type { AgentExecutorMode } from "../services/agent-executor.service";
import type { StorageMode } from "../services/service-utils";
import type { ModelProfile } from "@atellier/shared";
import mongoose from "mongoose";

const MONGO_STATE_LABELS: Record<number, string> = {
  0: "disconnected",
  1: "connected",
  2: "connecting",
  3: "disconnecting",
};

export async function healthRoutes(
  fastify: FastifyInstance,
  services: AppServices,
  options: {
    storageMode: StorageMode;
    agentExecutorMode: AgentExecutorMode;
    executorModel: string;
    modelProfile: ModelProfile;
    /** Per-agent-role model overrides (currently Ollama-only). Omit when empty. */
    executorRoleOverrides?: Record<string, string>;
  },
): Promise<void> {
  fastify.get("/health", async () => {
    const [agents, runs] = await Promise.all([services.agents.list(), services.runs.list()]);
    const activeRuns = runs.filter((run) => run.status === "queued" || run.status === "running").length;
    const waitingAgents = agents.filter((agent) => agent.status === "needs-human").length;
    const memory = process.memoryUsage();
    const mongoState = MONGO_STATE_LABELS[mongoose.connection.readyState] ?? "unknown";

    return {
      status: "ok",
      service: "atellier-api",
      storageMode: options.storageMode,
      executorMode: options.agentExecutorMode,
      executorModel: options.executorModel,
      modelProfile: options.modelProfile,
      ...(options.executorRoleOverrides
        ? { executorRoleOverrides: options.executorRoleOverrides }
        : {}),
      mongo: {
        connected: mongoose.connection.readyState === 1,
        state: mongoState,
      },
      metrics: {
        agentsTotal: agents.length,
        waitingAgents,
        activeRuns,
      },
      memory: {
        rssBytes: memory.rss,
        heapUsedBytes: memory.heapUsed,
      },
    };
  });
}
