import type { RunExecutionPhase } from "./run";

export const RUN_EVENT_TYPES = [
  "queued",
  "claimed",
  "phase_changed",
  "step_started",
  "step_completed",
  "step_reused",
  "retry_scheduled",
  "cancel_requested",
  "cancelled",
  "completed",
  "failed",
  "log",
] as const;

export type RunEventType = (typeof RUN_EVENT_TYPES)[number];

export type RunEvent = {
  id: string;
  runId: string;
  sequence: number;
  type: RunEventType;
  phase?: RunExecutionPhase;
  stepId?: string;
  message?: string;
  payload?: unknown;
  createdAt: string;
};

export type AppendRunEventInput = {
  type: RunEventType;
  phase?: RunExecutionPhase;
  stepId?: string;
  message?: string;
  payload?: unknown;
};

export type ListRunEventsInput = {
  after?: number;
  limit?: number;
};

export type RunEventsResponse = {
  events: RunEvent[];
  nextCursor: number;
};
