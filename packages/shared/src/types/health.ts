export const EXECUTOR_MODES = ["mock", "openai", "anthropic", "groq", "ollama"] as const;

export type ExecutorMode = (typeof EXECUTOR_MODES)[number];

export type ModelProfile = "cheap" | "standard" | "deep";
export const MODEL_PROFILES = ["cheap", "standard", "deep"] as const;

export type HealthStatus = {
  status: "ok";
  service: "atellier-api";
  storageMode: "memory" | "mongo";
  executorMode: ExecutorMode;
  executorModel: string;
  modelProfile: ModelProfile;
  availableExecutorModes?: ExecutorMode[];
  codexWorker: {
    executionAdapter: "fake" | "real";
    label: string;
    realExecutionEnabled: boolean;
  };
  /**
   * Per-agent-role model overrides. Present only when the active executor
   * supports per-role routing (currently Ollama only) and at least one
   * override is configured. Keys are agent roles, values are model names.
   */
  executorRoleOverrides?: Record<string, string>;
  mongo: {
    connected: boolean;
    state: string;
  };
  metrics: {
    agentsTotal: number;
    waitingAgents: number;
    activeRuns: number;
  };
  memory: {
    rssBytes: number;
    heapUsedBytes: number;
  };
};
