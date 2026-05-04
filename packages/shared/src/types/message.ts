export const AGENT_MESSAGE_ROLES = ["user", "assistant", "system"] as const;

export type AgentMessageRole = (typeof AGENT_MESSAGE_ROLES)[number];

export const AGENT_MESSAGE_MAX_LENGTH = 4000;

export type AgentMessage = {
  id: string;
  agentId: string;
  runId?: string;
  role: AgentMessageRole;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateAgentMessageInput = {
  agentId: string;
  runId?: string;
  role: AgentMessageRole;
  content: string;
};
