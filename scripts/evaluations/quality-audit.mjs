/** Protected negative controls for the frozen 2026-09-16 evaluation.
 * This deliberately never issues a positive substantive-quality verdict. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const frozenMatrix = new URL("./2026-09-16-varied-build-loop.json", import.meta.url);
const expectedHash = "2b298dcbb9f578f84d21a0e5734306b194b20a5e504d7ba4727fed1132409e46";

export function assertFrozenRubric() {
  const bytes = readFileSync(frozenMatrix);
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) {
    throw new Error("Frozen evaluation rubric changed; do not reuse historical judgments.");
  }
  return JSON.parse(bytes.toString("utf8"));
}

export function auditFrozenNegativeControls({ caseId, artifact, parentRunId }) {
  const matrix = assertFrozenRubric();
  if (!matrix.cases.some((item) => item.id === caseId)) throw new Error("Unknown frozen evaluation case.");
  if (typeof artifact !== "string" || !artifact.trim()) return { verdict: "rejected", reasons: ["Requested Artifact is missing."] };
  const reasons = [];
  if (caseId === "plan-failed-run-triage" && parentRunId && artifact.includes(parentRunId)) {
    reasons.push("The plan uses its own evaluation run as the existing failed-run queue.");
  }
  if (caseId === "plan-review-queue" && /\b(?:query|inspect|read)\b[^\n]{0,110}\.service\.ts\b[^\n]{0,110}\b(?:needs-human|runs|queue|review)\b/i.test(artifact)) {
    reasons.push("A source-code service file is presented as live Review queue evidence.");
  }
  if (caseId === "document-review-memo" && /no critical errors or crashes were recorded/i.test(artifact)) {
    reasons.push("A generic template asserts an observed run outcome without a run receipt.");
  }
  if (caseId === "document-memory-decision") {
    const headings = artifact.split("\n").map((line) => /^#{1,6}\s+(.+?)\s*$/.exec(line)?.[1]?.toLowerCase() ?? "");
    for (const heading of ["eligibility", "evidence to check", "human approval", "rejection or contradiction handling"]) {
      if (!headings.includes(heading)) reasons.push(`Requested section missing: ${heading}.`);
    }
  }
  if (caseId === "run-qa-parent-disagreement" && /\b(?:completed and approved|artifact is \*\*APPROVED\*\*|new session entry appended)\b/i.test(artifact)) {
    reasons.push("The diagnosis claims an approval or Wiki effect contradicted by the pending parent receipt.");
  }
  if (caseId === "reasoning-qa-regression" && /\bDay-00[1-9]\b/.test(artifact)) {
    reasons.push("The proposal substitutes invented per-day artifact IDs for headings in one current artifact.");
  }
  if (caseId === "reasoning-citation-boundary" && /agent-response-validator\.service\.ts/.test(artifact)) {
    reasons.push("The proposal names a nonexistent validator path instead of the verified repository file.");
  }
  return reasons.length > 0
    ? { verdict: "rejected", reasons }
    : { verdict: "unverified", reasons: ["Negative controls passed; substantive goal fidelity still requires independent evidence."] };
}
