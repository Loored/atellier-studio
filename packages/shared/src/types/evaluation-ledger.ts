import type { ExecutorMode, ModelProfile } from "./health";

export const EVALUATION_TERMINAL_STATUSES = ["completed", "failed", "blocked", "cancelled"] as const;

export type EvaluationTerminalStatus = (typeof EVALUATION_TERMINAL_STATUSES)[number];

export const EVALUATION_OUTCOMES = ["passed", "needs-human", "failed", "cancelled"] as const;

export type EvaluationOutcome = (typeof EVALUATION_OUTCOMES)[number];

export type AgentRunEvaluation = {
  schemaVersion: 2;
  evaluationId: string;
  fingerprint: string;
  runId: string;
  terminalStatus: EvaluationTerminalStatus;
  outcome: EvaluationOutcome;
  validationPassed: boolean;
  needsHuman: boolean;
  executorMode: ExecutorMode;
  modelProfile: ModelProfile;
  /** Exact model confirmed by the provider for this execution. */
  resolvedModel?: string;
  /** Exact execution/control configuration when this receipt is experiment evidence. */
  configurationFingerprint?: string;
  agentRole?: string;
  orchestration?: {
    runId?: string;
    stepId?: string;
    logicalStepId?: string;
    repairAttempt?: number;
    repairKind?: string;
  };
  contextReceiptHash?: string;
  toolInvocations: { succeeded: number; denied: number; failed: number };
  startedAt: string;
  completedAt: string;
  durationMs: number;
  error?: {
    kind: "cancelled" | "timeout" | "executor" | "validation";
    message: string;
  };
  recordedAt: string;
};

export type EvaluationLedgerSummary = {
  total: number;
  outcomes: Record<EvaluationOutcome, number>;
  toolInvocations: { succeeded: number; denied: number; failed: number };
  generatedAt: string;
};

export const LEARNING_CANDIDATE_STATUSES = [
  "pending-review",
  "accepted-for-experiment",
  "rejected",
  "deferred",
] as const;

export type LearningCandidateStatus = (typeof LEARNING_CANDIDATE_STATUSES)[number];

export type LearningCandidateDecision = {
  candidateId: string;
  evidenceDigest: string;
  decision: "accepted" | "rejected" | "deferred";
  note: string;
  decidedAt: string;
};

export type LearningCandidate = {
  id: string;
  /**
   * Binds an operator decision to the exact aggregate evidence that generated
   * this candidate. A changed digest represents a materially new review.
   */
  evidenceDigest: string;
  title: string;
  rationale: string;
  evidence: EvaluationLedgerSummary;
  status: LearningCandidateStatus;
  decision?: LearningCandidateDecision & { path: string };
  /** Immutable prior reviews for this candidate across evidence revisions. */
  history?: Array<LearningCandidateDecision & { path: string }>;
};

/** A reviewable shadow-only proposal. It has no route to runtime activation. */
export type LearningExperiment = {
  id: string;
  candidateId: string;
  evidenceDigest: string;
  mode: "shadow";
  status: "prepared";
  note: string;
  createdAt: string;
  path: string;
};

export type LearningShadowObservation = {
  experimentId: string;
  quality: "better" | "same" | "worse";
  durationMs?: number;
  retries?: number;
  needsHuman?: boolean;
  note: string;
  observedAt: string;
  path: string;
};

export type LearningShadowComparison = {
  experimentId: string;
  observations: number;
  quality: { better: number; same: number; worse: number };
  verdict: "improving" | "neutral" | "regressing" | "insufficient-evidence";
  safety: "observation-only";
  eligibility: {
    eligibleForProposal: boolean;
    reasons: string[];
    minimumObservations: number;
  };
};

/**
 * A compact, immutable reference to one terminal Evaluation Ledger receipt.
 * It deliberately contains only comparison-relevant metadata, not run output.
 */
export type EvaluationLedgerReceiptReference = {
  runId: string;
  evaluationId: string;
  fingerprint: string;
  terminalStatus: EvaluationTerminalStatus;
  outcome: EvaluationOutcome;
  validationPassed: boolean;
  needsHuman: boolean;
  modelProfile: ModelProfile;
  resolvedModel?: string;
  configurationFingerprint: string;
  agentRole?: string;
  logicalStepId?: string;
  contextReceiptHash: string;
  durationMs: number;
  recordedAt: string;
};

export type EvaluationLedgerEvidencePair = {
  id: string;
  experimentId: string;
  comparisonKey: string;
  fingerprint: string;
  baseline: EvaluationLedgerReceiptReference;
  shadow: EvaluationLedgerReceiptReference;
  verdict: "improving" | "neutral" | "regressing";
  createdAt: string;
  path: string;
};

export type RecordEvaluationLedgerEvidencePairInput = {
  experimentId: string;
  baseline: Pick<EvaluationLedgerReceiptReference, "runId" | "evaluationId">;
  shadow: Pick<EvaluationLedgerReceiptReference, "runId" | "evaluationId">;
};

/** The only eligibility signal that can create a Control Bundle proposal. */
export type EvaluationLedgerEvidenceComparison = {
  experimentId: string;
  pairs: number;
  quality: { improving: number; neutral: number; regressing: number };
  eligibility: {
    eligibleForProposal: boolean;
    reasons: string[];
    minimumPairs: number;
  };
  /** A successful/fast receipt is not a substantive quality attestation. */
  autonomousPromotion: {
    eligible: false;
    reasons: string[];
  };
  evidenceDigest: string;
  baselineConfigurationFingerprint?: string;
  shadowConfigurationFingerprint?: string;
  safety: "receipt-derived-only";
};
