import type { AgentRole } from "./agent";
import type { AgentValidationResult } from "./agent-run";
import type { ExecutorMode, ModelProfile } from "./health";
import type { Run, RunExecution, RunStatus } from "./run";
import type {
  AgentMemoryContextReceipt,
  AutomatedContextReceiptAssessment,
  ContextReceiptEvaluation,
} from "./agent-memory-context";

export const ORCHESTRATION_SKILL_IDS = [
  "atellier-build-loop",
  "llm-wiki-ingest-loop",
  "wiki-dream-loop",
] as const;

export type OrchestrationSkillId = (typeof ORCHESTRATION_SKILL_IDS)[number];

export const BUILD_ORCHESTRATION_READINESS = ["ready-for-human-review", "needs-human", "changes-required"] as const;
export type BuildOrchestrationReadiness = (typeof BUILD_ORCHESTRATION_READINESS)[number];

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
  /**
   * Explicit per-run ceiling for semantic QA repairs. This is primarily used by
   * frozen evaluation campaigns; ordinary operator runs retain the skill default.
   */
  semanticRepairLimit?: number;
  canaryId?: string;
  context?: string;
  taskId?: string;
  executorModeOverride?: ExecutorMode;
  modelProfileOverride?: ModelProfile;
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

export type OrchestrationQaChecklistCompletionSummary = OrchestrationRepairSummary & {
  missingCriteria: string[];
  criteriaWithoutEvidence?: string[];
};

export type OrchestrationRepeatedFeedbackSummary = {
  detected: boolean;
  firstQaStepId: string;
  repeatedQaStepId: string;
  feedback: string;
};

export type OrchestrationRepairStallSummary = {
  kind: "no-artifact-progress";
  repairStepId: string;
  previousArtifactDigest: string;
  attemptedArtifactDigest: string;
  message: string;
};

export type OrchestrationPerformanceBreakdown = {
  key: string;
  runs: number;
  durationMs: number;
};

export type OrchestrationPerformanceSummary = {
  schemaVersion: 1;
  measuredRuns: number;
  totalDurationMs: number;
  byPhase: OrchestrationPerformanceBreakdown[];
  byModel: OrchestrationPerformanceBreakdown[];
};

/**
 * Server-acquired bounded evidence for an explicit one/two-run operator goal.
 * It is separate from Wiki context and survives orchestration recovery.
 */
export type OrchestrationPreflightRunEvidence = {
  schemaVersion: 1;
  goalHash: string;
  requestedRunIds: string[];
  invocation: {
    id: string;
    status: "succeeded" | "denied" | "failed";
    inputDigest: string;
    outputSummary: string;
    completedAt: string;
  };
  evidenceDigest: string;
  /** Bounded read-only receipt records; omitted when the read was unavailable. */
  records?: Array<Record<string, unknown>>;
};

export const ARTIFACT_QUALITY_VERDICTS = ["verified", "rejected", "unverified"] as const;
export type ArtifactQualityVerdict = (typeof ARTIFACT_QUALITY_VERDICTS)[number];

export type ArtifactQualityFinding = {
  code: "missing-artifact" | "missing-section" | "self-referential-evidence" | "unsupported-operational-identifier" | "unsupported-factual-claim" | "evidence-unavailable" | "receipt-grounding-missing" | "semantic-review-required";
  dimension: "structure" | "provenance" | "goal-fidelity" | "operational-compatibility" | "action-boundary";
  message: string;
};

/** An independent, deterministic receipt. It never approves a human review. */
export type ArtifactQualityReceipt = {
  schemaVersion: 1;
  verdict: ArtifactQualityVerdict;
  goalHash: string;
  artifactDigest: string;
  operationalContractFingerprint: string;
  preflightEvidenceDigest?: string;
  findings: ArtifactQualityFinding[];
};

export type BuildOrchestrationOutput = {
  skillId?: OrchestrationSkillId;
  goal?: string;
  steps?: SkillOrchestrationStepResult[];
  readiness?: BuildOrchestrationReadiness;
  validation?: AgentValidationResult;
  artifact?: {
    content?: string;
    sourceRunId?: string;
    stepId?: string;
  };
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  qaChecklistCompletion?: OrchestrationQaChecklistCompletionSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
  repairStall?: OrchestrationRepairStallSummary;
  semanticRepair?: OrchestrationRepairSummary;
  performance?: OrchestrationPerformanceSummary;
  preflightRunEvidence?: OrchestrationPreflightRunEvidence;
  qualityEvaluation?: ArtifactQualityReceipt;
};

export type SkillOrchestrationResult = {
  skillId: OrchestrationSkillId;
  goal: string;
  orchestrationRun: Run;
  steps: SkillOrchestrationStepResult[];
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  qaChecklistCompletion?: OrchestrationQaChecklistCompletionSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
  repairStall?: OrchestrationRepairStallSummary;
  semanticRepair?: OrchestrationRepairSummary;
  performance?: OrchestrationPerformanceSummary;
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
  contextReceipt?: AgentMemoryContextReceipt;
  contextEvaluation?: ContextReceiptEvaluation;
  automatedContextAssessment?: AutomatedContextReceiptAssessment;
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  qaChecklistCompletion?: OrchestrationQaChecklistCompletionSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
  repairStall?: OrchestrationRepairStallSummary;
  semanticRepair?: OrchestrationRepairSummary;
  performance?: OrchestrationPerformanceSummary;
  /** Deterministic quality receipt; it is distinct from human review approval. */
  qualityEvaluation?: ArtifactQualityReceipt;
};

export type StartSkillOrchestrationResponse = {
  runId: string;
};
