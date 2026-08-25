import type { AgentRole } from "./agent";

export const REVIEW_LEARNING_SIGNALS = ["contradiction", "stale", "needs-review"] as const;

export type ReviewLearningSignal = (typeof REVIEW_LEARNING_SIGNALS)[number];

export const REVIEW_LEARNING_RESOLUTION_OUTCOMES = ["resolved", "dismissed"] as const;

export type ReviewLearningResolutionOutcome = (typeof REVIEW_LEARNING_RESOLUTION_OUTCOMES)[number];

export const REVIEW_LEARNING_MAX_LENGTH = 1000;
export const REVIEW_LEARNING_SIGNAL_PATH_MAX_LENGTH = 500;
export const REVIEW_LEARNING_RESOLUTION_NOTE_MAX_LENGTH = 1000;

export type CurateReviewLearningInput = {
  role: AgentRole;
  lesson: string;
  signal?: ReviewLearningSignal;
  signalPath?: string;
};

export type ResolveReviewLearningSignalInput = {
  outcome: ReviewLearningResolutionOutcome;
  note: string;
};

export type ReviewLearningSignalResolution = ResolveReviewLearningSignalInput & {
  runId: string;
  signal: ReviewLearningSignal;
  signalPath: string;
  logPath: string;
  resolvedAt: string;
};

export type ReviewLearningRecord = CurateReviewLearningInput & {
  runId: string;
  taskId?: string;
  memoryPath: string;
  roleMemoryPath: string;
  logPath: string;
  capturedAt: string;
  resolution?: ReviewLearningSignalResolution;
};
