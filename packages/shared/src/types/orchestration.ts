import type { AgentRole } from "./agent";
import type { ExecutorMode } from "./health";
import type { Run, RunExecution, RunStatus } from "./run";

export const ORCHESTRATION_SKILL_IDS = [
  "atellier-build-loop",
  "llm-wiki-ingest-loop",
  "wiki-dream-loop",
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

export type OrchestrationExecutionStep = OrchestrationSkillStepSummary & {
  instruction: string;
};

export type OrchestrationExecutionDefinition = Omit<OrchestrationSkillSummary, "steps"> & {
  steps: OrchestrationExecutionStep[];
};

export type StartSkillOrchestrationInput = {
  skillId: OrchestrationSkillId;
  goal: string;
  context?: string;
  taskId?: string;
  executorModeOverride?: ExecutorMode;
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
  logicalStepId?: string;
  repairAttempt?: number;
  repairAttemptLimit?: number;
  repairKind?: "deterministic" | "semantic";
};

export type OrchestrationRepairSummary = {
  maxAttempts: number;
  attemptsUsed: number;
  resolved: boolean;
  exhausted: boolean;
  finalStepId: string;
  lastValidArtifactStepId?: string;
  lastQaStepId?: string;
  blockerMessages: string[];
};

export type OrchestrationQaChecklistItem = {
  criterion: string;
  status: "pass" | "fail";
  evidence: string;
};

export type OrchestrationQaChecklistSummary = {
  sourceStepId: string;
  qaStepId: string;
  complete: boolean;
  items: OrchestrationQaChecklistItem[];
};

export type OrchestrationRepeatedFeedbackSummary = {
  detected: boolean;
  firstQaStepId: string;
  repeatedQaStepId: string;
  feedback: string;
};

export type SkillOrchestrationResult = {
  skillId: OrchestrationSkillId;
  goal: string;
  orchestrationRun: Run;
  steps: SkillOrchestrationStepResult[];
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
  semanticRepair?: OrchestrationRepairSummary;
};

export type OrchestrationStepStatusEntry = {
  stepId: string;
  label: string;
  phase: string;
  agentRole: AgentRole;
  agentName: string;
  agentId?: string;
  runId?: string;
  status: "pending" | RunStatus;
  isActive: boolean;
  logicalStepId?: string;
  repairAttempt?: number;
  repairAttemptLimit?: number;
  repairKind?: "deterministic" | "semantic";
};

export type OrchestrationStatusResult = {
  orchestrationRunId: string;
  taskId?: string;
  skillId: OrchestrationSkillId;
  goal: string;
  status: RunStatus;
  execution?: RunExecution;
  steps: OrchestrationStepStatusEntry[];
  activeStep: OrchestrationStepStatusEntry | null;
  nextStep: OrchestrationStepStatusEntry | null;
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
  semanticRepair?: OrchestrationRepairSummary;
};

export type StartSkillOrchestrationResponse = {
  runId: string;
};
