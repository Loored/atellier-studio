import { createHash } from "node:crypto";

export type OperatorGoalArtifactKind = "blank-template" | "future-procedure" | "test-proposal" | "fact-report" | "general";

export type OperatorGoalRequirement = {
  /** Stable within the frozen goal contract; never derived from PM output. */
  id: `AC-${number}`;
  text: string;
  source: "operator";
  kind: "shape" | "section" | "requirement" | "prohibition";
};

export type OperatorGoalContract = {
  schemaVersion: 3;
  goalHash: string;
  /** Compatibility view for the existing Builder and QA checklist protocol. */
  criteria: string[];
  requirements: OperatorGoalRequirement[];
  numberedArtifact: boolean;
  requiredSections: string[];
  prohibitions: string[];
  artifactKind: OperatorGoalArtifactKind;
  explicitConstraints: boolean;
};

const FIELD_LABELS = [
  ["Objective", /\b(?:objective|objetivo)\b/i],
  ["Actions", /\b(?:actions?|acciones?)\b/i],
  ["Expected Evidence", /\b(?:expected\s+evidence|evidencia\s+esperada)\b/i],
  ["Observable success signal", /\b(?:observable\s+success\s+signal|señal\s+observable\s+de\s+éxito)\b/i],
  ["Acceptance Signal", /\b(?:acceptance\s+signal|señal\s+de\s+aceptación)\b/i],
  ["Risk", /\b(?:risks?|riesgos?)\b/i],
  ["Human Approval Boundary", /\b(?:human\s+approval\s+boundary|(?:límite|frontera)\s+de\s+aprobación\s+humana)\b/i],
] as const;

function normalizeSection(value: string): string {
  return value.replace(/\b(?:sections?|secciones?)\b\s*$/i, "").replace(/^and\s+|^y\s+/i, "").trim();
}

function extractRequiredSections(goal: string, numberedArtifact: boolean): string[] {
  if (numberedArtifact) return [];
  const match = /\b(?:include|with|incluye|con)\s+(?:the\s+|las?\s+)?(?:sections?|secciones?\s+)?([^.!?]+)/i.exec(goal);
  const candidate = match?.[1] ? normalizeSection(match[1]) : "";
  // A comma-separated, title-like list is an explicit document shape. Do not
  // mistake ordinary prose such as “with no source” for requested headings.
  if (!candidate.includes(",") || !/\b(?:and|y)\b/i.test(candidate)) return [];
  return candidate.split(/,\s*|\s+and\s+|\s+y\s+/i)
    .map(normalizeSection)
    .filter(Boolean);
}

function inferArtifactKind(goal: string): OperatorGoalArtifactKind {
  if (/\b(?:blank|empty)\b.{0,45}\b(?:template|plantilla)\b|\b(?:template|plantilla)\b.{0,45}\b(?:blank|empty|vacía|vacío|en blanco)\b/i.test(goal)) return "blank-template";
  if (/\b(?:plan|procedure|procedimiento)\b/i.test(goal)) return "future-procedure";
  if (/\b(?:propose|proposal|proponer|propuesta)\b.{0,70}\b(?:tests?|pruebas?)\b/i.test(goal)) return "test-proposal";
  if (/\b(?:inspect|compare|diagnose|report|inspecciona|compara|diagnostica|informe)\b/i.test(goal)) return "fact-report";
  return "general";
}

function operatorSentences(goal: string): string[] {
  return goal.trim().split(/(?<=[.!?])\s+(?=[A-ZÁÉÍÓÚÜÑ0-9])/u).map((part) => part.trim()).filter(Boolean);
}

