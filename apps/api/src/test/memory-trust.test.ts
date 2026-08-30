import { describe, expect, it } from "vitest";
import { classifyMemoryTrust } from "../services/memory-trust.service";

describe("memory trust contract", () => {
  it("keeps immutable raw input as evidence rather than semantic truth", () => {
    expect(classifyMemoryTrust("raw/ingest/client-brief.md", "# Client brief")).toEqual({
      layer: "raw",
      state: "immutable-source",
      authority: "evidence-only",
      provenancePaths: ["raw/ingest/client-brief.md"],
      reason: "Immutable source evidence; preserve verbatim and interpret through reviewed memory.",
    });
  });

  it("marks generated source summaries as context with raw provenance", () => {
    expect(classifyMemoryTrust(
      "wiki/sources/client-brief.md",
      "# Summary\n\n- Raw path: raw/ingest/client-brief.md\n",
    )).toMatchObject({
      layer: "semantic",
      state: "generated",
      authority: "context-only",
      provenancePaths: ["raw/ingest/client-brief.md"],
    });
  });

  it("trusts only approved synthesis pages", () => {
    expect(classifyMemoryTrust(
      "wiki/synthesis/run-1.md",
      "# Run Memory\n\n- Review: approved\n- Deliverable: wiki/deliverables/run-1.md\n",
    )).toMatchObject({
      layer: "semantic",
      state: "verified",
      authority: "trusted",
      provenancePaths: ["wiki/deliverables/run-1.md"],
    });
    expect(classifyMemoryTrust(
      "wiki/synthesis/run-2.md",
      "# Run Memory\n\n- Review: pending\n",
    )).toMatchObject({ state: "generated", authority: "context-only" });
  });

  it("treats role learning and recorded decisions as verified", () => {
    expect(classifyMemoryTrust("wiki/role-memory/qa.md", "# Role Memory")).toMatchObject({
      layer: "learning",
      state: "verified",
      authority: "trusted",
    });
    expect(classifyMemoryTrust("wiki/decisions/decision.md", "- Decision: rejected")).toMatchObject({
      layer: "semantic",
      state: "verified",
      authority: "trusted",
    });
  });

  it("fails closed for generated deliverables, dreams, and unknown pages", () => {
    expect(classifyMemoryTrust("wiki/deliverables/run.md", "- Review: pending")).toMatchObject({
      layer: "episodic",
      state: "generated",
      authority: "context-only",
    });
    expect(classifyMemoryTrust("wiki/dreams/report.md", "# Dream")).toMatchObject({
      layer: "episodic",
      state: "generated",
      authority: "context-only",
    });
    expect(classifyMemoryTrust("wiki/index.md", "# Index")).toMatchObject({
      layer: "semantic",
      state: "generated",
      authority: "context-only",
    });
  });
});
