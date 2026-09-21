import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const expectedHash = "e5cf76058616ae510020b7a421dfd2e8d6764a40708ff55fe715c6c16086b37f";

export function auditReservedHoldout({ caseId, artifact, parentRunId }) {
  const bytes = readFileSync(new URL("./holdout-v1.json", import.meta.url));
  if (createHash("sha256").update(bytes).digest("hex") !== expectedHash) throw new Error("Reserved holdout changed after freezing.");
  const item = JSON.parse(bytes.toString("utf8")).cases.find((candidate) => candidate.id === caseId);
  if (!item) throw new Error("Unknown reserved holdout case.");
  const reasons = [];
  if (typeof artifact !== "string" || !artifact.trim()) reasons.push("Requested Artifact is missing.");
  if (item.family === "operational-plan" && parentRunId && artifact.includes(parentRunId)) {
    reasons.push("The operational plan treats its own evaluation run as a prior run to investigate.");
  }
  return reasons.length
    ? { verdict: "rejected", reasons }
    : { verdict: "unverified", reasons: ["Negative controls passed; reserved substantive criteria require independent adjudication."] };
}