export function buildOperatorGoalContract(goal: string): OperatorGoalContract {
  const dayMatch = /\b(\d{1,3})\s*(?:-|\s)\s*(?:day|days|día|días)\b/i.exec(goal);
  const dayCount = Number(dayMatch?.[1]);
  const numberedArtifact = Number.isInteger(dayCount) && dayCount > 0;
  const fields = FIELD_LABELS.filter(([, pattern]) => pattern.test(goal)).map(([label]) => label);
  const shapeCriteria = numberedArtifact
    ? [
        `The requested artifact contains exactly ${dayCount} explicit Day entries (Day 1 through Day ${dayCount}) and no others.`,
        ...(fields.length ? [`Each Day entry contains the operator-required fields: ${fields.join(", ")}.`] : []),
        "The deliverable is a complete standalone plan for the current operator goal, not proof that future actions already ran.",
      ]
    : [];
  // Keep explicit operator constraints, including negative instructions, rather
  // than allowing a PM scope or retrieved context to replace them. These are
  // evaluation requirements, not assertions that a model has complied.
  const sentences = operatorSentences(goal);
  const prohibitions = sentences.filter((sentence) => /\b(?:do not|must not|without)\b|\b(?:no|sin)\s+\p{L}/iu.test(sentence));
  const explicitConstraints = numberedArtifact || sentences.length > 1 || /\b(?:include|with|incluye|con|do not|must|without|no|sin)\b/i.test(goal);
  const requiredSections = extractRequiredSections(goal, numberedArtifact);
  const requirements = [
    ...shapeCriteria.map((text) => ({ text, kind: "shape" as const })),
    ...requiredSections.map((section) => ({ text: `The artifact includes the requested section: ${section}.`, kind: "section" as const })),
    ...sentences
      .filter((sentence) => !numberedArtifact || !/^create\b.{0,80}\b\d{1,3}[- ]day\b.{0,40}\bplan\.?$/i.test(sentence))
      .map((text) => ({ text: `The artifact satisfies the operator's original requirement: ${text}`, kind: prohibitions.includes(text) ? "prohibition" as const : "requirement" as const })),
  ].map((requirement, index) => ({ id: `AC-${index + 1}` as `AC-${number}`, source: "operator" as const, ...requirement }));
  const criteria = requirements.map((requirement) => requirement.text);
  return {
    schemaVersion: 3,
    goalHash: createHash("sha256").update(goal.trim()).digest("hex"),
    criteria,
    requirements,
    numberedArtifact,
    requiredSections,
    prohibitions,
    artifactKind: inferArtifactKind(goal),
    explicitConstraints,
  };
}

/**
 * Only an explicit, bounded operational comparison can acquire run receipts
 * before Builder. Incidental IDs in prose remain ordinary text.
 */
export function explicitRunEvidenceRequest(goal: string): string[] | null {
  const ids = [...new Set(goal.match(/\b(?:[0-9a-f]{24}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})\b/gi) ?? [])];
  if (ids.length < 1 || ids.length > 2 || !/\bruns?\b/i.test(goal)) return null;
  if (!/\b(?:compare|inspect|current|readiness|status|repairs?|checklist|receipt|compara|inspecciona|estado|recibo)\b/i.test(goal)) return null;
  return ids;
}

export function missingOperatorSections(contract: OperatorGoalContract, artifact: string): string[] {
  const headings = artifact.split("\n")
    .map((line) => /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)?.[1]?.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, " ").trim())
    .filter((heading): heading is string => Boolean(heading));
  return contract.requiredSections.filter((section) => {
    const normalized = section.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, " ").trim();
    return !headings.some((heading) => heading === normalized);
  });
}

export function planUsesOwnRunAsExistingEvidence(goal: string, artifact: string, parentRunId: string): boolean {
  return /\b(?:plan|procedure|procedimiento)\b/i.test(goal)
    && /(?:\b(?:existing|actual|current)\b.{0,55}\bruns?\b|\bruns?\b.{0,55}\b(?:existing|actual|current)\b)/i.test(goal)
    && Boolean(parentRunId)
    && artifact.includes(parentRunId);
}

export function qaPassEvidenceIsCurrentArtifact(evidence: string, artifact: string): boolean {
  const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9áéíóúüñ]+/gi, " ").trim();
  const artifactText = normalized(artifact);
  const evidenceText = normalized(evidence);
  if (!evidenceText || !artifactText) return false;
  // A QA observation about explicit Day headings should be checked against
  // actual artifact headings, not discarded because "Day 1" has short tokens.
  const referencedDays = [...new Set(evidenceText.match(/\bday\s+\d+\b/g) ?? [])];
  if (referencedDays.length >= 2
    && /\b(?:artifact|plan|deliverable)\b.{0,100}\b(?:headers?|sections?)\b/.test(evidenceText)
    && referencedDays.every((day) => new RegExp(`^#{2,6}\\s*${day.replace(/\s+/, "\\s+")}\\b`, "im").test(artifact))) {
    return true;
  }
  const tokens = [...new Set(evidenceText.split(" ").filter((token) => token.length >= 5))];
  return tokens.filter((token) => artifactText.includes(token)).length >= Math.min(2, tokens.length);
}
