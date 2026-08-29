import type {
  AgentValidationResult,
  OrchestrationQaChecklistSummary,
  OrchestrationRepeatedFeedbackSummary,
  OrchestrationRepairSummary,
  Run,
} from "@atellier/shared";

export const LIVE_FLOW_EXIT_CODES = {
  success: 0,
  failed: 1,
  needsHuman: 2,
  timeout: 3,
} as const;

export type LiveFlowStepStatus = {
  stepId: string;
  label: string;
  phase: string;
  agentName: string;
  agentRole: string;
  agentId?: string;
  runId?: string;
  status: "pending" | "running" | "completed" | "failed";
  isActive: boolean;
};

export type LiveFlowOrchestrationStatus = {
  orchestrationRunId: string;
  skillId: string;
  goal: string;
  status: string;
  steps: LiveFlowStepStatus[];
  activeStep: LiveFlowStepStatus | null;
  nextStep: LiveFlowStepStatus | null;
};

type LiveFlowParentOutput = {
  readiness?: "ready-for-human-review" | "needs-human" | "changes-required";
  validation?: AgentValidationResult;
  repair?: OrchestrationRepairSummary;
  qaRetry?: OrchestrationRepairSummary;
  semanticRepair?: OrchestrationRepairSummary;
  qaChecklist?: OrchestrationQaChecklistSummary;
  repeatedFeedback?: OrchestrationRepeatedFeedbackSummary;
};

export type LiveFlowOutcome = "success" | "needs-human" | "failed";

export type LiveFlowResult = {
  runId: string;
  skillId: string;
  outcome: LiveFlowOutcome;
  exitCode: number;
  status: string;
  readiness?: LiveFlowParentOutput["readiness"];
  completedSteps: number;
  failedSteps: number;
  totalSteps: number;
  validationPassed?: boolean;
  checklist?: {
    complete: boolean;
    pass: number;
    fail: number;
    total: number;
  };
  repairs: Array<{
    kind: "deterministic" | "qa-format" | "semantic";
    attemptsUsed: number;
    maxAttempts: number;
    resolved: boolean;
    exhausted: boolean;
  }>;
  blockers: string[];
};

export function evaluateLiveFlow(
  status: LiveFlowOrchestrationStatus,
  parentRun: Run,
): LiveFlowResult {
  const output = (parentRun.output ?? {}) as LiveFlowParentOutput;
  const completedSteps = status.steps.filter((step) => step.status === "completed").length;
  const failedSteps = status.steps.filter((step) => step.status === "failed").length;
  const blockers = collectBlockers(output);
  const repairs = [
    summarizeRepair("deterministic", output.repair),
    summarizeRepair("qa-format", output.qaRetry),
    summarizeRepair("semantic", output.semanticRepair),
  ].filter((repair): repair is NonNullable<typeof repair> => Boolean(repair));
  const checklist = output.qaChecklist
    ? {
        complete: output.qaChecklist.complete,
        pass: output.qaChecklist.items.filter((item) => item.status === "pass").length,
        fail: output.qaChecklist.items.filter((item) => item.status === "fail").length,
        total: output.qaChecklist.items.length,
      }
    : undefined;
  const terminalFailure = ["failed", "blocked", "cancelled"].includes(parentRun.status)
    || status.status === "failed"
    || failedSteps > 0;
  const exhausted = repairs.some((repair) => repair.exhausted);
  const needsHuman = output.readiness === "needs-human"
    || output.readiness === "changes-required"
    || output.validation?.passed === false
    || output.qaChecklist?.items.some((item) => item.status === "fail") === true
    || output.repeatedFeedback?.detected === true
    || exhausted;
  const buildEvidenceMissing = status.skillId === "atellier-build-loop"
    && (output.readiness !== "ready-for-human-review"
      || output.validation?.passed !== true
      || output.qaChecklist?.complete !== true);

  const outcome: LiveFlowOutcome = terminalFailure
    ? "failed"
    : needsHuman || buildEvidenceMissing
      ? "needs-human"
      : "success";

  if (buildEvidenceMissing && blockers.length === 0) {
    blockers.push("Build loop finished without complete ready-for-review validation and QA evidence.");
  }

  return {
    runId: parentRun.id,
    skillId: status.skillId,
    outcome,
    exitCode: outcome === "success" ? LIVE_FLOW_EXIT_CODES.success
      : outcome === "needs-human" ? LIVE_FLOW_EXIT_CODES.needsHuman
        : LIVE_FLOW_EXIT_CODES.failed,
    status: parentRun.status,
    ...(output.readiness && { readiness: output.readiness }),
    completedSteps,
    failedSteps,
    totalSteps: status.steps.length,
    ...(output.validation && { validationPassed: output.validation.passed }),
    ...(checklist && { checklist }),
    repairs,
    blockers: [...new Set(blockers)],
  };
}

function summarizeRepair(
  kind: LiveFlowResult["repairs"][number]["kind"],
  repair?: OrchestrationRepairSummary,
): LiveFlowResult["repairs"][number] | null {
  return repair
    ? {
        kind,
        attemptsUsed: repair.attemptsUsed,
        maxAttempts: repair.maxAttempts,
        resolved: repair.resolved,
        exhausted: repair.exhausted,
      }
    : null;
}

function collectBlockers(output: LiveFlowParentOutput): string[] {
  return [
    ...(output.validation?.issues
      .filter((issue) => issue.severity === "error")
      .map((issue) => issue.message) ?? []),
    ...(output.repair?.blockerMessages ?? []),
    ...(output.qaRetry?.blockerMessages ?? []),
    ...(output.semanticRepair?.blockerMessages ?? []),
    ...(output.repeatedFeedback?.detected
      ? [`Repeated QA feedback on ${output.repeatedFeedback.repeatedQaStepId}: ${output.repeatedFeedback.feedback}`]
      : []),
  ].map(compactBlocker);
}

function compactBlocker(blocker: string): string {
  const compact = blocker.replace(/\s+/g, " ").trim();
  return compact.length > 240 ? `${compact.slice(0, 237)}...` : compact;
}
