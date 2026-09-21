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
  pm: ["scope", "approach", "handoff"],
  qa: ["verdict", "findings", "recommendation"],
  designer: ["component references", "layout", "interaction model", "builder notes"],
  "wiki-curator": ["pages created", "pages updated", "log entry", "contradictions"],
  intake: ["source type", "key facts", "implied tasks", "handoff note"],
};

const IMPLEMENTATION_VERBS = ["implemented", "edited", "updated", "changed", "modified", "added", "fixed"];
const QA_IMPLEMENTATION_CLAIM_PATTERN = /(?:^|\n)\s*(?:[-*]\s*)?(?:(?:i|we)\s+)?(?:implemented|edited|updated|changed|modified|added|fixed)\b/i;
const QA_ARTIFACT_REWRITE_PATTERN = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:\*\*)?(?:requested artifact|(?:day|día)\s+\d+)(?:\*\*)?\b/im;

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
  const filesToValidate = profile === "artifact-builder"
    ? dedupeSorted([
        ...candidateFiles,
        ...changedFiles,
        ...extractContextReceiptSourceCitations(response),
      ])
    : validatesFileReferences
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
    if (!requestedArtifact && !issues.some((issue) => issue.code === "artifact-builder.missing_section.requested-artifact")) {
      issues.push({
        code: "artifact-builder.missing_section.requested-artifact",
        severity: "error",
        message: "Missing expected requested artifact section.",
      });
    }
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
      const unexpectedDays = [...explicitDays]
        .filter((day) => day > expectedDayCount)
        .sort((left, right) => left - right);
      if (unexpectedDays.length > 0) {
        issues.push({
          code: "artifact-builder.unexpected_enumerated_artifact",
          severity: "error",
          message: `Requested Artifact must contain exactly Day 1 through Day ${expectedDayCount}; unexpected: ${unexpectedDays.join(", ")}.`,
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
    if (QA_ARTIFACT_REWRITE_PATTERN.test(response)) {
      issues.push({
        code: "qa.rewrites_artifact",
        severity: "error",
        message: "QA output must evaluate the latest artifact and must not reproduce or rewrite it.",
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

  if (profile === "pm" && extractAcceptanceCriteria(response).length === 0) {
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

export function normalizeRequestedArtifactHeading(response: string, instruction = ""): string {
  if (extractRequestedArtifact(response)) return response;

  const lines = response.split(/\r?\n/);
  const introductionIndex = lines.findIndex((line) =>
    /(?:here (?:is|are)|below is|following is).{0,80}(?:corrected|requested|complete)?\s*artifact\s*:?\s*$/i.test(
      line.replace(/\*\*|__/g, "").trim(),
    ),
  );
  const expectedDayCount = extractExpectedDayCount(instruction);
  const hasExactDayShape = Boolean(expectedDayCount) && Array.from(
    { length: expectedDayCount ?? 0 },
    (_, index) => index + 1,
  ).every((day) => new RegExp(`^(?:#{1,6}\\s*)?(?:\\*\\*)?(?:day|día)\\s+${day}\\b`, "im").test(response));
  if (introductionIndex < 0 && !hasExactDayShape) return response;

  const artifactStartIndex = lines.findIndex((line, index) =>
    index > introductionIndex && /^#{1,2}\s+\S/.test(line.trim()),
  );
  if (artifactStartIndex < 0) return response;

  lines.splice(artifactStartIndex, 0, "## Requested Artifact", "");
  return lines.join("\n");
}

/** Returns only paths deliberately declared in an artifact's Sources Used section. */
export function extractContextReceiptSourceCitations(response: string): string[] {
  return extractSectionFiles(response, "sources used");
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
  const match = /(?:^|\n)\s*(?:#{1,6}\s*)?(?:verdict|veredicto)\s*:?[ \t]*(?:\n\s*)?(approved|changes requested|aprobado|cambios solicitados)\b/im.exec(markdownNeutralResponse);
  if (!match?.[1]) {
    return null;
  }

  const value = match[1].toLowerCase();
  return value === "approved" || value === "aprobado" ? "approved" : "changes-requested";
}

export function extractAcceptanceCriteria(response: string): string[] {
  return extractBulletSectionForAliases(response, [
    "acceptance criteria",
    "criterios de aceptación",
    "criterios de aceptacion",
  ]);
}

export function extractQaChecklist(response: string): Array<{
  criterion: string;
  status: "pass" | "fail";
  evidence: string;
}> {
  const lines = extractSectionLinesForAliases(response, [
    "acceptance checklist",
    "lista de verificación de aceptación",
    "lista de verificacion de aceptacion",
  ]);
  const items: Array<{ criterion: string; status: "pass" | "fail"; evidence: string }> = [];
  let pendingCriterion: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]?.replace(/\*\*|__/g, "").trim() ?? "";
    const numberedCriterion = /^\d+[.)]\s+(.+)$/.exec(line);
    if (numberedCriterion?.[1]) {
      pendingCriterion = numberedCriterion[1].trim();
      continue;
    }
    const match = /^[-*]\s*\[(pass|fail)\]\s*(.*?)(?:\s*(?:—|-)?\s*(?:evidence|evidencia)\s*:\s*(.+))?$/i.exec(line);
    if (!match?.[1]) continue;
    const criterion = match[2]?.trim() || pendingCriterion;
    if (!criterion) continue;
    const inlineEvidence = match[3]?.trim();
    const followingEvidence = lines[index + 1]?.replace(/\*\*|__/g, "").trim().match(/^(?:[-*]\s*)?(?:evidence|evidencia)\s*:\s*(.+)$/i)?.[1]?.trim();
    const evidence = inlineEvidence || followingEvidence;
    items.push({
      criterion,
      status: match[1].toLowerCase() as "pass" | "fail",
      evidence: evidence ?? "",
    });
    pendingCriterion = null;
  }
  return items;
}

export function extractQaFeedbackSignature(response: string): string | null {
  const findings = extractSectionLinesForAliases(response, ["findings", "hallazgos"])
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
  items: Array<{ criterion: string; evidence?: string }>,
  criteria: string[],
): boolean {
  return matchQaCriteria(items, criteria).every((match) => match.item && hasQaEvidence(match.item));
}

export function findMissingQaCriteria(
  items: Array<{ criterion: string }>,
  criteria: string[],
): string[] {
  return matchQaCriteria(items, criteria).filter((match) => !match.item).map((match) => match.criterion);
}

export function findQaCriteriaWithoutEvidence(
  items: Array<{ criterion: string; evidence?: string }>,
  criteria: string[],
): string[] {
  return matchQaCriteria(items, criteria)
    .filter((match) => match.item && !hasQaEvidence(match.item))
    .map((match) => match.criterion);
}

function hasQaEvidence(item: { evidence?: string }): boolean {
  return item.evidence === undefined || Boolean(item.evidence.trim());
}

function expectedQaCriteria(criteria: string[]): string[] {
  return criteria.length > 0
    ? criteria
    : ["The requested artifact satisfies the explicit goal and is ready for human review."];
}

function normalizeCriterion(criterion: string): string {
  return criterion
    .toLowerCase()
    .replace(/[^a-z0-9áéíóúüñ]+/gi, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function matchQaCriteria(
  items: Array<{ criterion: string; evidence?: string }>,
  criteria: string[],
): Array<{ criterion: string; item?: { criterion: string; evidence?: string } }> {
  const available = new Set(items.map((_, index) => index));
  return expectedQaCriteria(criteria).map((criterion, criterionIndex) => {
    let bestIndex = -1;
    let bestScore = 0;
    for (const itemIndex of available) {
      const item = items[itemIndex]!;
      const score = qaCriterionMatchScore(criterion, item.criterion, criterionIndex + 1);
      if (score > bestScore) {
        bestIndex = itemIndex;
        bestScore = score;
      }
    }
    if (bestIndex < 0 || bestScore < 0.6) return { criterion };
    available.delete(bestIndex);
    return { criterion, item: items[bestIndex] };
  });
}

function qaCriterionMatchScore(expected: string, actual: string, expectedId: number): number {
  const explicitId = /\bAC[-\s]?(\d+)\b/i.exec(actual)?.[1];
  if (explicitId) return Number(explicitId) === expectedId ? 1 : 0;
  const expectedNormalized = normalizeCriterion(expected);
  const actualNormalized = normalizeCriterion(actual.replace(/\bAC[-\s]?\d+\s*:?/gi, ""));
  if (expectedNormalized === actualNormalized) return 1;
  const expectedTokens = criterionTokens(expectedNormalized);
  const actualTokens = criterionTokens(actualNormalized);
  const expectedNumbers = expectedTokens.filter((token) => /^\d+$/.test(token));
  const actualNumbers = actualTokens.filter((token) => /^\d+$/.test(token));
  if (expectedNumbers.join(",") !== actualNumbers.join(",")) return 0;
  const expectedNegated = expectedTokens.some((token) => token === "not" || token === "no");
  const actualNegated = actualTokens.some((token) => token === "not" || token === "no");
  if (expectedNegated !== actualNegated) return 0;
  const expectedSet = new Set(expectedTokens);
  const actualSet = new Set(actualTokens);
  const overlap = [...expectedSet].filter((token) => actualSet.has(token)).length;
  if (overlap < 2) return 0;
  return Math.max(overlap / expectedSet.size, overlap / actualSet.size);
}

function criterionTokens(value: string): string[] {
  const stopWords = new Set(["a", "an", "the", "el", "la", "los", "las", "un", "una", "de", "del", "y", "and", "is", "are", "es", "son", "must", "should", "debe"]);
  return value.split(" ").filter((token) => token && !stopWords.has(token));
}

function extractBulletSection(response: string, sectionName: string): string[] {
  return extractBulletSectionForAliases(response, [sectionName]);
}

function extractBulletSectionForAliases(response: string, sectionNames: string[]): string[] {
  const lines = extractSectionLinesForAliases(response, sectionNames);
  const bulletLines = lines.filter((line) => /^[-*]\s+/.test(line));
  const numberedLines = lines.filter((line) => /^\s*\d+[.)]\s+/.test(line));
  const selected = bulletLines.length > 0 ? bulletLines : numberedLines.length > 0 ? numberedLines : lines;
  return selected
    .map((line) => line.replace(/^[-*]\s+/, "").replace(/^\s*\d+[.)]\s+/, "").trim())
    .filter(Boolean);
}

function extractSectionLines(response: string, sectionName: string): string[] {
  return extractSectionLinesForAliases(response, [sectionName]);
}

function extractSectionLinesForAliases(response: string, sectionNames: string[]): string[] {
  const lines = response.split(/\r?\n/);
  const heading = new RegExp(`^(?:#{1,6}\\s*)?(?:\\d+[.)]\\s*)?(?:${sectionNames.map(escapeRegExp).join("|")})\\s*:?\\s*$`, "i");
  const markdownNeutral = (line: string) => line.replace(/\*\*|__/g, "").trim();
  const headingNeutral = (line: string) => markdownNeutral(line)
    .replace(/^[-*]\s*/, "")
    .replace(/^\d+[.)]\s*/, "");
  const section: string[] = [];
  let collecting = false;
  for (const line of lines) {
    const neutralLine = markdownNeutral(line);
    const neutralHeading = headingNeutral(line);
    if (heading.test(neutralHeading)) {
      collecting = true;
      continue;
    }
    if (!collecting) continue;
    if (neutralLine && (
      /^#{1,6}\s+/.test(neutralLine)
      || /^[A-Za-z][A-Za-z\s/-]+\s*:\s*$/.test(neutralHeading)
    )) {
      collecting = false;
      continue;
    }
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
    if (/^#{1,6}\s+/.test(line) || (/^#{0,6}\s*[A-Za-z][A-Za-z\s-]+:?\s*$/.test(line) && !/^-\s+/.test(line))) {
      break;
    }
    const match = line.match(/^-\s+(.+)$/);
    if (match?.[1]) {
      const declaredValue = cleanFilePath(match[1]);
      if (isNoFileSentinel(declaredValue)) break;
      files.push(extractFirstPath(match[1]) ?? declaredValue);
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

function isNoFileSentinel(value: string): boolean {
  return /^(?:none|n\/?a|not applicable|no files?)$/i.test(value.trim());
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
  const requestsArtifact = /\b(?:produce|create|draft|write|generate|design|prepare|crear|crea|diseñar|diseña|redactar|redacta|generar|genera|preparar|prepara)\b/i.test(goal);
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
  objective: [/\bobjective\s*:/i, /\bobjetivo\s*:/i, /^\s*(?:#{1,6}\s*)?(?:objective|objetivo)\s*$/im],
  actions: [
    /\b(?:concrete\s+)?actions?\s*:/i,
    /\b(?:acciones?|actividad(?:es)?)\s*:/i,
    /^\s*(?:#{1,6}\s*)?(?:(?:concrete\s+)?actions?|acciones?|actividades?)\s*$/im,
  ],
  evidence: [
    /\b(?:expected\s+)?evidence\s*:/i,
    /\bevidencia(?:\s+esperada)?\s*:/i,
    /^\s*(?:#{1,6}\s*)?(?:expected\s+evidence|evidence|evidencia(?:\s+esperada)?)\s*$/im,
  ],
  "acceptance signal": [
    /\bacceptance\s+signal\s*:/i,
    /\bseñal\s+de\s+aceptación\s*:/i,
    /^\s*(?:#{1,6}\s*)?(?:acceptance\s+signal|señal\s+de\s+aceptación)\s*$/im,
  ],
  risks: [/\brisks?\s*:/i, /\briesgos?\s*:/i, /^\s*(?:#{1,6}\s*)?(?:risks?|riesgos?)\s*$/im],
  "human approval boundary": [
    /\bhuman\s+approval\s+boundary\s*:/i,
    /\b(?:límite|frontera)\s+de\s+aprobación\s+humana\s*:/i,
    /^\s*(?:#{1,6}\s*)?(?:human\s+approval\s+boundary|(?:límite|frontera)\s+de\s+aprobación\s+humana)\s*$/im,
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
