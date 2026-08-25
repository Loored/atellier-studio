import type { AgentRole } from "./agent";

export const REVIEW_LEARNING_SIGNALS = ["contradiction", "stale", "needs-review"] as const;

export type ReviewLearningSignal = (typeof REVIEW_LEARNING_SIGNALS)[number];

export const REVIEW_LEARNING_MAX_LENGTH = 1000;
export const REVIEW_LEARNING_SIGNAL_PATH_MAX_LENGTH = 500;

export type CurateReviewLearningInput = {
  role: AgentRole;
  lesson: string;
  signal?: ReviewLearningSignal;
  signalPath?: string;
};

export type ReviewLearningRecord = CurateReviewLearningInput & {
  runId: string;
  taskId?: string;
  memoryPath: string;
  roleMemoryPath: string;
  logPath: string;
  capturedAt: string;
};
