import "dotenv/config";
import { buildServer } from "./server";
import { connectMongo } from "./db/mongo";
import type { StorageMode } from "./services/service-utils";
import type { AgentExecutorMode } from "./services/agent-executor.service";
import type { AgentRole, ModelProfile } from "@atellier/shared";
import type { AddressInfo } from "node:net";

const port = Number(process.env.API_PORT ?? 4000);
const host = process.env.API_HOST ?? "127.0.0.1";
const mongoUri = process.env.MONGO_URI ?? "mongodb://localhost:27017/atellier_studio";
const storageMode: StorageMode = process.env.API_STORAGE === "memory" ? "memory" : "mongo";
const isTestEnv = process.env.NODE_ENV === "test";

const explicitExecutorMode = process.env.AGENT_EXECUTOR_MODE;
const agentExecutorMode: AgentExecutorMode =
  explicitExecutorMode === "mock"
    ? "mock"
    : explicitExecutorMode === "openai"
      ? "openai"
      : explicitExecutorMode === "anthropic"
        ? "anthropic"
        : explicitExecutorMode === "groq"
          ? "groq"
          : explicitExecutorMode === "ollama"
            ? "ollama"
            : process.env.OPENAI_API_KEY
              ? "openai"
              : "mock";
const requireRealExecutor = !isTestEnv && agentExecutorMode !== "mock";

const maxHandoffDepth = Number(process.env.AGENT_MAX_HANDOFF_DEPTH ?? 1);
const executionTimeoutMs = Number(process.env.AGENT_EXECUTION_TIMEOUT_MS ?? 45_000);

function parseModelProfile(raw: string | undefined): ModelProfile {
  return raw === "cheap" ? "cheap" : raw === "deep" ? "deep" : "standard";
}

const openaiModelProfile = parseModelProfile(process.env.OPENAI_MODEL_PROFILE);
const anthropicModelProfile = parseModelProfile(process.env.ANTHROPIC_MODEL_PROFILE);
const groqModelProfile = parseModelProfile(process.env.GROQ_MODEL_PROFILE);
const ollamaModelProfile = parseModelProfile(process.env.OLLAMA_MODEL_PROFILE);

// Per-agent-role Ollama model overrides. Only Ollama is wired for per-role
// routing in v1 (cost-free local provider, where experimenting with
// specialized models is cheap). Env names use snake_case for AgentRole values
// containing dashes — e.g. OLLAMA_MODEL_WIKI_CURATOR maps to "wiki-curator".
const OLLAMA_ROLE_ENV: Record<AgentRole, string> = {
  intake: "OLLAMA_MODEL_INTAKE",
  "wiki-curator": "OLLAMA_MODEL_WIKI_CURATOR",
  pm: "OLLAMA_MODEL_PM",
  builder: "OLLAMA_MODEL_BUILDER",
  qa: "OLLAMA_MODEL_QA",
  designer: "OLLAMA_MODEL_DESIGNER",
};
const ollamaModelByRole: Partial<Record<AgentRole, string>> = {};
for (const [role, envName] of Object.entries(OLLAMA_ROLE_ENV) as Array<[AgentRole, string]>) {
  const value = process.env[envName]?.trim();
  if (value) ollamaModelByRole[role] = value;
}

type HealthPayload = {
  status?: string;
  service?: string;
};

async function isAtellierApiRunning(targetHost: string, targetPort: number): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(`http://${targetHost}:${targetPort}/health`, {
      method: "GET",
      signal: controller.signal,
    });
    if (!response.ok) {
      return false;
    }

    const payload = (await response.json()) as HealthPayload;
    return payload.status === "ok" && payload.service === "atellier-api";
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

async function main(): Promise<void> {
  if (requireRealExecutor) {
    if (agentExecutorMode === "openai" && !process.env.OPENAI_API_KEY) {
      throw new Error(
        "[atellier-api] OPENAI_API_KEY is required when AGENT_EXECUTOR_MODE=openai. " +
          "Set OPENAI_API_KEY or opt into mock mode with AGENT_EXECUTOR_MODE=mock.",
      );
    }
    if (agentExecutorMode === "anthropic" && !process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        "[atellier-api] ANTHROPIC_API_KEY is required when AGENT_EXECUTOR_MODE=anthropic. " +
          "Set ANTHROPIC_API_KEY or opt into mock mode with AGENT_EXECUTOR_MODE=mock.",
      );
    }
    if (agentExecutorMode === "groq" && !process.env.GROQ_API_KEY) {
      throw new Error(
        "[atellier-api] GROQ_API_KEY is required when AGENT_EXECUTOR_MODE=groq. " +
          "Get a free key at https://console.groq.com/keys.",
      );
    }
    if (agentExecutorMode === "ollama" && !process.env.OLLAMA_MODEL) {
      throw new Error(
        "[atellier-api] OLLAMA_MODEL is required when AGENT_EXECUTOR_MODE=ollama. " +
          "Pull a model first (e.g. `ollama pull llama3.2`) and set OLLAMA_MODEL=llama3.2.",
      );
    }
  }

  if (storageMode === "mongo") {
    await connectMongo(mongoUri);
  }

  const server = await buildServer({
    atelierRoot: process.env.ATELLIER_ROOT,
    logger: process.env.NODE_ENV !== "test",
    storageMode,
    agentExecutorMode,
    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiModel: process.env.OPENAI_MODEL,
    openaiModelProfile,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL,
    anthropicModelProfile,
    groqApiKey: process.env.GROQ_API_KEY,
    groqModel: process.env.GROQ_MODEL,
    groqModelProfile,
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
    ollamaModel: process.env.OLLAMA_MODEL,
    ollamaModelProfile,
    ollamaModelByRole: Object.keys(ollamaModelByRole).length > 0 ? ollamaModelByRole : undefined,
    maxHandoffDepth,
    executionTimeoutMs,
    seedDemoData: storageMode === "memory" && process.env.SEED_DEMO_DATA !== "false",
  });

  try {
    await server.listen({ port, host });
  } catch (error) {
    const listenError = error as NodeJS.ErrnoException;
    if (listenError.code !== "EADDRINUSE") {
      throw error;
    }

    const existingApi = await isAtellierApiRunning(host, port);
    if (existingApi) {
      console.info(
        `[atellier-api] Port ${port} is already in use by another Atellier API instance on ${host}. Reusing that running backend.`,
      );
      return;
    }

    const hostWithPort = `${host}:${port}`;
    throw new Error(
      `[atellier-api] Port ${hostWithPort} is already in use by another process. Stop that process or run with API_PORT=<free-port>.\n` +
        `Tip: lsof -nP -iTCP:${port} -sTCP:LISTEN`,
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
