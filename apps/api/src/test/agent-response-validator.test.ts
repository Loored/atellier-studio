import { describe, expect, it } from "vitest";
import {
  extractQaVerdict,
  extractRequestedArtifact,
  mergeRequestedArtifactResponses,
  mergeSemanticRequestedArtifactResponses,
  validateAgentResponse,
} from "../services/agent-response-validator";

describe("agent response validator", () => {
  it("merges an incremental requested-artifact patch with the prior artifact", () => {
    const base = [
      "## Summary", "Initial plan.", "## Requested Artifact", "### Day 1", "First day.",
      "## Risk Assessment", "Low.", "## Blockers", "Days 2 and 3.", "## QA Handoff", "Repair.",
    ].join("\n");
    const repair = [
      "## Summary", "Added missing days.", "## Requested Artifact", "### Day 2", "Second day.",
      "### Day 3", "Third day.", "## Risk Assessment", "Low.", "## Blockers", "None.",
      "## QA Handoff", "Review.",
    ].join("\n");

    const merged = mergeRequestedArtifactResponses(base, repair);
    expect(extractRequestedArtifact(merged)).toContain("### Day 1");
    expect(extractRequestedArtifact(merged)).toContain("### Day 2");
    expect(extractRequestedArtifact(merged)).toContain("### Day 3");
  });

  it("replaces corrected day entries while preserving unaffected semantic artifact days", () => {
    const base = [
      "## Summary", "Initial.", "## Requested Artifact",
      "### Day 1", "Objective: Old one.", "Risks: Missing detail.",
      "### Day 2", "Objective: Keep this day.", "Risks: Low.",
      "## Risk Assessment", "Low.", "## Blockers", "None.", "## QA Handoff", "Review.",
    ].join("\n");
    const repair = [
      "## Summary", "Corrected Day 1.", "## Requested Artifact",
      "### Day 1", "Objective: Corrected.", "Risks: Explicit risk.",
      "## Risk Assessment", "Low.", "## Blockers", "None.", "## QA Handoff", "Recheck.",
    ].join("\n");

    const artifact = extractRequestedArtifact(mergeSemanticRequestedArtifactResponses(base, repair));
    expect(artifact).toContain("Objective: Corrected.");
    expect(artifact).not.toContain("Objective: Old one.");
    expect(artifact).toContain("Objective: Keep this day.");
  });
  it("flags builder responses that reference unverified files", () => {
    const validation = validateAgentResponse({
      role: "builder",
      response: [
        "Candidate files:",
        "- apps/web/src/features/wiki/WikiView.tsx",
        "",
        "Summary:",
        "Would update the wiki view.",
        "",
        "Risk assessment:",
        "- Low",
        "",
        "Blockers:",
        "- None",
        "",
        "QA handoff:",
        "- Verify the view renders correctly.",
      ].join("\n"),
      verifiedRepoFiles: ["apps/api/src/services/wiki.service.ts"],
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "builder.unverified_referenced_file")).toBe(true);
    expect(validation.invalidReferencedFiles).toEqual(["apps/web/src/features/wiki/WikiView.tsx"]);
  });

  it("accepts grounded builder candidate files including nested paths", () => {
    const validation = validateAgentResponse({
      role: "builder",
      response: [
        "Candidate files:",
        "- apps/web/src/features/wiki/components/WikiPanel.tsx",
        "- apps/web/src/features/wiki/hooks/useWikiPanel.ts",
        "- apps/api/src/services/wiki.service.ts",
        "",
        "Summary:",
        "These files own the wiki query UI and service behavior.",
        "",
        "Risk assessment:",
        "- Low",
        "",
        "Blockers:",
        "- None",
        "",
        "QA handoff:",
        "- Verify query results and draft promotion.",
      ].join("\n"),
      verifiedRepoFiles: [
        "apps/api/src/services/wiki.service.ts",
        "apps/web/src/features/wiki/components/WikiPanel.tsx",
        "apps/web/src/features/wiki/hooks/useWikiPanel.ts",
      ],
    });

    expect(validation.passed).toBe(true);
    expect(validation.candidateFiles).toEqual([
      "apps/api/src/services/wiki.service.ts",
      "apps/web/src/features/wiki/components/WikiPanel.tsx",
      "apps/web/src/features/wiki/hooks/useWikiPanel.ts",
    ]);
    expect(validation.invalidReferencedFiles).toEqual([]);
  });

  it("accepts verified Atellier vault aliases for artifact builder responses", () => {
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      response: [
        "## Candidate Files",
        "- atelier/wiki/sources/daily-plan.md",
        "",
        "## Summary",
        "Produced the complete source-grounded operating plan.",
        "",
        "## Requested Artifact",
        "A complete operating plan with daily actions, evidence checks, human approval boundaries, and a final review checkpoint.",
        "",
        "## Risk Assessment",
        "Low risk because the artifact remains review-gated.",
        "",
        "## Blockers",
        "None.",
        "",
        "## QA Handoff",
        "Review the artifact against the linked source.",
      ].join("\n"),
      verifiedRepoFiles: ["wiki/sources/daily-plan.md"],
    });

    expect(validation.passed).toBe(true);
    expect(validation.profile).toBe("artifact-builder");
    expect(validation.invalidReferencedFiles).toEqual([]);
  });

  it("uses a runtime-specific validation contract", () => {
    const validation = validateAgentResponse({
      role: "builder",
      profile: "runtime",
      response: [
        "## Checks to Run",
        "- Inspect wiki/sources/daily-plan.md against the requested artifact.",
        "",
        "## Expected Pass/Fail Signals",
        "- Pass when the artifact is complete and grounded.",
        "",
        "## Blockers",
        "- None.",
        "",
        "## QA Handoff",
        "- Revalidate the artifact content.",
      ].join("\n"),
      verifiedRepoFiles: ["wiki/sources/daily-plan.md"],
    });

    expect(validation.passed).toBe(true);
    expect(validation.profile).toBe("runtime");
    expect(validation.issues).toHaveLength(0);
  });

  it("requires and extracts a complete requested artifact", () => {
    const response = [
      "## Summary",
      "Prepared the requested plan.",
      "",
      "## Requested Artifact",
      "# Daily plan",
      "",
      "### Day 1",
      "Capture one real source and record the review evidence.",
      "",
      "### Day 2",
      "Review the result and preserve durable memory.",
      "",
      "## Risk Assessment",
      "Low.",
      "",
      "## Blockers",
      "None.",
      "",
      "## QA Handoff",
      "Review the daily sequence.",
    ].join("\n");
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      response,
    });

    expect(validation.passed).toBe(true);
    expect(extractRequestedArtifact(response)).toContain("### Day 1");
    expect(extractRequestedArtifact(response)).toContain("### Day 2");
    expect(extractRequestedArtifact(response)).not.toContain("Risk Assessment");
  });

  it("accepts markdown-bold QA verdict labels", () => {
    const response = [
      "**Verdict:** APPROVED",
      "",
      "**Findings:**",
      "- The artifact satisfies the acceptance criteria.",
      "",
      "**Recommendation:**",
      "- Proceed to human review.",
    ].join("\n");
    const validation = validateAgentResponse({ role: "qa", response });

    expect(extractQaVerdict(response)).toBe("approved");
    expect(validation.passed).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it("rejects a numbered daily plan that collapses required days into a range", () => {
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      instruction: "Goal: Produce a practical 14-day operating plan.",
      response: [
        "## Summary",
        "Prepared the requested plan.",
        "",
        "## Requested Artifact",
        "**Day 1:** Capture one source.",
        "",
        "**Day 2-14:** Repeat the workflow.",
        "",
        "## Risk Assessment",
        "Low.",
        "",
        "## Blockers",
        "None.",
        "",
        "## QA Handoff",
        "Review all days.",
      ].join("\n"),
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "artifact-builder.incomplete_enumerated_artifact",
        severity: "error",
      }),
    ]));
  });

  it("reports exact missing fields for each required daily entry", () => {
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      instruction: "Goal: Create a 2-day plan. Each day must include objective, concrete actions, expected evidence, acceptance signal, risks, and human approval boundary.",
      response: [
        "## Summary", "Prepared.", "## Requested Artifact",
        "### Day 1", "**Objective:** Start.", "**Actions:** Work.", "**Expected Evidence:** Log.",
        "**Acceptance Signal:** Pass.", "**Risks:** Low.", "**Human Approval Boundary:** Approve before memory.",
        "### Day 2", "**Objective:** Finish.", "**Actions:** Review.", "**Expected Evidence:** Report.",
        "**Acceptance Signal:** Approved.",
        "## Risk Assessment", "Low.", "## Blockers", "None.", "## QA Handoff", "Review.",
      ].join("\n"),
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toContainEqual(expect.objectContaining({
      code: "artifact-builder.incomplete_daily_fields",
      message: expect.stringContaining("Day 2: risks, human approval boundary"),
    }));
  });

  it("does not treat a technical duration setting as a numbered plan artifact", () => {
    const response = [
      "## Summary",
      "Prepared the implementation proposal.",
      "",
      "## Requested Artifact",
      "Use the existing configuration boundary for the retention setting.",
      "",
      "## Risk Assessment",
      "Low.",
      "",
      "## Blockers",
      "None.",
      "",
      "## QA Handoff",
      "Review the configuration behavior.",
    ].join("\n");
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      instruction: "Goal: Implement a 30-day retention plan setting.",
      response,
    });

    expect(validation.passed).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });

  it("blocks an artifact builder response that only promises future work", () => {
    const validation = validateAgentResponse({
      role: "builder",
      profile: "artifact-builder",
      response: [
        "## Summary",
        "I will prepare the requested plan after reviewing the source.",
        "",
        "## Risk Assessment",
        "The source may be incomplete.",
        "",
        "## Blockers",
        "The source still needs review.",
        "",
        "## QA Handoff",
        "Wait for a later artifact.",
      ].join("\n"),
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({
        code: "artifact-builder.missing_section.requested-artifact",
        severity: "error",
      }),
    ]));
  });

  it("accepts markdown-style candidate file headings without a colon", () => {
    const validation = validateAgentResponse({
      role: "builder",
      response: [
        "Candidate files",
        "- apps/web/src/features/wiki/hooks/useWikiPanel.ts",
        "- apps/web/src/features/wiki/components/WikiPanel.tsx",
        "- apps/api/src/services/wiki.service.ts",
        "",
        "Summary",
        "These files own the query hook, UI panel, and service behavior.",
        "",
        "Risk assessment",
        "Low risk.",
        "",
        "Blockers",
        "None.",
        "",
        "QA handoff",
        "Verify the query flow.",
      ].join("\n"),
      verifiedRepoFiles: [
        "apps/api/src/services/wiki.service.ts",
        "apps/web/src/features/wiki/components/WikiPanel.tsx",
        "apps/web/src/features/wiki/hooks/useWikiPanel.ts",
      ],
    });

    expect(validation.passed).toBe(true);
    expect(validation.candidateFiles).toEqual([
      "apps/api/src/services/wiki.service.ts",
      "apps/web/src/features/wiki/components/WikiPanel.tsx",
      "apps/web/src/features/wiki/hooks/useWikiPanel.ts",
    ]);
  });

  it("flags unverified builder paths mentioned outside the candidate section", () => {
    const validation = validateAgentResponse({
      role: "builder",
      response: [
        "Candidate files:",
        "- apps/api/src/services/wiki.service.ts",
        "",
        "Summary:",
        "Use the existing wiki service.",
        "",
        "Risk assessment:",
        "- Low",
        "",
        "Blockers:",
        "- apps/api/src/services/wiki-query.service.ts may not exist.",
        "",
        "QA handoff:",
        "- Verify no fallback service is required.",
      ].join("\n"),
      verifiedRepoFiles: ["apps/api/src/services/wiki.service.ts"],
    });

    expect(validation.passed).toBe(false);
    expect(validation.invalidReferencedFiles).toEqual(["apps/api/src/services/wiki-query.service.ts"]);
  });

  it("warns when builder uses changed files without execution evidence", () => {
    const validation = validateAgentResponse({
      role: "builder",
      response: [
        "Changed files:",
        "- apps/api/src/services/wiki.service.ts",
        "",
        "Summary:",
        "Would adjust query behavior.",
        "",
        "Risk assessment:",
        "- Low",
        "",
        "Blockers:",
        "- None",
        "",
        "QA handoff:",
        "- Verify query behavior.",
      ].join("\n"),
      verifiedRepoFiles: ["apps/api/src/services/wiki.service.ts"],
    });

    expect(validation.passed).toBe(true);
    expect(validation.issues.some((issue) => issue.code === "builder.changed_files_without_execution")).toBe(true);
  });

  it("flags QA responses that claim implementation work", () => {
    const validation = validateAgentResponse({
      role: "qa",
      response: [
        "Verdict: APPROVED",
        "",
        "Findings:",
        "- Implemented a quick fix to the UI.",
        "",
        "Recommendation:",
        "- Ship it.",
      ].join("\n"),
    });

    expect(validation.passed).toBe(false);
    expect(validation.issues.some((issue) => issue.code === "qa.claims_implementation")).toBe(true);
  });

  it("accepts a pm response with the required sections", () => {
    const validation = validateAgentResponse({
      role: "pm",
      response: [
        "Scope:",
        "- Small wiki query improvement.",
        "",
        "Approach:",
        "- Use the existing query flow.",
        "",
        "Acceptance criteria:",
        "- Returns grounded files only.",
        "",
        "Handoff:",
        "- Builder can implement safely.",
      ].join("\n"),
    });

    expect(validation.passed).toBe(true);
    expect(validation.issues).toHaveLength(0);
  });
});
