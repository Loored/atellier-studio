import {
  createAgentExecutorService,
  type AgentExecutorMode,
} from "./agent-executor.service";
import type { ModelProfile } from "@atellier/shared";
import { AgentRunService } from "./agent-run.service";
import path from "node:path";
import { AgentService } from "./agent.service";
import { MessageService } from "./message.service";
import { RunService } from "./run.service";
import { SkillOrchestrationService } from "./skill-orchestration.service";
import { TaskService } from "./task.service";
import { WikiService } from "./wiki.service";
import { type StorageMode } from "./service-utils";
import { CodexWorkerService } from "./codex-worker.service";
import { readdir } from "node:fs/promises";

export type AppServices = {
  agents: AgentService;
  agentRuns: AgentRunService;
  messages: MessageService;
  tasks: TaskService;
  runs: RunService;
  skillOrchestrations: SkillOrchestrationService;
  wiki: WikiService;
  codexWorkers: CodexWorkerService;
};

export type CreateAppServicesOptions = {
  storageMode?: StorageMode;
  atelierRoot?: string;
  agentExecutorMode?: AgentExecutorMode;
  openaiApiKey?: string;
  openaiModel?: string;
  openaiModelProfile?: ModelProfile;
  anthropicApiKey?: string;
  anthropicModel?: string;
  anthropicModelProfile?: ModelProfile;
  groqApiKey?: string;
  groqModel?: string;
  groqModelProfile?: ModelProfile;
  ollamaBaseUrl?: string;
  ollamaModel?: string;
  ollamaModelProfile?: ModelProfile;
  maxHandoffDepth?: number;
  executionTimeoutMs?: number;
};

export function resolveAtellierRoot(input?: string): string {
  if (input) {
    return path.resolve(process.cwd(), input);
  }

  return path.resolve(process.cwd(), "../../atelier");
}

async function listVerifiedRepoFiles(repoRoot: string, relativeDir: string): Promise<string[]> {
  const root = path.join(repoRoot, relativeDir);
  try {
    const files: string[] = [];
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const childRelativePath = path.posix.join(relativeDir, entry.name);
      if (entry.isFile()) {
        files.push(childRelativePath);
      } else if (entry.isDirectory()) {
        files.push(...(await listVerifiedRepoFiles(repoRoot, childRelativePath)));
      }
    }
    return files.sort();
  } catch {
    return [];
  }
}

export async function createAppServices(options: CreateAppServicesOptions = {}): Promise<AppServices> {
  const storageMode = options.storageMode ?? "mongo";
  const atelierRootResolved = resolveAtellierRoot(options.atelierRoot);
  const repoRootResolved = path.resolve(atelierRootResolved, "..");
  const wiki = new WikiService(atelierRootResolved);
  const agents = new AgentService(storageMode);
  const runs = new RunService(storageMode, wiki);
  const messages = new MessageService(storageMode);
  const repoFileHints = [
    ...(await listVerifiedRepoFiles(repoRootResolved, "apps/web/src/features/wiki")),
    ...(await listVerifiedRepoFiles(repoRootResolved, "apps/api/src/services")),
  ];
  const executorMode: AgentExecutorMode = options.agentExecutorMode
    ?? (options.openaiApiKey ? "openai" : "mock");
  const executor = createAgentExecutorService({
    mode: executorMode,
    openai: options.openaiApiKey
      ? {
          apiKey: options.openaiApiKey,
          model: options.openaiModel ?? "gpt-4.1-mini",
        }
      : undefined,
    anthropic: options.anthropicApiKey
      ? {
          apiKey: options.anthropicApiKey,
          model: options.anthropicModel ?? "claude-opus-4-7",
        }
      : undefined,
    groq: options.groqApiKey
      ? {
          apiKey: options.groqApiKey,
          model: options.groqModel ?? "llama-3.3-70b-versatile",
        }
      : undefined,
    ollama: options.ollamaModel
      ? {
          baseUrl: options.ollamaBaseUrl,
          model: options.ollamaModel,
        }
      : undefined,
    repoFileHints,
  });
  const agentRuns = new AgentRunService(agents, runs, messages, executor, {
    maxHandoffDepth: options.maxHandoffDepth,
    executionTimeoutMs: options.executionTimeoutMs,
    verifiedRepoFiles: repoFileHints,
  });

  return {
    agents,
    agentRuns,
    messages,
    tasks: new TaskService(storageMode),
    runs,
    skillOrchestrations: new SkillOrchestrationService(agents, agentRuns, runs),
    wiki,
    codexWorkers: new CodexWorkerService(runs, wiki, atelierRootResolved),
  };
}
