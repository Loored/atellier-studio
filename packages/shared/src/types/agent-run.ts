import type { Agent, AgentRole } from "./agent";
import type { ExecutorMode } from "./health";
import type { AgentMessage } from "./message";
import type { Run } from "./run";

export const AGENT_INSTRUCTION_MAX_LENGTH = 2000;

export type OrchestrationStepRef = {
  orchestrationRunId: string;
  stepId: string;
  label: string;
  phase: string;
  nextAgentName?: string;
};

export type AgentValidationSeverity = "info" | "warn" | "error";

export type AgentValidationIssue = {
  code: string;
  message: string;
  severity: AgentValidationSeverity;
};

export type AgentValidationResult = {
  role: AgentRole;
  passed: boolean;
  issues: AgentValidationIssue[];
  verifiedRepoFiles: string[];
  invalidReferencedFiles: string[];
  referencedFiles: string[];
  candidateFiles: string[];
  changedFiles: string[];
};

export type RunAgentInput = {
  instruction: string;
  context?: string;
  executorModeOverride?: ExecutorMode;
  handoffAgentId?: string;
  handoffInstruction?: string;
  recordDeliverable?: boolean;
  verifiedRepoFiles?: string[];
  orchestrationStep?: OrchestrationStepRef;
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
