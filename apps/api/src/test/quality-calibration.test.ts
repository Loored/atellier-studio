import { createHash } from "node:crypto";
import calibration from "../../../../scripts/evaluations/quality-calibration-v1.json";
import { describe, expect, it } from "vitest";
import { evaluateArtifactQuality } from "../services/artifact-quality.service";
import { buildOperatorGoalContract } from "../services/operator-goal-contract";
import { buildOperationalCapabilityContract } from "../services/operational-contract.service";
import type { ToolHarnessService } from "../services/tool-harness.service";

type CalibrationCase = {
  id: string; family: string; expectation: "verified" | "rejected" | "unverified";
  goal: string; artifact: string; preflight?: "succeeded" | "denied";
};

const operationalContract = buildOperationalCapabilityContract({
  listCatalog: () => ({ definitions: [{ name: "runs.read", classification: "read", executionState: "available" }] }),
} as unknown as ToolHarnessService);

function preflight(goal: string, state: CalibrationCase["preflight"]) {
  if (!state) return undefined;
  const ids = [...goal.matchAll(/\b[0-9a-f]{24}\b/gi)].map((match) => match[0]);
  return {
    schemaVersion: 1 as const, goalHash: buildOperatorGoalContract(goal).goalHash, requestedRunIds: ids,
    invocation: { id: "calibration-read", status: state, inputDigest: "input", outputSummary: state, completedAt: "2026-09-17T00:00:00.000Z" },
    evidenceDigest: createHash("sha256").update(`${state}:${ids.join(",")}`).digest("hex"),
    ...(state === "succeeded" ? { records: ids.map((id) => ({ id, status: "completed" })) } : {}),
  };
}

describe("quality calibration v1 (agent-proposed labels)", () => {
  it("has 24 distinct cross-family fixtures and no human-confirmed claim", () => {
    expect(calibration.status).toBe("agent-proposed-labels-pending-human-calibration");
    expect(calibration.cases).toHaveLength(24);
    expect(new Set(calibration.cases.map((item) => item.id)).size).toBe(24);
    expect(new Set(calibration.cases.map((item) => item.family))).toEqual(new Set(["blank-template", "fact-report", "future-procedure", "test-proposal"]));
    expect(calibration.humanCalibration.status).toBe("pending");
    expect(calibration.humanCalibration.requiredCaseIds).toEqual([
      "procedure-valid-1", "procedure-valid-2", "procedure-valid-3",
      "proposal-valid-1", "proposal-valid-2", "proposal-valid-3",
    ]);
  });

  it("replays every proposed fixture through the real deterministic evaluator", () => {
    for (const item of calibration.cases as CalibrationCase[]) {
      const receipt = evaluateArtifactQuality({
        goal: item.goal, parentRunId: "calibration-parent", artifact: item.artifact,
        goalContract: buildOperatorGoalContract(item.goal), operationalContract,
        preflightRunEvidence: preflight(item.goal, item.preflight),
      });
      expect(receipt.verdict, item.id).toBe(item.expectation);
    }
  });
});
