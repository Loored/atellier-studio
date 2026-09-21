import type { Run } from "@atellier/shared";
import { describe, expect, it } from "vitest";
import { readRunRecoveryNotice } from "./run-recovery";

const now = "2026-09-15T01:50:00.000Z";

function run(patch: Partial<Run>): Run {
  return {
    id: "run-recovery",
    type: "orchestration",
    status: "running",
    logs: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
}

describe("run recovery notice", () => {
  it("distinguishes a safe-boundary cancellation wait from expired-worker recovery", () => {
    const baseExecution = {
      schemaVersion: 1 as const,
      kind: "skill-orchestration" as const,
      phase: "running" as const,
      definitionHash: "hash",
      definitionSnapshot: {},
      idempotencyKey: "key",
      attempt: 1,
      maxAttempts: 3,
      nextEventSequence: 0,
      availableAt: now,
      cancelRequestedAt: "2026-09-15T01:49:00.000Z",
    };
    expect(readRunRecoveryNotice(run({
      execution: { ...baseExecution, leaseExpiresAt: "2026-09-15T01:51:00.000Z" },
    }), Date.parse(now))?.detail).toContain("active worker");
    expect(readRunRecoveryNotice(run({
      execution: { ...baseExecution, leaseExpiresAt: "2026-09-15T01:49:30.000Z" },
    }), Date.parse(now))?.detail).toContain("recover the expired execution");
  });

  it("describes terminal parent and child recovery from durable evidence", () => {
    const parent = run({
      status: "failed",
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "failed",
        definitionHash: "hash",
        definitionSnapshot: {},
        idempotencyKey: "key",
        attempt: 3,
        maxAttempts: 3,
        nextEventSequence: 0,
        availableAt: now,
        finishedAt: now,
        lastError: "Execution attempts exhausted before the prior worker lease expired.",
      },
    });
    expect(readRunRecoveryNotice(parent)).toMatchObject({
      kind: "attempts-exhausted",
      title: "Recovered as failed",
      detail: expect.stringContaining("3/3 attempts"),
    });

    const child = run({
      type: "manual",
      status: "failed",
      logs: [{
        timestamp: now,
        level: "warn",
        message: "Superseded after the parent orchestration exhausted its durable attempts.",
      }],
    });
    expect(readRunRecoveryNotice(child)).toMatchObject({
      kind: "superseded-child",
      title: "Superseded child run",
      timestamp: now,
    });
  });
});
