export type WikiLogEventType =
  | "initialization"
  | "ingest"
  | "query"
  | "wiki_write"
  | "run_completed"
  | "run_log"
  | "wiki_lint"
  | "decision"
  | "manual";

export const MEMORY_LAYERS = ["raw", "episodic", "semantic", "learning"] as const;
export type MemoryLayer = (typeof MEMORY_LAYERS)[number];

export const MEMORY_TRUST_STATES = ["immutable-source", "generated", "verified", "rejected"] as const;
export type MemoryTrustState = (typeof MEMORY_TRUST_STATES)[number];

export const MEMORY_AUTHORITY_LEVELS = ["evidence-only", "context-only", "trusted"] as const;
export type MemoryAuthorityLevel = (typeof MEMORY_AUTHORITY_LEVELS)[number];

export type MemoryTrustMetadata = {
  layer: MemoryLayer;
  state: MemoryTrustState;
  authority: MemoryAuthorityLevel;
  provenancePaths: string[];
  reason: string;
};

export type WikiPageResponse = {
  path: string;
  content: string;
  ready: boolean;
  memory: MemoryTrustMetadata;
};

export type WikiWritePageInput = {
  path: string;
  content: string;
};

export type WikiLogEntry = {
  timestamp: string;
  eventType: WikiLogEventType;
  title: string;
  summary?: string;
  runId?: string;
  taskId?: string;
  agentId?: string;
};

export type AppendWikiLogInput = {
  eventType: WikiLogEventType;
  title: string;
  summary?: string;
  runId?: string;
  taskId?: string;
  agentId?: string;
  details?: Record<string, string | number | boolean | null | undefined>;
};

export type AppendWikiLogResponse = {
  path: string;
  entry: string;
};

export type WikiIngestInput = {
  title: string;
  content: string;
  sourceType?: "note" | "research" | "client" | "decision" | "other";
  sourcePathHint?: string;
};

export type WikiIngestResponse = {
  rawPath: string;
  summaryPagePath: string;
  logPath: string;
  proposedTasks: string[];
  rawMemory: MemoryTrustMetadata;
  summaryMemory: MemoryTrustMetadata;
};

export type WikiQueryInput = {
  query: string;
  limit?: number;
  sourceType?: "note" | "research" | "client" | "decision" | "other";
  retrievalPolicy?: WikiRetrievalPolicy;
};

export const WIKI_RETRIEVAL_POLICIES = ["balanced", "evidence-first", "trusted-only"] as const;
export type WikiRetrievalPolicy = (typeof WIKI_RETRIEVAL_POLICIES)[number];

export type WikiRetrievalScore = {
  lexical: number;
  trustAdjustment: number;
  total: number;
  reason: string;
};

export type WikiQueryMatch = {
  path: string;
  snippet: string;
  memory: MemoryTrustMetadata;
  retrieval: WikiRetrievalScore;
};

export type WikiRelatedPage = {
  path: string;
  summary: string;
  reason: string;
  memory: MemoryTrustMetadata;
};

export type WikiContradiction = {
  primaryPath: string;
  conflictingPath: string;
  reason: string;
};

export type WikiQueryResponse = {
  query: string;
  retrievalPolicy: WikiRetrievalPolicy;
  matches: WikiQueryMatch[];
  relatedPages: WikiRelatedPage[];
  contradictions: WikiContradiction[];
};

export type WikiReflectionInput = {
  minOccurrences?: number;
  limit?: number;
};

export type WikiReflectionCandidate = {
  id: string;
  title: string;
  pattern: string;
  occurrenceCount: number;
  evidencePaths: string[];
  suggestedPath: string;
  draftMarkdown: string;
  memory: MemoryTrustMetadata;
};

export type WikiReflectionResponse = {
  candidates: WikiReflectionCandidate[];
  scannedEpisodes: number;
  minOccurrences: number;
  generatedAt: string;
};

export const WIKI_REFLECTION_DECISIONS = ["accepted", "rejected"] as const;
export type WikiReflectionDecisionValue = (typeof WIKI_REFLECTION_DECISIONS)[number];

export type WikiReflectionDecisionInput = {
  candidateId: string;
  decision: WikiReflectionDecisionValue;
  note: string;
};

export type WikiReflectionDecisionRecord = {
  candidateId: string;
  decision: WikiReflectionDecisionValue;
  note: string;
  path: string;
  createdAt: string;
};

export type WikiReflectionPromotionInput = {
  decisionPath: string;
};

export type WikiReflectionPromotionRecord = {
  decisionPath: string;
  promotedPath: string;
  memory: MemoryTrustMetadata;
};

export type WikiLintIssue = {
  code: "missing_page" | "broken_link" | "stale_index_entry" | "curation_signal";
  path: string;
  message: string;
  suggestion?: string;
};

export type WikiLintResponse = {
  ok: boolean;
  issues: WikiLintIssue[];
  checkedAt: string;
};

export const WIKI_DREAM_DECISION_VALUES = ["accepted", "rejected", "deferred"] as const;
export type WikiDreamDecisionValue = (typeof WIKI_DREAM_DECISION_VALUES)[number];

export type WikiDreamDecisionRecordInput = {
  reportPath: string;
  proposal: string;
  decision: WikiDreamDecisionValue;
  rationale?: string;
  taskId?: string;
};

export type WikiDreamDecisionRecord = {
  id: string;
  path: string;
  reportPath: string;
  proposal: string;
  decision: WikiDreamDecisionValue;
  rationale?: string;
  taskId?: string;
  createdAt: string;
};
