export type ExecutorMode = "mock" | "openai";

export type ModelProfile = "cheap" | "standard" | "deep";

export type HealthStatus = {
  status: "ok";
  service: "atellier-api";
  storageMode: "memory" | "mongo";
  executorMode: ExecutorMode;
  executorModel: string;
  modelProfile: ModelProfile;
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
