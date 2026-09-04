import { describe, expect, it } from "vitest";
import {
  extractAcceptanceCriteria,
  extractContextReceiptSourceCitations,
  extractQaChecklist,
  findMissingQaCriteria,
  extractQaFeedbackSignature,
  extractQaVerdict,
  extractRequestedArtifact,
  isQaFeedbackRepeated,
  mergeRequestedArtifactResponses,
  mergeSemanticRequestedArtifactResponses,
  qaChecklistCoversCriteria,
  validateAgentResponse,
} from "../services/agent-response-validator";

describe("agent response validator", () => {
  it("extracts only explicit Sources Used declarations", () => {
    const response = [
      "## Requested Artifact",
      "A path in prose such as raw/not-a-citation.md does not count.",
      "",
      "### Sources Used",
      "- raw/brief.md",
      "- wiki/role-memory/builder.md",
      "",
      "## Risk Assessment",
      "- None.",
    ].join("\n");
    expect(extractContextReceiptSourceCitations(response)).toEqual([
      "raw/brief.md",
      "wiki/role-memory/builder.md",
    ]);
  });

  it("extracts acceptance evidence and detects materially repeated QA findings", () => {
    expect(extractAcceptanceCriteria([
      "* **Acceptance Criteria**:",
      "  1. Artifact is complete.",
      "  2. Human boundary is explicit.",
      "* **Handoff**:",
      "Proceed.",
    ].join("\n"))).toEqual(["Artifact is complete.", "Human boundary is explicit."]);
    expect(extractQaChecklist([
      "Verdict: CHANGES REQUESTED",
      "Acceptance Checklist:",
      "- [PASS] Artifact is complete — Evidence: Three days are present.",
      "- [FAIL] Human boundary is explicit",
      "  Evidence: Approver is unnamed.",
      "Findings:",
      "The final human approver is still unnamed.",
    ].join("\n"))).toHaveLength(2);
    const first = extractQaFeedbackSignature("Findings:\nThe final human approver is still unnamed.");
    const paraphrase = extractQaFeedbackSignature("Findings:\nThe final human approver remains unnamed.");
    expect(isQaFeedbackRepeated(first, paraphrase)).toBe(true);
    expect(isQaFeedbackRepeated(first, "durable wiki memory is missing")).toBe(false);
  });

  it("does not treat passive implementation wording as a QA implementation claim", () => {
    const validation = validateAgentResponse({
      role: "qa",
      response: [
        "Verdict: CHANGES REQUESTED",
        "Findings:",
        "The artifact does not explain how the plan will be implemented and tracked.",
        "Recommendation:",
        "Add concrete evidence.",
      ].join("\n"),
    });
    expect(validation.issues.some((issue) => issue.code === "qa.claims_implementation")).toBe(false);
  });

  it("extracts Ollama's numbered criterion with a nested checklist result", () => {
    const checklist = extractQaChecklist([
      "Acceptance Checklist:",
      "1. The plan includes a clear objective for each day.",
      "\t* [FAIL] Evidence: Stakeholder approval is missing.",
      "2. Concrete actions are specified for each day.",
      "\t* [PASS] Evidence: Every day lists concrete actions.",
      "Findings:",
      "Stakeholder approval is missing.",
    ].join("\n"));

    expect(checklist).toEqual([
      {
        criterion: "The plan includes a clear objective for each day.",
        status: "fail",
        evidence: "Stakeholder approval is missing.",
      },
      {
        criterion: "Concrete actions are specified for each day.",
        status: "pass",
        evidence: "Every day lists concrete actions.",
      },
    ]);
  });

  it("accepts a nested evidence line that remains a Markdown bullet", () => {
    expect(extractQaChecklist([
      "Acceptance Checklist:",
      "- [PASS] The human approval boundary is named.",
      "  - Evidence: A human reviewer is explicitly named.",
      "Findings:",
      "None.",
    ].join("\n"))).toEqual([
      {
        criterion: "The human approval boundary is named.",
        status: "pass",
        evidence: "A human reviewer is explicitly named.",
      },
    ]);
  });

  it("requires the checklist to cover the actual scope criteria", () => {
    const criteria = ["Artifact is complete.", "Human boundary is explicit."];
    expect(qaChecklistCoversCriteria([
      { criterion: "Artifact is complete" },
      { criterion: "Human boundary is explicit" },
    ], criteria)).toBe(true);
    expect(qaChecklistCoversCriteria([
      { criterion: "Artifact is complete" },
      { criterion: "A different criterion" },
    ], criteria)).toBe(false);
    expect(findMissingQaCriteria([
      { criterion: "Artifact is complete" },
    ], criteria)).toEqual(["Human boundary is explicit."]);
  });

  it("combines checklist entries emitted in a targeted completion response", () => {
    const checklist = extractQaChecklist([
      "Verdict: APPROVED",
      "Acceptance Checklist:",
      "- [PASS] Artifact is complete. — Evidence: The full artifact is present.",
      "",
      "Acceptance Checklist:",
      "- [PASS] Human boundary is explicit. — Evidence: A reviewer is named.",
      "Findings:",
      "None.",
    ].join("\n"));

    expect(qaChecklistCoversCriteria(checklist, ["Artifact is complete.", "Human boundary is explicit."])).toBe(true);
  });

  it("extracts criteria under a numbered PM section heading", () => {
    expect(extractAcceptanceCriteria([
      "2. Approach: keep the slice bounded",
      "3. Acceptance criteria:",
      "   - Existing tests remain green",
      "   - New behavior matches the specification",
      "4. Handoff: proceed to Builder",
    ].join("\n"))).toEqual([
      "Existing tests remain green",
      "New behavior matches the specification",
    ]);
  });

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

  it("accepts a Spanish QA verdict and evidence checklist from the local model", () => {
    const response = [
      "## Veredicto: CAMBIOS SOLICITADOS",
      "",
      "## Lista de verificación de aceptación",
      "- [PASS] La nota contiene tres comprobaciones. — Evidencia: Se enumeran tres comprobaciones.",
      "- [FAIL] La decisión humana está nombrada. — Evidencia: Falta un responsable.",
      "",
      "## Hallazgos",
      "- Falta nombrar al responsable de la aprobación.",
      "",
      "## Recomendación",
      "- Añadir el responsable y volver a validar.",
    ].join("\n");

    expect(extractQaVerdict(response)).toBe("changes-requested");
    expect(extractQaChecklist(response)).toEqual([
      expect.objectContaining({ criterion: "La nota contiene tres comprobaciones.", status: "pass" }),
      expect.objectContaining({ criterion: "La decisión humana está nombrada.", status: "fail" }),
    ]);
    expect(extractQaFeedbackSignature(response)).toContain("falta nombrar al responsable");
  });

  it("accepts a standalone Spanish verdict heading followed by its status", () => {
    const response = [
      "## Veredicto",
      "**CAMBIOS SOLICITADOS** (CHANGES REQUESTED)",
    ].join("\n");

    expect(extractQaVerdict(response)).toBe("changes-requested");
  });

  it("extracts numbered Spanish PM acceptance criteria", () => {
    const response = [
      "## 3. Criterios de Aceptación",
      "1. La fuente queda citada.",
      "2. La decisión humana queda explícita.",
    ].join("\n");

    expect(extractAcceptanceCriteria(response)).toEqual([
      "La fuente queda citada.",
      "La decisión humana queda explícita.",
    ]);
    expect(validateAgentResponse({ role: "pm", response }).issues).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ code: "pm.missing_acceptance_criteria" }),
    ]));
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
