import type { AgentValidationIssue, AgentValidationResult, AgentRole } from "@atellier/shared";

type ValidationInput = {
  role: AgentRole;
  response: string;
  verifiedRepoFiles?: string[];
};

const SECTION_PATTERNS: Record<AgentRole, string[]> = {
  builder: ["candidate files", "summary", "risk assessment", "blockers", "qa handoff"],
  pm: ["scope", "approach", "acceptance criteria", "handoff"],
  qa: ["verdict", "findings", "recommendation"],
  designer: ["component references", "layout", "interaction model", "builder notes"],
  "wiki-curator": ["pages created", "pages updated", "log entry", "contradictions"],
  intake: ["source type", "key facts", "implied tasks", "handoff note"],
};

const IMPLEMENTATION_VERBS = ["implemented", "edited", "updated", "changed", "modified", "added", "fixed"];

export function validateAgentResponse(input: ValidationInput): AgentValidationResult {
  const response = input.response.trim();
  const normalizedResponse = response.toLowerCase();
  const verifiedRepoFiles = dedupeSorted(input.verifiedRepoFiles ?? []);
  const changedFiles = extractChangedFiles(response);
  const candidateFiles = extractSectionFiles(response, "candidate files");
  const referencedFiles = extractReferencedFiles(response);
  const filesToValidate = input.role === "builder"
    ? dedupeSorted([...candidateFiles, ...changedFiles, ...referencedFiles])
    : [];
  const invalidReferencedFiles = verifiedRepoFiles.length > 0
    ? filesToValidate.filter((candidate) => !verifiedRepoFiles.includes(candidate))
    : [];
  const issues: AgentValidationIssue[] = [];

  for (const section of SECTION_PATTERNS[input.role] ?? []) {
    if (!normalizedResponse.includes(section)) {
      issues.push({
        code: `${input.role}.missing_section.${slug(section)}`,
        severity: "warn",
        message: `Missing expected ${section} section.`,
      });
    }
  }

  if (input.role === "builder") {
    if (candidateFiles.length === 0 && changedFiles.length === 0 && IMPLEMENTATION_VERBS.some((verb) => normalizedResponse.includes(verb))) {
      issues.push({
        code: "builder.missing_candidate_files",
        severity: "error",
        message: "Builder response describes implementation work but does not list candidate files.",
      });
    }

    if (changedFiles.length > 0) {
      issues.push({
        code: "builder.changed_files_without_execution",
        severity: "warn",
        message: "Builder used Changed files, but this executor only proposes work. Use Candidate files unless a real diff exists.",
      });
    }

    for (const filePath of invalidReferencedFiles) {
      issues.push({
        code: "builder.unverified_referenced_file",
        severity: "error",
        message: `Builder referenced an unverified file: ${filePath}`,
      });
    }
  }

  if (input.role === "qa") {
    if (IMPLEMENTATION_VERBS.some((verb) => normalizedResponse.includes(verb))) {
      issues.push({
        code: "qa.claims_implementation",
        severity: "error",
        message: "QA output should not claim implementation changes.",
      });
    }
    if (!/verdict\s*:\s*(approved|changes requested)/i.test(response)) {
      issues.push({
        code: "qa.missing_verdict",
        severity: "error",
        message: "QA output must include an explicit verdict.",
      });
    }
  }

  if (input.role === "pm" && !/acceptance criteria/i.test(response)) {
    issues.push({
      code: "pm.missing_acceptance_criteria",
      severity: "error",
      message: "PM output must include acceptance criteria.",
    });
  }

  if (input.role === "designer" && !/builder notes/i.test(response)) {
    issues.push({
      code: "designer.missing_builder_notes",
      severity: "error",
      message: "Designer output must include builder notes.",
    });
  }

  if (input.role === "wiki-curator" && !/wiki log entry|log entry drafted/i.test(response)) {
    issues.push({
      code: "wiki-curator.missing_log_entry",
      severity: "warn",
      message: "Wiki curator output should explicitly mention the log entry.",
    });
  }

  if (input.role === "intake" && !/raw source/i.test(response)) {
    issues.push({
      code: "intake.missing_raw_source",
      severity: "warn",
      message: "Intake output should mention that the raw source was preserved.",
    });
  }

  return {
    role: input.role,
    passed: issues.every((issue) => issue.severity !== "error"),
    issues,
    verifiedRepoFiles,
    invalidReferencedFiles,
    referencedFiles,
    candidateFiles,
    changedFiles,
  };
}

function extractChangedFiles(response: string): string[] {
  return extractSectionFiles(response, "changed files");
}

function extractSectionFiles(response: string, sectionName: string): string[] {
  const lines = response.split(/\r?\n/);
  const sectionPattern = new RegExp(`^#{0,6}\\s*${escapeRegExp(sectionName)}\\s*:??\\s*$`, "i");
  const startIndex = lines.findIndex((line) => sectionPattern.test(line.trim()));
  if (startIndex < 0) {
    return [];
  }

  const files: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]?.trim();
    if (!line) {
      if (files.length > 0) {
        break;
      }
      continue;
    }
    if (/^#{0,6}\s*[A-Za-z][A-Za-z\s-]+:?\s*$/.test(line) && !/^-\s+/.test(line)) {
      break;
    }
    const match = line.match(/^-\s+(.+)$/);
    if (match?.[1]) {
      files.push(extractFirstPath(match[1]) ?? cleanFilePath(match[1]));
      continue;
    }
    if (files.length > 0) {
      break;
    }
  }

  return dedupeSorted(files);
}

function extractReferencedFiles(response: string): string[] {
  return dedupeSorted(
    Array.from(response.matchAll(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+/g)).map((match) =>
      cleanFilePath(match[0]),
    ),
  );
}

function cleanFilePath(value: string): string {
  return value.trim().replace(/^[`'"]+|[`'",.)\]]+$/g, "");
}

function extractFirstPath(value: string): string | null {
  const match = value.match(/(?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.[A-Za-z0-9]+/);
  return match ? cleanFilePath(match[0]) : null;
}

function dedupeSorted(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
