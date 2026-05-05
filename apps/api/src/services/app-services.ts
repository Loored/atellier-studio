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
  maxHandoffDepth?: number;
  executionTimeoutMs?: number;
};

export function resolveAtellierRoot(input?: string): string {
  if (input) {
    return path.resolve(process.cwd(), input);
  }

  return path.resolve(process.cwd(), "../../atelier");
}

export function createAppServices(options: CreateAppServicesOptions = {}): AppServices {
  const storageMode = options.storageMode ?? "mongo";
  const atelierRootResolved = resolveAtellierRoot(options.atelierRoot);
  const wiki = new WikiService(atelierRootResolved);
  const agents = new AgentService(storageMode);
  const runs = new RunService(storageMode, wiki);
  const messages = new MessageService(storageMode);
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
  });
  const agentRuns = new AgentRunService(agents, runs, messages, executor, {
    maxHandoffDepth: options.maxHandoffDepth,
    executionTimeoutMs: options.executionTimeoutMs,
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
