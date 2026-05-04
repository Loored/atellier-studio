import {
  createAgentExecutorService,
  type AgentExecutorMode,
} from "./agent-executor.service";
import { AgentRunService } from "./agent-run.service";
import path from "node:path";
import { AgentService } from "./agent.service";
import { MessageService } from "./message.service";
import { RunService } from "./run.service";
import { TaskService } from "./task.service";
import { WikiService } from "./wiki.service";
import { type StorageMode } from "./service-utils";

export type AppServices = {
  agents: AgentService;
  agentRuns: AgentRunService;
  messages: MessageService;
  tasks: TaskService;
  runs: RunService;
  wiki: WikiService;
};

export type CreateAppServicesOptions = {
  storageMode?: StorageMode;
  atelierRoot?: string;
  agentExecutorMode?: AgentExecutorMode;
  openaiApiKey?: string;
  openaiModel?: string;
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
  const wiki = new WikiService(resolveAtellierRoot(options.atelierRoot));
  const agents = new AgentService(storageMode);
  const runs = new RunService(storageMode, wiki);
  const messages = new MessageService(storageMode);
  const executor = createAgentExecutorService({
    mode: options.agentExecutorMode ?? "mock",
    openai: options.openaiApiKey
      ? {
          apiKey: options.openaiApiKey,
          model: options.openaiModel ?? "gpt-5-mini",
        }
      : undefined,
  });

  return {
    agents,
    agentRuns: new AgentRunService(agents, runs, messages, executor, {
      maxHandoffDepth: options.maxHandoffDepth,
      executionTimeoutMs: options.executionTimeoutMs,
    }),
    messages,
    tasks: new TaskService(storageMode),
    runs,
    wiki,
  };
}
