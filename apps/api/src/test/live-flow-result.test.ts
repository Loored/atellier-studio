import { describe, expect, it } from "vitest";
import type { Run } from "@atellier/shared";
import {
  LIVE_FLOW_EXIT_CODES,
  evaluateLiveFlow,
  type LiveFlowOrchestrationStatus,
} from "./live-flow-result";

const status = (overrides: Partial<LiveFlowOrchestrationStatus> = {}): LiveFlowOrchestrationStatus => ({
  orchestrationRunId: "run-1",
  skillId: "atellier-build-loop",
  goal: "Create a bounded artifact.",
  status: "completed",
  steps: [{
    stepId: "qa",
    label: "Test and approve or block",
    phase: "qa",
    agentName: "Jaco QA",
    agentRole: "qa",
    status: "completed",
    isActive: false,
  }],
  activeStep: null,
  nextStep: null,
  ...overrides,
});

const run = (output: unknown, overrides: Partial<Run> = {}): Run => ({
  id: "run-1",
  type: "orchestration",
  status: "completed",
  output,
  logs: [],
  createdAt: "2026-08-28T00:00:00.000Z",
  updatedAt: "2026-08-28T00:00:00.000Z",
  ...overrides,
});

describe("live flow result", () => {
  it("reports success only with ready validation and complete QA evidence", () => {
    const result = evaluateLiveFlow(status(), run({
      readiness: "ready-for-human-review",
      validation: { role: "qa", profile: "orchestration", passed: true, issues: [], verifiedRepoFiles: [], invalidReferencedFiles: [], referencedFiles: [], candidateFiles: [], changedFiles: [] },
      qaChecklist: {
        sourceStepId: "scope",
        qaStepId: "qa",
        complete: true,
        items: [{ criterion: "Artifact is complete", status: "pass", evidence: "Artifact exists." }],
      },
    }));

    expect(result).toMatchObject({ outcome: "success", exitCode: LIVE_FLOW_EXIT_CODES.success });
    expect(result.checklist).toEqual({ complete: true, pass: 1, fail: 0, total: 1 });
  });

  it("does not report a completed needs-human run as success", () => {
    const result = evaluateLiveFlow(status(), run({
      readiness: "needs-human",
      validation: {
        role: "qa",
        profile: "orchestration",
        passed: false,
        issues: [{ code: "orchestration.qa_retry_exhausted", severity: "error", message: "QA format retries exhausted." }],
        verifiedRepoFiles: [], invalidReferencedFiles: [], referencedFiles: [], candidateFiles: [], changedFiles: [],
      },
      qaRetry: { maxAttempts: 2, attemptsUsed: 2, resolved: false, exhausted: true, finalStepId: "qa-format-retry-2", blockerMessages: ["QA did not return a verdict."] },
      qaChecklist: { sourceStepId: "scope", qaStepId: "qa-format-retry-2", complete: false, items: [] },
    }));

    expect(result).toMatchObject({
      outcome: "needs-human",
      exitCode: LIVE_FLOW_EXIT_CODES.needsHuman,
      validationPassed: false,
    });
    expect(result.blockers).toContain("QA format retries exhausted.");
    expect(result.repairs).toContainEqual(expect.objectContaining({ kind: "qa-format", exhausted: true }));
  });

  it("fails closed when a build loop lacks readiness evidence", () => {
    const result = evaluateLiveFlow(status(), run({}));

    expect(result.outcome).toBe("needs-human");
    expect(result.blockers).toContain(
      "Build loop finished without complete ready-for-review validation and QA evidence.",
    );
  });

  it("needs human input when a complete checklist still contains a failure", () => {
    const result = evaluateLiveFlow(status(), run({
      readiness: "ready-for-human-review",
      validation: { role: "qa", profile: "orchestration", passed: true, issues: [], verifiedRepoFiles: [], invalidReferencedFiles: [], referencedFiles: [], candidateFiles: [], changedFiles: [] },
      qaChecklist: {
        sourceStepId: "scope",
        qaStepId: "qa",
        complete: true,
        items: [{ criterion: "Operator can execute it", status: "fail", evidence: "Guidance is missing." }],
      },
    }));

    expect(result).toMatchObject({ outcome: "needs-human", exitCode: LIVE_FLOW_EXIT_CODES.needsHuman });
  });

  it("reports terminal and step failures as failed", () => {
    const failedStatus = status({
      status: "failed",
      steps: [{ ...status().steps[0]!, status: "failed" }],
    });
    const result = evaluateLiveFlow(failedStatus, run({}, { status: "failed" }));

    expect(result).toMatchObject({ outcome: "failed", exitCode: LIVE_FLOW_EXIT_CODES.failed, failedSteps: 1 });
  });

  it("keeps non-build completed skills compatible without build evidence", () => {
    const result = evaluateLiveFlow(status({ skillId: "wiki-dream-loop" }), run({}));

    expect(result).toMatchObject({ outcome: "success", exitCode: LIVE_FLOW_EXIT_CODES.success });
  });

  it("keeps operational blocker summaries bounded", () => {
    const longBlocker = `Long QA response ${"detail ".repeat(80)}`;
    const result = evaluateLiveFlow(status(), run({
      readiness: "needs-human",
      semanticRepair: {
        maxAttempts: 3,
        attemptsUsed: 1,
        resolved: false,
        exhausted: false,
        finalStepId: "qa-recheck-1",
        blockerMessages: [longBlocker],
      },
    }));

    expect(result.blockers[0]?.length).toBeLessThanOrEqual(240);
    expect(result.blockers[0]).toMatch(/\.\.\.$/);
  });
});
