import type { AgentRole } from "./agent";
import type { Run, RunStatus } from "./run";

export const ORCHESTRATION_SKILL_IDS = [
  "atellier-build-loop",
  "llm-wiki-ingest-loop",
] as const;

export type OrchestrationSkillId = (typeof ORCHESTRATION_SKILL_IDS)[number];

export const ORCHESTRATION_GOAL_MAX_LENGTH = 2000;
export const ORCHESTRATION_CONTEXT_MAX_LENGTH = 4000;

export type OrchestrationSkillStepSummary = {
  id: string;
  label: string;
  phase: string;
  agentRole: AgentRole;
  agentName: string;
  objective: string;
};

export type OrchestrationSkillSummary = {
  id: OrchestrationSkillId;
  name: string;
  description: string;
  steps: OrchestrationSkillStepSummary[];
};

export type StartSkillOrchestrationInput = {
  skillId: OrchestrationSkillId;
  goal: string;
  context?: string;
  taskId?: string;
};

export type SkillOrchestrationStepResult = {
  stepId: string;
  label: string;
  phase: string;
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  runId: string;
  status: RunStatus;
};

export type SkillOrchestrationResult = {
  skillId: OrchestrationSkillId;
  goal: string;
  orchestrationRun: Run;
  steps: SkillOrchestrationStepResult[];
};
