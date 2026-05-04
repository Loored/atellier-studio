import type { Agent } from "./agent";
import type { AgentMessage } from "./message";
import type { Run } from "./run";

export const AGENT_INSTRUCTION_MAX_LENGTH = 2000;

export type RunAgentInput = {
  instruction: string;
  context?: string;
  handoffAgentId?: string;
  handoffInstruction?: string;
};

export type RunAgentResult = {
  agent: Agent;
  run: Run;
  userMessage: AgentMessage;
  assistantMessage: AgentMessage;
};

export type AgentRunStreamEvent =
  | { type: "status"; status: "queued" | "running" | "finalizing" }
  | { type: "chunk"; content: string }
  | { type: "result"; result: RunAgentResult }
  | { type: "error"; message: string };
