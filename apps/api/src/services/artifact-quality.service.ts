import { createHash } from "node:crypto";
import type {
  ArtifactQualityFinding,
  ArtifactQualityReceipt,
  OrchestrationPreflightRunEvidence,
} from "@atellier/shared";
import {
  missingOperatorSections,
  planUsesOwnRunAsExistingEvidence,
  type OperatorGoalContract,
} from "./operator-goal-contract";
import {
  findUnsupportedOperationalIdentifiers,
  type OperationalCapabilityContract,
} from "./operational-contract.service";

export function evaluateArtifactQuality(input: {
  goal: string;
  parentRunId: string;
  artifact: string;
  goalContract: OperatorGoalContract;
  operationalContract: OperationalCapabilityContract;
  preflightRunEvidence?: OrchestrationPreflightRunEvidence;
}): ArtifactQualityReceipt {
  const findings: ArtifactQualityFinding[] = [];
  const artifact = input.artifact.trim();
  if (!artifact) {
    findings.push({ code: "missing-artifact", dimension: "structure", message: "Requested Artifact is missing." });
  } else {
    const missingSections = missingOperatorSections(input.goalContract, artifact);
    if (missingSections.length > 0) {
      findings.push({ code: "missing-section", dimension: "structure", message: `Requested sections are missing: ${missingSections.join(", ")}.` });
    }
    if (planUsesOwnRunAsExistingEvidence(input.goal, artifact, input.parentRunId)) {
      findings.push({ code: "self-referential-evidence", dimension: "provenance", message: "The artifact treats its own orchestration as prior-run evidence." });
    }
    const unsupported = findUnsupportedOperationalIdentifiers(artifact, input.operationalContract);
    if (unsupported.length > 0) {
      findings.push({ code: "unsupported-operational-identifier", dimension: "operational-compatibility", message: `Operational identifiers are absent from the current contract: ${unsupported.join(", ")}.` });
    }
    if (input.goalContract.artifactKind === "blank-template") {
      if (/\b[0-9a-f]{24}\b/i.test(artifact) || /\b(?:worker\s+crashed|repair\s+succeeded)\b/i.test(artifact)) {
        findings.push({ code: "unsupported-factual-claim", dimension: "goal-fidelity", message: "A blank template contains a run-specific fact or prohibited outcome claim." });
      }
    } else if (input.goalContract.artifactKind === "fact-report") {
      if (input.preflightRunEvidence?.invocation.status !== "succeeded" || !input.preflightRunEvidence.records) {
        findings.push({ code: "evidence-unavailable", dimension: "provenance", message: "Current operational evidence was unavailable for this factual report." });
      } else if (!input.preflightRunEvidence.requestedRunIds.every((id) => artifact.includes(id))) {
        findings.push({ code: "evidence-unavailable", dimension: "provenance", message: "The factual report does not identify every server-acquired run receipt." });
      } else if (!input.preflightRunEvidence.requestedRunIds.every((id) => {
        const at = artifact.indexOf(id);
        return /\b(?:receipt|recibo|unverified|no\s+verificado)\b/i.test(artifact.slice(Math.max(0, at - 80), at + id.length + 120));
      })) {
        findings.push({ code: "receipt-grounding-missing", dimension: "provenance", message: "Each factual receipt must be explicitly labeled as a receipt source or unverified." });
      }
    }
  }

  const rejected = findings.some((finding) => finding.code !== "evidence-unavailable");
  const verifiedBlankTemplate = input.goalContract.artifactKind === "blank-template" && findings.length === 0;
  const verifiedFactReport = input.goalContract.artifactKind === "fact-report" && findings.length === 0;
  const verdict = rejected ? "rejected" : verifiedBlankTemplate || verifiedFactReport ? "verified" : "unverified";
  if (verdict === "unverified" && findings.length === 0) {
    findings.push({ code: "semantic-review-required", dimension: "goal-fidelity", message: "Deterministic checks passed, but this artifact family still requires calibrated semantic evaluation." });
  }
  return {
    schemaVersion: 1,
    verdict,
    goalHash: input.goalContract.goalHash,
    artifactDigest: createHash("sha256").update(artifact).digest("hex"),
    operationalContractFingerprint: input.operationalContract.fingerprint,
    ...(input.preflightRunEvidence && { preflightEvidenceDigest: input.preflightRunEvidence.evidenceDigest }),
    findings,
  };
}
