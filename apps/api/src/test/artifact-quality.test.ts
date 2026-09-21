import { describe, expect, it } from "vitest";
import { evaluateArtifactQuality } from "../services/artifact-quality.service";
import { buildOperatorGoalContract } from "../services/operator-goal-contract";
import { buildOperationalCapabilityContract } from "../services/operational-contract.service";
import type { ToolHarnessService } from "../services/tool-harness.service";

const operationalContract = buildOperationalCapabilityContract({
  listCatalog: () => ({ definitions: [{ name: "runs.read", classification: "read", executionState: "available" }] }),
} as unknown as ToolHarnessService);

describe("artifact quality receipt", () => {
  it("verifies a requested blank template without requiring invented incident facts", () => {
    const goal = "Create a blank incident review template with Summary, Verified evidence, Open questions, and Operator decision sections. Leave incident IDs empty. Do not state that a worker crashed.";
    const receipt = evaluateArtifactQuality({
      goal,
      parentRunId: "parent",
      artifact: "## Summary\n---\n## Verified evidence\n---\n## Open questions\n---\n## Operator decision\n---",
      goalContract: buildOperatorGoalContract(goal),
      operationalContract,
    });
    expect(receipt.verdict).toBe("verified");
    expect(receipt.findings).toEqual([]);
  });

  it("rejects invented operational identifiers even when another checklist says PASS", () => {
    const goal = "Write a plan for existing review runs. Do not approve any run.";
    const receipt = evaluateArtifactQuality({
      goal,
      parentRunId: "parent",
      artifact: "Inspect qaBlockers, then set awaiting_operator_decision for each item.",
      goalContract: buildOperatorGoalContract(goal),
      operationalContract,
    });
    expect(receipt.verdict).toBe("rejected");
    expect(receipt.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "unsupported-operational-identifier" }),
    ]));
  });

  it("keeps a factual report unverified when its preflight receipt is absent", () => {
    const goal = "Compare current receipts for runs 6aaa3f0c4a2d67773e7c785c and 6aaa40d24a2d67773e7c7892.";
    const receipt = evaluateArtifactQuality({
      goal,
      parentRunId: "parent",
      artifact: "Both receipts are unverified.",
      goalContract: buildOperatorGoalContract(goal),
      operationalContract,
    });
    expect(receipt.verdict).toBe("unverified");
    expect(receipt.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "evidence-unavailable" }),
    ]));
  });

  it("rejects a factual report that names receipts without grounding each claim", () => {
    const goal = "Compare current receipts for runs 6aaa3f0c4a2d67773e7c785c and 6aaa40d24a2d67773e7c7892.";
    const receipt = evaluateArtifactQuality({
      goal,
      parentRunId: "parent",
      artifact: "Run 6aaa3f0c4a2d67773e7c785c is ready. Run 6aaa40d24a2d67773e7c7892 is blocked.",
      goalContract: buildOperatorGoalContract(goal),
      operationalContract,
      preflightRunEvidence: {
        requestedRunIds: ["6aaa3f0c4a2d67773e7c785c", "6aaa40d24a2d67773e7c7892"],
        invocation: { status: "succeeded" },
        records: [],
        evidenceDigest: "test",
      } as never,
    });
    expect(receipt.verdict).toBe("rejected");
    expect(receipt.findings).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "receipt-grounding-missing" }),
    ]));
  });

  it("verifies a factual report when every named receipt is explicitly grounded", () => {
    const goal = "Compare current receipts for runs 6aaa3f0c4a2d67773e7c785c and 6aaa40d24a2d67773e7c7892.";
    const receipt = evaluateArtifactQuality({
      goal,
      parentRunId: "parent",
      artifact: [
        "Receipt 6aaa3f0c4a2d67773e7c785c: status is reported only from the server-acquired receipt.",
        "Receipt 6aaa40d24a2d67773e7c7892: readiness is unverified because the field is absent from its receipt.",
      ].join("\n"),
      goalContract: buildOperatorGoalContract(goal),
      operationalContract,
      preflightRunEvidence: {
        requestedRunIds: ["6aaa3f0c4a2d67773e7c785c", "6aaa40d24a2d67773e7c7892"],
        invocation: { status: "succeeded" },
        records: [],
        evidenceDigest: "test",
      } as never,
    });
    expect(receipt.verdict).toBe("verified");
    expect(receipt.findings).toEqual([]);
  });
});
