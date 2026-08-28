import { describe, expect, it } from "vitest";
import type { OrchestrationStatusResult } from "@atellier/shared";
import { isOrchestrationStatusSettled } from "./useOrchestrationsApi";

function makeStatus(
  status: OrchestrationStatusResult["status"],
  phase?: NonNullable<OrchestrationStatusResult["execution"]>["phase"],
): OrchestrationStatusResult {
  return {
    orchestrationRunId: "run-1",
    skillId: "atellier-build-loop",
    goal: "Validate terminal status polling.",
    status,
    ...(phase && {
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase,
        definitionHash: "hash",
        definitionSnapshot: {},
        idempotencyKey: "key",
        attempt: 1,
        maxAttempts: 3,
        nextEventSequence: 1,
        availableAt: "2026-08-25T00:00:00.000Z",
      },
    }),
    steps: [],
    activeStep: null,
    nextStep: null,
  };
}

describe("isOrchestrationStatusSettled", () => {
  it("keeps polling while a completed run still has a finalizing execution envelope", () => {
    expect(isOrchestrationStatusSettled(makeStatus("completed", "finalizing"))).toBe(false);
  });

  it("settles only after the durable execution phase is terminal", () => {
    expect(isOrchestrationStatusSettled(makeStatus("completed", "completed"))).toBe(true);
    expect(isOrchestrationStatusSettled(makeStatus("failed", "failed"))).toBe(true);
    expect(isOrchestrationStatusSettled(makeStatus("completed"))).toBe(true);
  });
});
