import { describe, expect, it } from "vitest";
import { validateAgentResponse } from "../services/agent-response-validator";

describe("agent response validator", () => {
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
