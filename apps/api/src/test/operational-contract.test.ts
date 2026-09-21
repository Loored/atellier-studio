import { describe, expect, it } from "vitest";
import type { ToolHarnessService } from "../services/tool-harness.service";
import { buildOperationalCapabilityContract, findUnsupportedOperationalIdentifiers } from "../services/operational-contract.service";

const toolHarness = {
  listCatalog: () => ({
    definitions: [
      { name: "runs.read", classification: "read", executionState: "available" },
      { name: "workspace.read", classification: "read", executionState: "available" },
      { name: "workspace.preview", classification: "write", executionState: "available" },
    ],
  }),
} as unknown as ToolHarnessService;

describe("operational capability contract", () => {
  it("derives current states and readable receipt fields from shared authority", () => {
    const contract = buildOperationalCapabilityContract(toolHarness);
    expect(contract.runStatuses).toContain("completed");
    expect(contract.reviewStatuses).toContain("changes-requested");
    expect(contract.orchestrationReadiness).toContain("ready-for-human-review");
    expect(contract.publicRunReceiptFields).toContain("deterministicRepairCount");
    expect(contract.readTools).toEqual(["runs.read", "workspace.read"]);
  });

  it("flags unverified technical fields and queue states without rejecting a stated hypothesis", () => {
    const contract = buildOperationalCapabilityContract(toolHarness);
    expect(findUnsupportedOperationalIdentifiers(
      "Inspect parentOrchestrationRunId and qaBlockers, then move it to awaiting_operator_decision.",
      contract,
    )).toEqual(["awaiting_operator_decision", "parentOrchestrationRunId", "qaBlockers"]);
    expect(findUnsupportedOperationalIdentifiers(
      "A proposed field `candidateReviewState` could exist in a future design.",
      contract,
    )).toEqual([]);
    expect(findUnsupportedOperationalIdentifiers(
      "Un campo propuesto `candidateReviewState` podría existir en un diseño futuro.",
      contract,
    )).toEqual([]);
  });
});
