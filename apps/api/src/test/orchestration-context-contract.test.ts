import { describe, expect, it } from "vitest";
import {
  latestArtifactReference,
  ORCHESTRATION_CONTEXT_CONTRACT,
  renderStepContextReference,
  selectBoundedStepContext,
  truncateOrchestrationContext,
  type OrchestrationStepContextReference,
} from "../services/orchestration-context-contract";

function reference(patch: Partial<OrchestrationStepContextReference> = {}): OrchestrationStepContextReference {
  return {
    stepId: "scope",
    label: "Scope the work",
    agentName: "Pepe PM",
    agentRole: "pm",
    runId: "run-scope",
    response: "Acceptance criteria:\n- One bounded criterion.",
    validationFeedback: [],
    isArtifact: false,
    ...patch,
  };
}

describe("orchestration context contract", () => {
  it("publishes explicit char and token units with the established limits", () => {
    expect(ORCHESTRATION_CONTEXT_CONTRACT).toMatchObject({
      schemaVersion: 1,
      limits: {
        previousStepsTotalChars: 24_000,
        ordinaryStepResponseChars: 1_200,
        artifactStepResponseChars: 16_000,
        qaArtifactChars: 7_000,
      },
      outputTokens: { artifactBuilder: 2_048, semanticRepair: 1_024 },
    });
  });

  it("renders structured metadata only at the final prompt boundary", () => {
    expect(renderStepContextReference(reference({
      validationFeedback: ["- [warn] Evidence is incomplete."],
    }))).toBe([
      "## Scope the work",
      "Agent: Pepe PM (pm)",
      "Run: run-scope",
      "Acceptance criteria:\n- One bounded criterion.",
      "Validation feedback:",
      "- [warn] Evidence is incomplete.",
    ].join("\n"));
  });

  it("keeps the newest context within the total budget and selects artifacts by metadata", () => {
    const old = reference({ response: "o".repeat(30_000) });
    const artifact = reference({
      stepId: "custom-build-label",
      label: "A label that contains no artifact keyword",
      runId: "run-artifact",
      response: "## Requested Artifact\nusable",
      isArtifact: true,
    });
    const bounded = selectBoundedStepContext([old, artifact]);
    expect(bounded.length).toBeLessThanOrEqual(ORCHESTRATION_CONTEXT_CONTRACT.limits.previousStepsTotalChars);
    expect(bounded).toContain("run-artifact");
    expect(bounded.length).toBe(ORCHESTRATION_CONTEXT_CONTRACT.limits.previousStepsTotalChars);
    expect(bounded).toContain(ORCHESTRATION_CONTEXT_CONTRACT.truncationNotice);
    expect(latestArtifactReference([old, artifact])?.runId).toBe("run-artifact");
  });

  it("uses one stable truncation marker", () => {
    expect(truncateOrchestrationContext("abcdef", 3)).toBe(
      "abc\n[truncated for orchestration context]",
    );
  });
});
