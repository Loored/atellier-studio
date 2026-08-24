import {
  createAgentExecutorService,
  OllamaAgentExecutorService,
  RoleAwareAgentExecutorService,
  type AgentExecutorMode,
  type AgentExecutorService,
} from "./agent-executor.service";
import type { AgentRole, ExecutorMode, ModelProfile } from "@atellier/shared";
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
import {
  FakeCodexWorkerExecutor,
  RealCodexWorkerExecutor,
} from "./codex-worker-executor.service";
import { readdir } from "node:fs/promises";
import { KnowledgeGraphService } from "./knowledge-graph.service";
import { seedDemoData } from "./seed.service";
import { KnowledgeLiveService } from "./knowledge-live.service";
import { RunEventService } from "./run-event.service";
import { ExecutionQueueService } from "./execution-queue.service";
import {
  DurableRuntimeService,
  type DurableWorkerDiagnosticSink,
} from "./durable-runtime.service";
import { createEffectIdempotencyRepository } from "./effect-idempotency.repository";
import { EffectIdempotencyService } from "./effect-idempotency.service";

export type AppServices = {
  agents: AgentService;
  agentRuns: AgentRunService;
  messages: MessageService;
  tasks: TaskService;
  runs: RunService;
  runEvents: RunEventService;
  executionQueue: ExecutionQueueService;
  durableRuntime: DurableRuntimeService;
  effectIdempotency: EffectIdempotencyService;
  skillOrchestrations: SkillOrchestrationService;
  wiki: WikiService;
  codexWorkers: CodexWorkerService;
  knowledgeGraph: KnowledgeGraphService;
  knowledgeLive: KnowledgeLiveService;
  executor: {
    activeMode: AgentExecutorMode;
    availableModes: ExecutorMode[];
  };
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
  /**
   * When true, populates the in-memory storage with a small set of agents,
   * tasks, and runs so the dashboard and Knowledge Graph have realistic
   * content out of the box. Ignored when storageMode is "mongo".
   */
  seedDemoData?: boolean;
  /** Runs the durable worker in-process. Intended for tests and memory-mode development only. */
  inlineDurableRuntime?: boolean;
  runtimeLeaseMs?: number;
  runtimePollMs?: number;
  runtimeWorkerId?: string;
  runtimeDiagnosticSink?: DurableWorkerDiagnosticSink;
  /** Explicit opt-in. Real Codex execution remains disabled unless this is true. */
  codexWorkerRealEnabled?: boolean;
  codexWorkerTimeoutMs?: number;
  codexWorkerMaxOutputBytes?: number;
  codexWorkerAllowedWorkingDirectories?: string[];
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
  const executorByMode: Partial<Record<ExecutorMode, AgentExecutorService>> = {
    mock: createAgentExecutorService({ mode: "mock", repoFileHints }),
  };
  if (options.openaiApiKey) {
    executorByMode.openai = createAgentExecutorService({
      mode: "openai",
      openai: {
        apiKey: options.openaiApiKey,
        model: options.openaiModel ?? "gpt-4.1-mini",
      },
      repoFileHints,
    });
  }
  if (options.anthropicApiKey) {
    executorByMode.anthropic = createAgentExecutorService({
      mode: "anthropic",
      anthropic: {
        apiKey: options.anthropicApiKey,
        model: options.anthropicModel ?? "claude-opus-4-7",
      },
      repoFileHints,
    });
  }
  if (options.groqApiKey) {
    executorByMode.groq = createAgentExecutorService({
      mode: "groq",
      groq: {
        apiKey: options.groqApiKey,
        model: options.groqModel ?? "llama-3.3-70b-versatile",
      },
      repoFileHints,
    });
  }
  if (options.ollamaModel) {
    const ollamaDefaultExecutor = createAgentExecutorService({
      mode: "ollama",
      ollama: {
        baseUrl: options.ollamaBaseUrl,
        model: options.ollamaModel,
      },
      repoFileHints,
    });
    executorByMode.ollama =
      Object.keys(perRole).length > 0
        ? new RoleAwareAgentExecutorService(ollamaDefaultExecutor, perRole)
        : ollamaDefaultExecutor;
  }

  // Ensure the active mode uses the exact runtime wiring (including role-aware
  // wrapper) that was already selected above.
  executorByMode[executorMode] = executor;

  const agentRuns = new AgentRunService(agents, runs, messages, executorMode, executorByMode, {
    maxHandoffDepth: options.maxHandoffDepth,
    executionTimeoutMs: options.executionTimeoutMs,
    verifiedRepoFiles: repoFileHints,
  });

  const skillOrchestrations = new SkillOrchestrationService(agents, agentRuns, runs, wiki);
  const runEvents = new RunEventService(storageMode, runs);
  const executionQueue = new ExecutionQueueService(runs, runEvents, {
    leaseMs: options.runtimeLeaseMs,
    retryBaseDelayMs: storageMode === "memory" ? 0 : undefined,
  });
  const effectIdempotency = new EffectIdempotencyService(
    createEffectIdempotencyRepository(storageMode),
  );
  const codexWorkerExecutor = options.codexWorkerRealEnabled
    ? new RealCodexWorkerExecutor({
        repositoryRoot: repoRootResolved,
        allowedWorkingDirectories: options.codexWorkerAllowedWorkingDirectories,
        timeoutMs: options.codexWorkerTimeoutMs,
        maxOutputBytes: options.codexWorkerMaxOutputBytes,
      })
    : new FakeCodexWorkerExecutor();
  const durableRuntime = new DurableRuntimeService(executionQueue, skillOrchestrations, {
    inline: options.inlineDurableRuntime ?? storageMode === "memory",
    onDiagnostic: options.runtimeDiagnosticSink,
    pollMs: options.runtimePollMs,
    workerId: options.runtimeWorkerId,
  });

  const services: AppServices = {
    agents,
    agentRuns,
    messages,
    tasks,
    runs,
    runEvents,
    executionQueue,
    durableRuntime,
    effectIdempotency,
    skillOrchestrations,
    wiki,
    codexWorkers: new CodexWorkerService(
      runs,
      wiki,
      atelierRootResolved,
      codexWorkerExecutor,
      effectIdempotency,
    ),
    knowledgeGraph: new KnowledgeGraphService(agents, tasks, runs, wiki, atelierRootResolved),
    knowledgeLive: new KnowledgeLiveService(),
    executor: {
      activeMode: executorMode,
      availableModes: Object.keys(executorByMode) as ExecutorMode[],
    },
  };

  if (storageMode === "memory" && options.seedDemoData) {
    await seedDemoData({ agents, tasks, runs });
  }

  return services;
}
