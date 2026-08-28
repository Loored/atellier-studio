import type {
  AgentRole,
  AgentValidationIssue,
  AgentValidationProfile,
  AgentValidationResult,
} from "@atellier/shared";

type ValidationInput = {
  role: AgentRole;
  profile?: AgentValidationProfile;
  instruction?: string;
  response: string;
  verifiedRepoFiles?: string[];
};

const SECTION_PATTERNS: Record<AgentValidationProfile, string[]> = {
  builder: ["candidate files", "summary", "risk assessment", "blockers", "qa handoff"],
  "artifact-builder": ["summary", "requested artifact", "risk assessment", "blockers", "qa handoff"],
  runtime: ["checks to run", "expected pass/fail signals", "blockers", "qa handoff"],
  orchestration: [],
  pm: ["scope", "approach", "acceptance criteria", "handoff"],
  qa: ["verdict", "findings", "recommendation"],
  designer: ["component references", "layout", "interaction model", "builder notes"],
  "wiki-curator": ["pages created", "pages updated", "log entry", "contradictions"],
  intake: ["source type", "key facts", "implied tasks", "handoff note"],
};

const IMPLEMENTATION_VERBS = ["implemented", "edited", "updated", "changed", "modified", "added", "fixed"];
const QA_IMPLEMENTATION_CLAIM_PATTERN = /(?:^|\n)\s*(?:[-*]\s*)?(?:(?:i|we)\s+)?(?:implemented|edited|updated|changed|modified|added|fixed)\b/i;

export function validateAgentResponse(input: ValidationInput): AgentValidationResult {
  const response = input.response.trim();
  const normalizedResponse = response.toLowerCase();
  const profile = input.profile ?? input.role;
  const verifiedRepoFiles = dedupeSorted(input.verifiedRepoFiles ?? []);
  const verifiedFileKeys = new Set(verifiedRepoFiles.map(canonicalFileKey));
  const changedFiles = extractChangedFiles(response);
  const candidateFiles = extractSectionFiles(response, "candidate files");
  const referencedFiles = extractReferencedFiles(response);
  const validatesFileReferences = ["builder", "artifact-builder", "runtime"].includes(profile);
  const filesToValidate = validatesFileReferences
    ? dedupeSorted([...candidateFiles, ...changedFiles, ...referencedFiles])
    : [];
  const invalidReferencedFiles = verifiedRepoFiles.length > 0
    ? filesToValidate.filter((candidate) => !verifiedFileKeys.has(canonicalFileKey(candidate)))
    : [];
  const issues: AgentValidationIssue[] = [];

  for (const section of SECTION_PATTERNS[profile] ?? []) {
    if (!normalizedResponse.includes(section)) {
      issues.push({
        code: `${profile}.missing_section.${slug(section)}`,
        severity: profile === "artifact-builder" && section === "requested artifact" ? "error" : "warn",
        message: `Missing expected ${section} section.`,
      });
    }
  }

  if (profile === "builder") {
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
  }

  if (profile === "artifact-builder") {
    const instruction = input.instruction ?? "";
    const expectedDayCount = extractExpectedDayCount(instruction);
    const requestedArtifact = extractRequestedArtifact(response);
    if (expectedDayCount && requestedArtifact) {
      const explicitDays = extractExplicitDayNumbers(requestedArtifact);
      const missingDays = Array.from(
        { length: expectedDayCount },
        (_, index) => index + 1,
      ).filter((day) => !explicitDays.has(day));
      if (missingDays.length > 0) {
        issues.push({
          code: "artifact-builder.incomplete_enumerated_artifact",
          severity: "error",
          message: `Requested Artifact must include explicit Day 1 through Day ${expectedDayCount} entries; missing: ${missingDays.join(", ")}.`,
        });
      }
      const requiredFields = extractRequiredDayFields(instruction);
      const dayEntries = extractDayEntries(requestedArtifact);
      const incompleteDays = Array.from({ length: expectedDayCount }, (_, index) => index + 1)
        .flatMap((day) => {
          const entry = dayEntries.get(day) ?? "";
          const normalizedEntry = entry.replace(/\*\*|__/g, "");
          const missingFields = requiredFields.filter((field) =>
            !DAY_FIELD_PATTERNS[field].some((pattern) => pattern.test(normalizedEntry)),
          );
          return missingFields.length > 0 ? [`Day ${day}: ${missingFields.join(", ")}`] : [];
        });
      if (incompleteDays.length > 0) {
        issues.push({
          code: "artifact-builder.incomplete_daily_fields",
          severity: "error",
          message: `Requested Artifact is missing required daily fields — ${incompleteDays.join("; ")}.`,
        });
      }
    }
  }

  for (const filePath of invalidReferencedFiles) {
    const label = profile === "runtime" ? "Runtime" : "Builder";
    issues.push({
      code: `${profile}.unverified_referenced_file`,
      severity: "error",
      message: `${label} referenced an unverified file: ${filePath}`,
    });
  }

  if (profile === "qa") {
    if (QA_IMPLEMENTATION_CLAIM_PATTERN.test(response)) {
      issues.push({
        code: "qa.claims_implementation",
        severity: "error",
        message: "QA output should not claim implementation changes.",
      });
    }
    if (!extractQaVerdict(response)) {
      issues.push({
        code: "qa.missing_verdict",
        severity: "error",
        message: "QA output must include an explicit verdict.",
      });
    }
  }

  if (profile === "pm" && !/acceptance criteria/i.test(response)) {
    issues.push({
      code: "pm.missing_acceptance_criteria",
      severity: "error",
      message: "PM output must include acceptance criteria.",
    });
  }

  if (profile === "designer" && !/builder notes/i.test(response)) {
    issues.push({
      code: "designer.missing_builder_notes",
      severity: "error",
      message: "Designer output must include builder notes.",
    });
  }

  if (profile === "wiki-curator" && !/wiki log entry|log entry drafted/i.test(response)) {
    issues.push({
      code: "wiki-curator.missing_log_entry",
      severity: "warn",
      message: "Wiki curator output should explicitly mention the log entry.",
    });
  }

  if (profile === "intake" && !/raw source/i.test(response)) {
    issues.push({
      code: "intake.missing_raw_source",
      severity: "warn",
      message: "Intake output should mention that the raw source was preserved.",
    });
  }

  return {
    role: input.role,
    profile,
    passed: issues.every((issue) => issue.severity !== "error"),
    issues,
    verifiedRepoFiles,
    invalidReferencedFiles,
    referencedFiles,
    candidateFiles,
    changedFiles,
  };
}

