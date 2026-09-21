import { createHash } from "node:crypto";
import { BUILD_ORCHESTRATION_READINESS, RUN_REVIEW_STATUSES, RUN_STATUSES } from "@atellier/shared";
import type { ToolHarnessService } from "./tool-harness.service";

const PUBLIC_RUN_RECEIPT_FIELDS = [
  "id", "type", "status", "reviewStatus", "deliverablePath", "memoryPaths", "logCount", "toolInvocationCount",
  "createdAt", "updatedAt", "readiness", "validationPassed", "validationIssues", "firstPassBuilderValid",
  "deterministicRepairCount", "semanticRepairCount", "qaChecklistComplete", "qaPassCount", "qaFailCount",
  "qaChecklist", "recentErrors",
] as const;

export type OperationalCapabilityContract = {
  schemaVersion: 1;
  fingerprint: string;
  runStatuses: readonly string[];
  reviewStatuses: readonly string[];
  orchestrationReadiness: readonly string[];
  publicRunReceiptFields: readonly string[];
  readTools: readonly string[];
};

export function buildOperationalCapabilityContract(toolHarness: ToolHarnessService): OperationalCapabilityContract {
  const canonical = {
    runStatuses: [...RUN_STATUSES],
    reviewStatuses: [...RUN_REVIEW_STATUSES],
    orchestrationReadiness: [...BUILD_ORCHESTRATION_READINESS],
    publicRunReceiptFields: [...PUBLIC_RUN_RECEIPT_FIELDS],
    readTools: toolHarness.listCatalog().definitions
      .filter((tool) => tool.classification === "read" && tool.executionState === "available")
      .map((tool) => tool.name)
      .sort(),
  };
  return {
    schemaVersion: 1,
    fingerprint: createHash("sha256").update(JSON.stringify(canonical)).digest("hex"),
    ...canonical,
  };
}

export function findUnsupportedOperationalIdentifiers(
  artifact: string,
  contract: OperationalCapabilityContract,
): string[] {
  const allowed = new Set(contract.publicRunReceiptFields);
  const unsupported = new Set<string>();
  // Technical camelCase fields and queue/status-like snake/kebab identifiers
  // are assertions about the current contract unless explicitly marked as a
  // hypothetical example. Ordinary prose and heading labels are ignored.
  for (const match of artifact.matchAll(/\b[a-z][A-Za-z0-9]*[A-Z][A-Za-z0-9]*\b/g)) {
    const identifier = match[0];
    const prefix = artifact.slice(Math.max(0, (match.index ?? 0) - 50), match.index ?? 0);
    if (!allowed.has(identifier) && !/\b(?:(?:proposed|hypothetical|propuesto|propuesta|hipot[eé]tico|hipot[eé]tica)\s+(?:field|state|campo|estado)|(?:campo|estado)\s+(?:propuesto|propuesta|hipot[eé]tico|hipot[eé]tica))\b/i.test(prefix)) unsupported.add(identifier);
  }
  for (const match of artifact.matchAll(/\b(?:awaiting|pending|ready|needs)[_-][a-z][a-z_-]*\b/gi)) {
    const identifier = match[0];
    const prefix = artifact.slice(Math.max(0, (match.index ?? 0) - 50), match.index ?? 0);
    if (!contract.runStatuses.includes(identifier) && !contract.reviewStatuses.includes(identifier)
      && !contract.orchestrationReadiness.includes(identifier)
      && !/\b(?:(?:proposed|hypothetical|propuesto|propuesta|hipot[eé]tico|hipot[eé]tica)\s+(?:field|state|campo|estado)|(?:campo|estado)\s+(?:propuesto|propuesta|hipot[eé]tico|hipot[eé]tica))\b/i.test(prefix)) unsupported.add(identifier);
  }
  return [...unsupported].sort();
}
