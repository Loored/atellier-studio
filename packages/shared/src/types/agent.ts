export const AGENT_ROLES = ["intake", "wiki-curator", "pm", "builder", "qa", "designer"] as const;

export type AgentRole = (typeof AGENT_ROLES)[number];

export const AGENT_INSTRUCTIONS_MAX_LENGTH = 4000;

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

export type AgentCurrentStep = {
  label: string;
  phase: string;
  orchestrationRunId: string;
  nextAgentName?: string;
};

export type Agent = {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  instructions?: string;
  currentTaskId?: string;
  lastRunId?: string;
  currentStep?: AgentCurrentStep;
  avatar?: AgentAvatar;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentInput = {
  name: string;
  role: AgentRole;
  status?: AgentStatus;
  instructions?: string;
  currentTaskId?: string;
  lastRunId?: string;
  avatar?: AgentAvatar;
};

export type UpdateAgentStatusInput = {
  status: AgentStatus;
  currentTaskId?: string;
  lastRunId?: string;
  currentStep?: AgentCurrentStep | null;
};

export type UpdateAgentInstructionsInput = {
  instructions: string;
};
