import { describe, expect, it } from "vitest";
import { buildOperatorGoalContract, explicitRunEvidenceRequest, missingOperatorSections, planUsesOwnRunAsExistingEvidence, qaPassEvidenceIsCurrentArtifact } from "../services/operator-goal-contract";

describe("operator goal authority contract", () => {
  it("preserves every frozen stress-case constraint without accepting PM criteria as authority", () => {
    const bytes = readFileSync(new URL("../../../../scripts/evaluations/2026-09-16-varied-build-loop.json", import.meta.url));
    expect(createHash("sha256").update(bytes).digest("hex")).toBe("2b298dcbb9f578f84d21a0e5734306b194b20a5e504d7ba4727fed1132409e46");
    const matrix = JSON.parse(bytes.toString("utf8")) as { cases: { id: string; goal: string }[] };
    expect(matrix.cases).toHaveLength(8);
    for (const item of matrix.cases) {
      const contract = buildOperatorGoalContract(item.goal);
      expect(contract.explicitConstraints, item.id).toBe(true);
      const joined = contract.criteria.join(" ");
      for (const prohibition of item.goal.match(/Do not [^.!?]+/gi) ?? []) {
        expect(joined, item.id).toContain(prohibition);
      }
      if (item.id === "document-memory-decision") {
        expect(contract.requiredSections).toEqual(["Eligibility", "Evidence to check", "Human approval", "Rejection or contradiction handling"]);
      }
    }
  });
  it("derives frozen day count and fields only from the current goal", () => {
    const contract = buildOperatorGoalContract("Create a 3-day plan. Each day needs Objective, Actions, Observable success signal, and Risk.");
    expect(contract).toMatchObject({ schemaVersion: 3, numberedArtifact: true, artifactKind: "future-procedure" });
    expect(contract.criteria[0]).toContain("exactly 3 explicit Day entries");
    expect(contract.criteria[1]).toContain("Objective, Actions, Observable success signal, Risk");
    expect(contract.criteria.join(" ")).not.toContain("context pack");
  });

  it("keeps explicit negative requirements even for a numbered plan", () => {
    const contract = buildOperatorGoalContract("Create a 2-day plan. Day 1 must inspect existing runs. Do not simulate a failure or claim a review happened.");
    expect(contract.criteria.join(" ")).toContain("Do not simulate a failure");
    expect(contract.criteria.join(" ")).toContain("inspect existing runs");
  });

  it("detects the current orchestration masquerading as an existing incident queue", () => {
    const goal = "Prepare a 2-day plan for existing blocked runs.";
    expect(planUsesOwnRunAsExistingEvidence(goal, "Day 1: Query parent run 6aab-test instead of the queue.", "6aab-test")).toBe(true);
    expect(planUsesOwnRunAsExistingEvidence(goal, "Day 1: Inspect the actual blocked run queue.", "6aab-test")).toBe(false);
    expect(planUsesOwnRunAsExistingEvidence("Diagnose this orchestration run.", "Run 6aab-test is blocked.", "6aab-test")).toBe(false);
  });

  it("does not let the PM replace unnumbered operator requirements and checks requested headings", () => {
    const contract = buildOperatorGoalContract("Draft a guide. Include Eligibility, Evidence to check, Human approval, and Rejection or contradiction handling. Do not promote any run.");
    expect(contract.numberedArtifact).toBe(false);
    expect(contract.criteria.join(" ")).toContain("Do not promote any run");
    expect(contract.requiredSections).toEqual(["Eligibility", "Evidence to check", "Human approval", "Rejection or contradiction handling"]);
    expect(missingOperatorSections(contract, "## Eligibility\n## Evidence to check\n## Human approval")).toEqual(["Rejection or contradiction handling"]);
    expect(missingOperatorSections(contract, "## Eligibility\n## Evidence to check\n## Human approval\n## Rejection or contradiction handling")).toEqual([]);
  });

  it("preserves stable, operator-sourced requirements and explicit prohibitions", () => {
    const contract = buildOperatorGoalContract("Create a blank incident review template with Summary, Verified evidence, Open questions, and Operator decision sections. Leave incident IDs empty. Do not state that a worker crashed.");
    expect(contract.artifactKind).toBe("blank-template");
    expect(contract.requirements.map((requirement) => requirement.id)).toEqual(
      contract.requirements.map((_, index) => `AC-${index + 1}`),
    );
    expect(contract.requirements.every((requirement) => requirement.source === "operator")).toBe(true);
    expect(contract.requiredSections).toEqual(["Summary", "Verified evidence", "Open questions", "Operator decision"]);
    expect(contract.prohibitions).toEqual(["Do not state that a worker crashed."]);
    expect(missingOperatorSections(contract, "## Summary\n## Verified evidence\n## Open questions\n## Operator decision")).toEqual([]);
  });

  it("recognizes Spanish requested sections without treating ordinary prose as headings", () => {
    const spanish = buildOperatorGoalContract("Crea una plantilla vacía con Resumen, Evidencia verificada, Preguntas abiertas y Decisión del operador. No inventes incidentes.");
    expect(spanish.artifactKind).toBe("blank-template");
    expect(spanish.requiredSections).toEqual(["Resumen", "Evidencia verificada", "Preguntas abiertas", "Decisión del operador"]);
    expect(spanish.prohibitions).toEqual(["No inventes incidentes."]);
    expect(missingOperatorSections(spanish, "## Resumen\n## Evidencia verificada\n## Preguntas abiertas\n## Decisión del operador")).toEqual([]);

    const prose = buildOperatorGoalContract("Draft a guide with no source claims until evidence is available.");
    expect(prose.requiredSections).toEqual([]);
  });

  it("acquires preflight receipts only for a bounded explicit run comparison", () => {
    expect(explicitRunEvidenceRequest("Compare current receipts for runs 6aaa3f0c4a2d67773e7c785c and 6aaa40d24a2d67773e7c7892.")).toEqual([
      "6aaa3f0c4a2d67773e7c785c", "6aaa40d24a2d67773e7c7892",
    ]);
    expect(explicitRunEvidenceRequest("Mention run 6aaa3f0c4a2d67773e7c785c in a future plan.")).toBeNull();
    expect(explicitRunEvidenceRequest("Compare runs 6aaa3f0c4a2d67773e7c785c, 6aaa40d24a2d67773e7c7892, and 6aaa425e5b8818dbfd4bfd12.")).toBeNull();
  });

  it("rejects a PASS justified by historical context-pack evidence", () => {
    const artifact = "Day 1: Capture a source and record an acceptance signal. Day 2: Execute a bounded task. Day 3: Review the deliverable.";
    expect(qaPassEvidenceIsCurrentArtifact("Write to raw/ingest/context-pack.md failed with EACCES permission denied.", artifact)).toBe(false);
    expect(qaPassEvidenceIsCurrentArtifact("The bounded task and acceptance signal appear in this operating plan.", artifact)).toBe(true);
  });

  it("recognizes QA evidence naming the current artifact's explicit Day headings", () => {
    const artifact = "#### Day 1\n**Objective:** Review one run.\n#### Day 2\n**Actions:** Inspect logs.\n#### Day 3\n**Risk:** Missing evidence.";
    expect(qaPassEvidenceIsCurrentArtifact(
      'The artifact explicitly lists headers for "#### Day 1", "#### Day 2", and "#### Day 3" with no additional day entries.',
      artifact,
    )).toBe(true);
    expect(qaPassEvidenceIsCurrentArtifact(
      "Historical context-pack headers list Day 1, Day 2, and Day 3.",
      artifact,
    )).toBe(false);
    expect(qaPassEvidenceIsCurrentArtifact(
      "The memory source lists headers for Day 1, Day 2, and Day 3.",
      "This artifact mentions Day 1, Day 2, Day 3 without actual headings.",
    )).toBe(false);
  });
});
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
