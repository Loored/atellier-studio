import type { AgentRole, ModelProfile } from "@atellier/shared";
import type { AgentExecutorMode } from "./services/agent-executor.service";
import type { CreateAppServicesOptions } from "./services/app-services";
import type { StorageMode } from "./services/service-utils";

export type RuntimeEnvironmentConfig = {
  port: number;
  host: string;
  mongoUri: string;
  storageMode: StorageMode;
  logger: boolean;
  serviceOptions: CreateAppServicesOptions;
};

function parseModelProfile(raw: string | undefined): ModelProfile {
  return raw === "cheap" ? "cheap" : raw === "deep" ? "deep" : "standard";
}

function resolveExecutorMode(): AgentExecutorMode {
  const explicit = process.env.AGENT_EXECUTOR_MODE;
  if (["mock", "openai", "anthropic", "groq", "ollama"].includes(explicit ?? "")) {
    return explicit as AgentExecutorMode;
  }
  return process.env.OPENAI_API_KEY ? "openai" : "mock";
}

function readOllamaRoleOverrides(): Partial<Record<AgentRole, string>> | undefined {
  const names: Record<AgentRole, string> = {
    intake: "OLLAMA_MODEL_INTAKE",
    "wiki-curator": "OLLAMA_MODEL_WIKI_CURATOR",
    pm: "OLLAMA_MODEL_PM",
    builder: "OLLAMA_MODEL_BUILDER",
    qa: "OLLAMA_MODEL_QA",
    designer: "OLLAMA_MODEL_DESIGNER",
  };
  const overrides: Partial<Record<AgentRole, string>> = {};
  for (const [role, envName] of Object.entries(names) as Array<[AgentRole, string]>) {
    const value = process.env[envName]?.trim();
    if (value) overrides[role] = value;
  }
  return Object.keys(overrides).length > 0 ? overrides : undefined;
}

export function readRuntimeConfig(): RuntimeEnvironmentConfig {
  const storageMode: StorageMode = process.env.API_STORAGE === "memory" ? "memory" : "mongo";
  const agentExecutorMode = resolveExecutorMode();
  return {
    port: Number(process.env.API_PORT ?? 4000),
    host: process.env.API_HOST ?? "127.0.0.1",
    mongoUri: process.env.MONGO_URI ?? "mongodb://localhost:27017/atellier_studio",
    storageMode,
    logger: process.env.NODE_ENV !== "test",
    serviceOptions: {
      atelierRoot: process.env.ATELLIER_ROOT,
      storageMode,
      agentExecutorMode,
      openaiApiKey: process.env.OPENAI_API_KEY,
      openaiModel: process.env.OPENAI_MODEL,
      openaiModelProfile: parseModelProfile(process.env.OPENAI_MODEL_PROFILE),
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      anthropicModel: process.env.ANTHROPIC_MODEL,
      anthropicModelProfile: parseModelProfile(process.env.ANTHROPIC_MODEL_PROFILE),
      groqApiKey: process.env.GROQ_API_KEY,
      groqModel: process.env.GROQ_MODEL,
      groqModelProfile: parseModelProfile(process.env.GROQ_MODEL_PROFILE),
      ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
      ollamaModel: process.env.OLLAMA_MODEL,
      ollamaModelProfile: parseModelProfile(process.env.OLLAMA_MODEL_PROFILE),
      ollamaModelByRole: readOllamaRoleOverrides(),
      maxHandoffDepth: Number(process.env.AGENT_MAX_HANDOFF_DEPTH ?? 1),
      executionTimeoutMs: Number(process.env.AGENT_EXECUTION_TIMEOUT_MS ?? 45_000),
      runtimeLeaseMs: Number(process.env.RUN_WORKER_LEASE_MS ?? 30_000),
      runtimePollMs: Number(process.env.RUN_WORKER_POLL_MS ?? 1_000),
      seedDemoData: storageMode === "memory" && process.env.SEED_DEMO_DATA !== "false",
    },
  };
}

export function assertRuntimeExecutorConfig(config: RuntimeEnvironmentConfig): void {
  const mode = config.serviceOptions.agentExecutorMode ?? "mock";
  if (process.env.NODE_ENV === "test" || mode === "mock") return;
  const requirements: Partial<Record<AgentExecutorMode, { value?: string; message: string }>> = {
    openai: { value: config.serviceOptions.openaiApiKey, message: "OPENAI_API_KEY is required when AGENT_EXECUTOR_MODE=openai." },
    anthropic: { value: config.serviceOptions.anthropicApiKey, message: "ANTHROPIC_API_KEY is required when AGENT_EXECUTOR_MODE=anthropic." },
    groq: { value: config.serviceOptions.groqApiKey, message: "GROQ_API_KEY is required when AGENT_EXECUTOR_MODE=groq." },
    ollama: { value: config.serviceOptions.ollamaModel, message: "OLLAMA_MODEL is required when AGENT_EXECUTOR_MODE=ollama." },
  };
  const requirement = requirements[mode];
  if (requirement && !requirement.value) {
    throw new Error(`[atellier-runtime] ${requirement.message}`);
  }
}