export function extractRequestedArtifact(response: string): string | null {
  const lines = response.split(/\r?\n/);
  const startIndex = lines.findIndex((line) =>
    /^(?:#{1,6}\s*)?(?:\*\*)?requested artifact(?:\*\*)?\s*:?\s*$/i.test(line.trim()),
  );
  if (startIndex < 0) {
    return null;
  }

  const content: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const trimmed = line.trim();
    if (content.some((entry) => entry.trim()) && isRequestedArtifactBoundary(trimmed)) {
      break;
    }
    content.push(line);
  }

  const artifact = content.join("\n").trim();
  return artifact || null;
}

export function mergeRequestedArtifactResponses(baseResponse: string, repairResponse: string): string {
  const baseArtifact = extractRequestedArtifact(baseResponse);
  const repairArtifact = extractRequestedArtifact(repairResponse);
  if (!baseArtifact || !repairArtifact) {
    return repairResponse;
  }

  return repairResponse.replace(
    repairArtifact,
    `${baseArtifact}\n\n${repairArtifact}`,
  );
}

export function mergeSemanticRequestedArtifactResponses(baseResponse: string, repairResponse: string): string {
  const baseArtifact = extractRequestedArtifact(baseResponse);
  const repairArtifact = extractRequestedArtifact(repairResponse);
  if (!baseArtifact || !repairArtifact) {
    return repairResponse;
  }

  const replacements = extractDayEntries(repairArtifact);
  if (replacements.size === 0) {
    return repairResponse;
  }
  const mergedArtifact = replaceDayEntries(baseArtifact, replacements);
  return repairResponse.replace(repairArtifact, mergedArtifact);
}

export function extractQaVerdict(response: string): "approved" | "changes-requested" | null {
  const markdownNeutralResponse = response.replace(/\*\*|__/g, "");
  const match = /\bverdict\s*:\s*(approved|changes requested)\b/i.exec(markdownNeutralResponse);
  if (!match?.[1]) {
    return null;
  }

  return match[1].toLowerCase() === "approved" ? "approved" : "changes-requested";
}

export function extractAcceptanceCriteria(response: string): string[] {
  return extractBulletSection(response, "acceptance criteria");
}

