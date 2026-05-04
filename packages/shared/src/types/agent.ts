export const AGENT_ROLES = ["intake", "wiki-curator", "pm", "builder", "qa"] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_STATUSES = [
  "idle",
  "reading",
  "thinking",
  "planning",
  "writing",
  "executing",
  "reviewing",
  "blocked",
  "needs-human",
  "done",
] as const;

export type AgentStatus = (typeof AGENT_STATUSES)[number];

export type AgentAvatar = {
  sprite?: string;
  room?: string;
  x?: number;
  y?: number;
};

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  currentTaskId?: string;
  lastRunId?: string;
  avatar?: AgentAvatar;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentInput = {
  name: string;
  role: AgentRole;
  status?: AgentStatus;
  currentTaskId?: string;
  lastRunId?: string;
  avatar?: AgentAvatar;
};

export type UpdateAgentStatusInput = {
  status: AgentStatus;
  currentTaskId?: string;
  lastRunId?: string;
};
