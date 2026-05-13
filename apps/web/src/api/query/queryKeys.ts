export const QUERY_KEYS = {
  AGENTS: "agents",
  TASKS: "tasks",
  RUNS: "runs",
  WIKI: "wiki",
  ORCHESTRATIONS: "orchestrations",
  KNOWLEDGE: "knowledge",
  SYSTEM: "system",
  CLIENTS: "clients",
  PROJECTS: "projects",
} as const;

export const queryKeys = {
  agents: {
    all: [QUERY_KEYS.AGENTS] as const,
    detail: (agentId: string) => [QUERY_KEYS.AGENTS, agentId] as const,
    messages: (agentId: string) => [QUERY_KEYS.AGENTS, agentId, "messages"] as const,
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
    page: (wikiPath: string) => [QUERY_KEYS.WIKI, "page", wikiPath] as const,
    query: (query: string, limit: number, sourceType: string) =>
      [QUERY_KEYS.WIKI, "query", query, limit, sourceType] as const,
  },
  orchestrations: {
    skills: [QUERY_KEYS.ORCHESTRATIONS, "skills"] as const,
    status: (runId: string) => [QUERY_KEYS.ORCHESTRATIONS, "status", runId] as const,
  },
  knowledge: {
    graph: [QUERY_KEYS.KNOWLEDGE, "graph"] as const,
    snapshots: [QUERY_KEYS.KNOWLEDGE, "snapshots"] as const,
  },
  system: {
    health: [QUERY_KEYS.SYSTEM, "health"] as const,
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
