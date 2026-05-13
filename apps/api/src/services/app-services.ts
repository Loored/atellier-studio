import {
  createAgentExecutorService,
  OllamaAgentExecutorService,
  RoleAwareAgentExecutorService,
  type AgentExecutorMode,
  type AgentExecutorService,
} from "./agent-executor.service";
import type { AgentRole, ModelProfile } from "@atellier/shared";
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
import { KnowledgeGraphService } from "./knowledge-graph.service";

export type AppServices = {
  agents: AgentService;
  agentRuns: AgentRunService;
  messages: MessageService;
  tasks: TaskService;
  runs: RunService;
  skillOrchestrations: SkillOrchestrationService;
  wiki: WikiService;
  codexWorkers: CodexWorkerService;
  knowledgeGraph: KnowledgeGraphService;
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
  /**
   * Optional per-agent-role Ollama model overrides. When present, agents with
   * the matching role use a dedicated Ollama executor pinned to this model;
   * unspecified roles fall back to the global executor.
   *
   * Use case: pin Builder/Toto Runtime to qwen2.5-coder:7b while keeping
   * llama3.1:8b for PM/QA/wiki-curator. Only Ollama supports per-role
   * overrides in v1 (the cost-free local provider is the right place to
   * experiment with specialized models).
   */
  ollamaModelByRole?: Partial<Record<AgentRole, string>>;
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
  const tasks = new TaskService(storageMode);
  const runs = new RunService(storageMode, wiki);
  const messages = new MessageService(storageMode);
  const repoFileHints = [
    ...(await listVerifiedRepoFiles(repoRootResolved, "apps/web/src/features/wiki")),
    ...(await listVerifiedRepoFiles(repoRootResolved, "apps/api/src/services")),
  ];
  const executorMode: AgentExecutorMode = options.agentExecutorMode
    ?? (options.openaiApiKey ? "openai" : "mock");
  const fallbackExecutor = createAgentExecutorService({
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

  // Per-role Ollama overrides only make sense when ollama is wired at all.
  // We accept overrides regardless of the active mode (they kick in if/when
  // the operator switches AGENT_EXECUTOR_MODE=ollama), but they're a no-op
  // for other modes today.
  const perRole: Partial<Record<AgentRole, AgentExecutorService>> = {};
  const roleOverrides = options.ollamaModelByRole ?? {};
  for (const [role, model] of Object.entries(roleOverrides)) {
    if (!model) continue;
    perRole[role as AgentRole] = new OllamaAgentExecutorService({
      baseUrl: options.ollamaBaseUrl,
      model,
      repoFileHints,
    });
  }
  const executor: AgentExecutorService =
    Object.keys(perRole).length > 0 && executorMode === "ollama"
      ? new RoleAwareAgentExecutorService(fallbackExecutor, perRole)
      : fallbackExecutor;
  const agentRuns = new AgentRunService(agents, runs, messages, executor, {
    maxHandoffDepth: options.maxHandoffDepth,
    executionTimeoutMs: options.executionTimeoutMs,
    verifiedRepoFiles: repoFileHints,
  });

  return {
    agents,
    agentRuns,
    messages,
    tasks,
    runs,
    skillOrchestrations: new SkillOrchestrationService(agents, agentRuns, runs, wiki),
    wiki,
    codexWorkers: new CodexWorkerService(runs, wiki, atelierRootResolved),
    knowledgeGraph: new KnowledgeGraphService(agents, tasks, runs, wiki),
  };
}