export function extractQaChecklist(response: string): Array<{
  criterion: string;
  status: "pass" | "fail";
  evidence: string;
}> {
  const lines = extractSectionLines(response, "acceptance checklist");
  const items: Array<{ criterion: string; status: "pass" | "fail"; evidence: string }> = [];
  let pendingCriterion: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.replace(/\*\*|__/g, "").trim() ?? "";
    const numberedCriterion = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numberedCriterion?.[1]) {
      pendingCriterion = numberedCriterion[1].trim();
      continue;
    }
    const match = /^[-*]\s*\[(pass|fail)\]\s*(.*?)(?:\s*(?:—|-)?\s*evidence\s*:\s*(.+))?$/i.exec(line);
    if (!match?.[1]) continue;
    const criterion = match[2]?.trim() || pendingCriterion;
    if (!criterion) continue;
    const inlineEvidence = match[3]?.trim();
    const followingEvidence = lines[index + 1]?.replace(/\*\*|__/g, "").trim().match(/^evidence\s*:\s*(.+)$/i)?.[1]?.trim();
    const evidence = inlineEvidence || followingEvidence;
    if (!evidence) continue;
    items.push({
      criterion,
      status: match[1].toLowerCase() as "pass" | "fail",
      evidence,
    });
    pendingCriterion = null;
  }
  return items;
}

export function extractQaFeedbackSignature(response: string): string | null {
  const findings = extractSectionLines(response, "findings")
    .join(" ")
    .replace(/^[-*]\s*/gm, "")
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
  return findings || null;
}

export function isQaFeedbackRepeated(previous: string | null, current: string | null): boolean {
  if (!previous || !current) return false;
  if (previous === current) return true;
  const previousTokens = new Set(previous.split(" ").filter((token) => token.length > 2));
  const currentTokens = new Set(current.split(" ").filter((token) => token.length > 2));
  const union = new Set([...previousTokens, ...currentTokens]);
  if (union.size === 0) return false;
  const overlap = [...previousTokens].filter((token) => currentTokens.has(token)).length;
  return overlap >= 3 && overlap / union.size >= 0.65;
}

export function qaChecklistCoversCriteria(
  items: Array<{ criterion: string }>,
  criteria: string[],
): boolean {
  const expectedCriteria = criteria.length > 0
    ? criteria
    : ["The requested artifact satisfies the explicit goal and is ready for human review."];
  const actualCriteria = new Set(items.map((item) => normalizeCriterion(item.criterion)));
  return expectedCriteria.every((criterion) => actualCriteria.has(normalizeCriterion(criterion)));
}

