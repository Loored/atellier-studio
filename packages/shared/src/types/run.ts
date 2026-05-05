export const RUN_TYPES = ["manual", "ingest", "query", "build", "review", "lint", "orchestration"] as const;

export type RunType = (typeof RUN_TYPES)[number];

export const RUN_STATUSES = ["queued", "running", "failed", "completed", "blocked"] as const;

export type RunStatus = (typeof RUN_STATUSES)[number];

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

export type Run = {
  id: string;
  taskId?: string;
  agentId?: string;
  type: RunType;
  status: RunStatus;
  reviewStatus?: RunReviewStatus;
  deliverablePath?: string;
  input?: unknown;
  output?: unknown;
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
