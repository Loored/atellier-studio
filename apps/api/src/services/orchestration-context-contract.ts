import type { AgentRole } from "@atellier/shared";

export const ORCHESTRATION_CONTEXT_CONTRACT = Object.freeze({
  schemaVersion: 1,
  limits: Object.freeze({
    previousStepsTotalChars: 24_000,
    ordinaryStepResponseChars: 1_200,
    artifactStepResponseChars: 16_000,
    qaArtifactChars: 7_000,
  }),
  outputTokens: Object.freeze({
    artifactBuilder: 2_048,
    semanticRepair: 1_024,
  }),
  truncationNotice: "[truncated for orchestration context]",
});

export type OrchestrationStepContextReference = {
  stepId: string;
  label: string;
  agentName: string;
  agentRole: AgentRole;
  runId: string;
  response: string;
  validationFeedback: string[];
  isArtifact: boolean;
};

export function truncateOrchestrationContext(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return `${content.slice(0, maxChars)}\n${ORCHESTRATION_CONTEXT_CONTRACT.truncationNotice}`;
}

export function renderStepContextReference(reference: OrchestrationStepContextReference): string {
  return [
    `## ${reference.label}`,
    `Agent: ${reference.agentName} (${reference.agentRole})`,
    `Run: ${reference.runId}`,
    reference.response,
    reference.validationFeedback.length
      ? ["Validation feedback:", ...reference.validationFeedback].join("\n")
      : "",
  ].filter(Boolean).join("\n");
}

export function selectBoundedStepContext(references: OrchestrationStepContextReference[]): string {
  let remaining = ORCHESTRATION_CONTEXT_CONTRACT.limits.previousStepsTotalChars;
  const selected: string[] = [];
  for (const reference of [...references].reverse()) {
    const separatorChars = selected.length > 0 ? 2 : 0;
    const available = remaining - separatorChars;
    if (available <= 0) break;
    const rendered = renderStepContextReference(reference);
    const suffix = `\n${ORCHESTRATION_CONTEXT_CONTRACT.truncationNotice}`;
    const bounded = rendered.length <= available
      ? rendered
      : available > suffix.length
        ? `${rendered.slice(0, available - suffix.length)}${suffix}`
        : rendered.slice(0, available);
    selected.unshift(bounded);
    remaining -= bounded.length + separatorChars;
  }
  return selected.join("\n\n");
}

export function latestArtifactReference(
  references: OrchestrationStepContextReference[],
): OrchestrationStepContextReference | undefined {
  return [...references].reverse().find((reference) => reference.isArtifact);
}
