export const QUERY_KEYS = {
  AGENTS: "agents",
  TASKS: "tasks",
  RUNS: "runs",
  WIKI: "wiki",
  CLIENTS: "clients",
  PROJECTS: "projects",
} as const;

export const queryKeys = {
  agents: {
    all: [QUERY_KEYS.AGENTS] as const,
    detail: (agentId: string) => [QUERY_KEYS.AGENTS, agentId] as const,
  },
  tasks: {
    all: [QUERY_KEYS.TASKS] as const,
    detail: (taskId: string) => [QUERY_KEYS.TASKS, taskId] as const,
  },
  runs: {
    all: [QUERY_KEYS.RUNS] as const,
    detail: (runId: string) => [QUERY_KEYS.RUNS, runId] as const,
  },
  wiki: {
    index: [QUERY_KEYS.WIKI, "index"] as const,
    log: [QUERY_KEYS.WIKI, "log"] as const,
  },
  clients: {
    all: [QUERY_KEYS.CLIENTS] as const,
    detail: (clientId: string) => [QUERY_KEYS.CLIENTS, clientId] as const,
  },
  projects: {
    all: [QUERY_KEYS.PROJECTS] as const,
    detail: (projectId: string) => [QUERY_KEYS.PROJECTS, projectId] as const,
  },
};
