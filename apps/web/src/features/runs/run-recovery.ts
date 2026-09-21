import type { Run } from "@atellier/shared";

export type RunRecoveryNotice = {
  kind: "cancellation-requested" | "recovered-cancellation" | "attempts-exhausted" | "superseded-child";
  title: string;
  detail: string;
  timestamp: string;
  tone: "pending" | "recovered" | "failed";
};

const RECOVERED_CANCELLATION = "Cancellation completed after the prior worker lease expired.";
const EXHAUSTED_ATTEMPTS = "Execution attempts exhausted before the prior worker lease expired.";
const CANCELLED_CHILD = "Cancelled after the parent orchestration cancellation was recovered.";
const SUPERSEDED_CHILD = "Superseded after the parent orchestration exhausted its durable attempts.";

export function readRunRecoveryNotice(run: Run, now = Date.now()): RunRecoveryNotice | null {
  const execution = run.execution;
  if (run.status === "running" && execution?.cancelRequestedAt) {
    const leaseExpired = Boolean(
      execution.leaseExpiresAt && new Date(execution.leaseExpiresAt).getTime() <= now,
    );
    return {
      kind: "cancellation-requested",
      title: "Cancellation requested",
      detail: leaseExpired
        ? "Waiting for a worker to recover the expired execution."
        : "Waiting for the active worker to stop at a safe boundary.",
      timestamp: execution.cancelRequestedAt,
      tone: "pending",
    };
  }

  if (execution?.lastError === RECOVERED_CANCELLATION && execution.finishedAt) {
    return {
      kind: "recovered-cancellation",
      title: "Recovered after worker interruption",
      detail: "The cancellation was applied durably and the expired lease was cleared.",
      timestamp: execution.finishedAt,
      tone: "recovered",
    };
  }

  if (execution?.lastError === EXHAUSTED_ATTEMPTS && execution.finishedAt) {
    return {
      kind: "attempts-exhausted",
      title: "Recovered as failed",
      detail: `The worker stopped retrying after ${execution.attempt}/${execution.maxAttempts} attempts.`,
      timestamp: execution.finishedAt,
      tone: "failed",
    };
  }

  const recoveryLog = [...run.logs].reverse().find((entry) =>
    entry.message === CANCELLED_CHILD || entry.message === SUPERSEDED_CHILD,
  );
  if (!recoveryLog) return null;
  const superseded = recoveryLog.message === SUPERSEDED_CHILD;
  return {
    kind: "superseded-child",
    title: superseded ? "Superseded child run" : "Child cancellation recovered",
    detail: superseded
      ? "The parent exhausted its durable attempts; this interrupted child will not be reused."
      : "The child was closed when the parent cancellation was recovered.",
    timestamp: recoveryLog.timestamp,
    tone: superseded ? "failed" : "recovered",
  };
}
