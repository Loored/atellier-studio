export const RUN_TYPES = ["manual", "ingest", "query", "build", "review", "lint", "orchestration"] as const;

export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = ["queued", "running", "failed", "completed", "blocked", "cancelled"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

export const RUN_EXECUTION_KINDS = ["skill-orchestration"] as const;

export type RunExecutionKind = (typeof RUN_EXECUTION_KINDS)[number];

export const RUN_EXECUTION_PHASES = [
  "queued",
  "running",
  "recovering",
  "finalizing",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;

export type RunExecutionPhase = (typeof RUN_EXECUTION_PHASES)[number];

export type RunExecution = {
  schemaVersion: 1;
  kind: RunExecutionKind;
  phase: RunExecutionPhase;
  definitionHash: string;
  definitionSnapshot: unknown;
  idempotencyKey: string;
  attempt: number;
  maxAttempts: number;
  nextEventSequence: number;
  availableAt: string;
  leaseOwner?: string;
  leaseExpiresAt?: string;
  heartbeatAt?: string;
  cancelRequestedAt?: string;
  startedAt?: string;
  finishedAt?: string;
  lastError?: string;
  currentStepId?: string;
};

export const RUN_LOG_LEVELS = ["info", "warn", "error"] as const;

export type RunLogLevel = (typeof RUN_LOG_LEVELS)[number];

export const RUN_REVIEW_STATUSES = ["pending", "approved", "changes-requested"] as const;

export type RunReviewStatus = (typeof RUN_REVIEW_STATUSES)[number];

export const RUN_LOG_MESSAGE_MAX_LENGTH = 1000;

export type RunLogEntry = {
  timestamp: string;
  level: RunLogLevel;
  message: string;
};

export type RunMemoryCapture = {
  wikiPath: string;
  logPath: string;
  summary: string;
  capturedAt: string;
};

export type Run = {
  id: string;
  taskId?: string;
  agentId?: string;
  type: RunType;
  status: RunStatus;
  reviewStatus?: RunReviewStatus;
  deliverablePath?: string;
  memory?: RunMemoryCapture;
  input?: unknown;
  output?: unknown;
  execution?: RunExecution;
  logs: RunLogEntry[];
  createdAt: string;
  updatedAt: string;
};

export type CreateRunInput = {
  taskId?: string;
  agentId?: string;
  type: RunType;
  status?: RunStatus;
  input?: unknown;
  execution?: RunExecution;
};

export type ListRunsInput = {
  type?: RunType;
  statuses?: RunStatus[];
  limit?: number;
};

export type AppendRunLogInput = {
  level?: RunLogLevel;
  message: string;
};

export type CompleteRunInput = {
  output?: unknown;
  summary?: string;
  reviewStatus?: RunReviewStatus;
  deliverablePath?: string;
  suppressAutoDeliverable?: boolean;
};

export type UpdateRunReviewInput = {
  reviewStatus: RunReviewStatus;
};

export type CaptureRunMemoryInput = {
  summary?: string;
};

export type CaptureRunMemoryResponse = {
  run: Run;
  wikiPath: string;
  logPath: string;
};