function normalizeCriterion(criterion: string): string {
  return criterion
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function extractBulletSection(response: string, sectionName: string): string[] {
  const lines = extractSectionLines(response, sectionName);
  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const numberedLines = lines.filter((line) => /^\s*\d+[.)]\s+/.test(line));
  const selected = bulletLines.length > 0 ? bulletLines : numberedLines.length > 0 ? numberedLines : lines;
  return selected
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

function extractSectionLines(response: string, sectionName: string): string[] {
  const lines = response.split(/\r?\n/);
  const heading = new RegExp(`^(?:#{1,6}\\s*)?${escapeRegExp(sectionName)}\\s*:?\\s*$`, "i");
  const markdownNeutral = (line: string) => line.replace(/\*\*|__/g, "").trim();
  const headingNeutral = (line: string) => markdownNeutral(line)
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "");
  const startIndex = lines.findIndex((line) => heading.test(headingNeutral(line)));
  if (startIndex < 0) return [];
  const section: string[] = [];
  for (let index = startIndex + 1; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    const neutralLine = markdownNeutral(line);
    const neutralHeading = headingNeutral(line);
    if (neutralLine && (
      /^#{1,6}\s+/.test(neutralLine)
      || /^[A-Za-z][A-Za-z\s/-]+\s*:\s*$/.test(neutralHeading)
    )) break;
    if (line.trim()) section.push(line.trim());
  }
  return section;
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

function canonicalFileKey(value: string): string {
  return cleanFilePath(value)
    .replace(/\\/g, "/")
    .replace(/^\.\//, "")
    .replace(/^atelier\//, "");
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

function isRequestedArtifactBoundary(value: string): boolean {
  return /^(?:#{1,2}\s*)?(?:\*\*)?(?:risk assessment|blockers|qa handoff)(?:\*\*)?\s*:?\s*$/i.test(value);
}

function extractExpectedDayCount(instruction: string): number | null {
  const goal = /^Goal:\s*(.+)$/im.exec(instruction)?.[1]?.trim() ?? instruction.trim();
  const requestsArtifact = /\b(?:produce|create|draft|write|generate|design|prepare|crear|diseñar|redactar|generar|preparar)\b/i.test(goal);
  const namesPlan = /\b(?:plan|schedule|itinerary|calendario|programa)\b/i.test(goal);
  if (!requestsArtifact || !namesPlan) {
    return null;
  }
  const match = /\b(\d{1,3})\s*(?:-|\s)\s*(?:day|days|día|días)\b/i.exec(goal);
  if (!match?.[1]) {
    return null;
  }

  const count = Number(match[1]);
  return Number.isInteger(count) && count > 0 ? count : null;
}

function extractExplicitDayNumbers(artifact: string): Set<number> {
  return new Set(
    Array.from(artifact.matchAll(/\b(?:day|día)\s+(\d+)\b(?!\s*[-–]\s*\d)/gi))
      .map((match) => Number(match[1]))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
}

type DayField = "objective" | "actions" | "evidence" | "acceptance signal" | "risks" | "human approval boundary";

const DAY_FIELD_PATTERNS: Record<DayField, RegExp[]> = {
  objective: [/\bobjective\s*:/i, /\bobjetivo\s*:/i],
  actions: [/\b(?:concrete\s+)?actions?\s*:/i, /\b(?:acciones?|actividad(?:es)?)\s*:/i],
  evidence: [/\b(?:expected\s+)?evidence\s*:/i, /\bevidencia(?:\s+esperada)?\s*:/i],
  "acceptance signal": [/\bacceptance\s+signal\s*:/i, /\bseñal\s+de\s+aceptación\s*:/i],
  risks: [/\brisks?\s*:/i, /\briesgos?\s*:/i],
  "human approval boundary": [
    /\bhuman\s+approval\s+boundary\s*:/i,
    /\b(?:límite|frontera)\s+de\s+aprobación\s+humana\s*:/i,
  ],
};

function extractRequiredDayFields(instruction: string): DayField[] {
  const goal = /^Goal:\s*(.+)$/im.exec(instruction)?.[1]?.trim() ?? instruction;
  return (Object.keys(DAY_FIELD_PATTERNS) as DayField[]).filter((field) => {
    if (field === "actions") return /\b(?:concrete\s+actions?|acciones?\s+concretas?)\b/i.test(goal);
    if (field === "evidence") return /\b(?:expected\s+evidence|evidencia\s+esperada)\b/i.test(goal);
    if (field === "acceptance signal") return /\b(?:acceptance\s+signal|señal\s+de\s+aceptación)\b/i.test(goal);
    if (field === "human approval boundary") return /\b(?:human\s+approval\s+boundary|(?:límite|frontera)\s+de\s+aprobación\s+humana)\b/i.test(goal);
    return new RegExp(`\\b${field}\\b`, "i").test(goal)
      || (field === "objective" && /\bobjetivos?\b/i.test(goal))
      || (field === "risks" && /\briesgos?\b/i.test(goal));
  });
}

function extractDayEntries(artifact: string): Map<number, string> {
  const matches = Array.from(artifact.matchAll(/^(?:#{1,6}\s*)?(?:\*\*)?(?:day|día)\s+(\d+)\b[^\n]*$/gim));
  const entries = new Map<number, string>();
  for (const [index, match] of matches.entries()) {
    const day = Number(match[1]);
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? artifact.length;
    entries.set(day, artifact.slice(start, end).trim());
  }
  return entries;
}

function replaceDayEntries(baseArtifact: string, replacements: Map<number, string>): string {
  const matches = Array.from(baseArtifact.matchAll(/^(?:#{1,6}\s*)?(?:\*\*)?(?:day|día)\s+(\d+)\b[^\n]*$/gim));
  if (matches.length === 0) return baseArtifact;
  let cursor = 0;
  const parts: string[] = [];
  for (const [index, match] of matches.entries()) {
    const start = match.index ?? 0;
    const end = matches[index + 1]?.index ?? baseArtifact.length;
    parts.push(baseArtifact.slice(cursor, start));
    parts.push(replacements.get(Number(match[1])) ?? baseArtifact.slice(start, end).trim());
    if (index < matches.length - 1) parts.push("\n\n");
    cursor = end;
  }
  parts.push(baseArtifact.slice(cursor));
  for (const [day, entry] of replacements) {
    if (!matches.some((match) => Number(match[1]) === day)) parts.push(`\n\n${entry}`);
  }
  return parts.join("").trim();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}
