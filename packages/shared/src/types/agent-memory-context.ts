import type { MemoryTrustMetadata, WikiRetrievalPolicy, WikiRetrievalScore } from "./wiki";
import type { AgentRole } from "./agent";

export type AgentMemoryContextSource = "direct" | "retrieval";

export type AgentMemoryContextBudgets = {
  totalBytes: number;
  perItemBytes: number;
  maxRetrievalItems: number;
};

export type AgentMemoryContextPackInput = {
  query: string;
  directSourcePaths?: string[];
  role?: AgentRole;
  roles?: AgentRole[];
  roleMemoryPaths?: string[];
  retrievalPolicy?: WikiRetrievalPolicy;
  budgets?: Partial<AgentMemoryContextBudgets>;
};

export type AgentMemoryContextItem = {
  source: AgentMemoryContextSource;
  path: string;
  memory: MemoryTrustMetadata;
  retrieval?: WikiRetrievalScore;
  applicableRole?: AgentRole;
  contentSha256: string;
  originalBytes: number;
  includedBytes: number;
  truncated: boolean;
  excerpt: string;
};

export type AgentMemoryContextExclusionReason =
  | "duplicate"
  | "not-found"
  | "context-only"
  | "budget-exhausted";

export type AgentMemoryContextExcludedPath = {
  path: string;
  reason: AgentMemoryContextExclusionReason;
};

export type AgentMemoryContextReceipt = {
  schemaVersion: 1;
  query: string;
  policy: WikiRetrievalPolicy;
  budgets: AgentMemoryContextBudgets;
  createdAt: string;
  items: AgentMemoryContextItem[];
  excluded: AgentMemoryContextExcludedPath[];
  stableHash: string;
};

export type AgentMemoryContextPack = {
  receipt: AgentMemoryContextReceipt;
  renderedContext: string;
  verifiedFiles: string[];
};

export const CONTEXT_RECEIPT_EVALUATION_OUTCOMES = ["useful", "mixed", "not-useful"] as const;

export type ContextReceiptEvaluationOutcome = (typeof CONTEXT_RECEIPT_EVALUATION_OUTCOMES)[number];

export const CONTEXT_RECEIPT_ITEM_RELEVANCE = ["relevant", "uncertain", "irrelevant"] as const;

export type ContextReceiptItemRelevance = (typeof CONTEXT_RECEIPT_ITEM_RELEVANCE)[number];

export const CONTEXT_RECEIPT_EVALUATION_NOTE_MAX_LENGTH = 1_000;

export type ContextReceiptItemEvaluation = {
  path: string;
  applicableRole?: AgentRole;
  relevance: ContextReceiptItemRelevance;
};

export type ContextReceiptEvaluation = {
  schemaVersion: 1;
  receiptHash: string;
  outcome: ContextReceiptEvaluationOutcome;
  items: ContextReceiptItemEvaluation[];
  note?: string;
  assessedAt: string;
};

export type RecordContextReceiptEvaluationInput = {
  outcome: ContextReceiptEvaluationOutcome;
  items: ContextReceiptItemEvaluation[];
  note?: string;
};

export type ContextReceiptEvaluationCounts = Record<ContextReceiptItemRelevance, number>;

export type ContextReceiptEvaluationBreakdown = {
  key: string;
  label: string;
  evaluatedItems: number;
  relevance: ContextReceiptEvaluationCounts;
};

export type ContextReceiptEvaluationSummary = {
  evaluatedReceipts: number;
  outcomes: Record<ContextReceiptEvaluationOutcome, number>;
  byAuthority: ContextReceiptEvaluationBreakdown[];
  byRole: ContextReceiptEvaluationBreakdown[];
  bySource: ContextReceiptEvaluationBreakdown[];
};

/**
 * A deterministic, system-generated check of whether a frozen receipt's paths
 * were explicitly referenced by the terminal orchestration output. It is not
 * a substitute for the operator's usefulness and relevance judgement.
 */
export const AUTOMATED_CONTEXT_RECEIPT_ASSESSMENT_OUTCOMES = ["supported", "partial", "unverified"] as const;

export type AutomatedContextReceiptAssessmentOutcome =
  (typeof AUTOMATED_CONTEXT_RECEIPT_ASSESSMENT_OUTCOMES)[number];

export type AutomatedContextReceiptItemAssessment = {
  path: string;
  applicableRole?: AgentRole;
  referenced: boolean;
};

export type AutomatedContextReceiptAssessment = {
  schemaVersion: 1;
  receiptHash: string;
  method: "terminal-output-path-reference";
  outcome: AutomatedContextReceiptAssessmentOutcome;
  items: AutomatedContextReceiptItemAssessment[];
  assessedAt: string;
};

export type AutomatedContextReceiptAssessmentSummary = {
  assessedReceipts: number;
  outcomes: Record<AutomatedContextReceiptAssessmentOutcome, number>;
};
