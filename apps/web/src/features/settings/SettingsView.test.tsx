import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SettingsView } from "./SettingsView";

vi.mock("../../api/hooks/system/useSystemApi", () => ({
  useHealthApi: () => ({
    data: {
      status: "ok",
      service: "atellier-api",
      storageMode: "memory",
      executorMode: "ollama",
      executorModel: "qwen3.5:4b",
      modelProfile: "standard",
      executorRoleOverrides: { qa: "qwen3.5:9b" },
      availableExecutorModes: ["mock", "ollama"],
      codexWorker: { executionAdapter: "fake", label: "fake-safe", realExecutionEnabled: false },
      mongo: { connected: false, state: "disconnected" },
      metrics: { agentsTotal: 0, waitingAgents: 0, activeRuns: 0 },
      memory: { rssBytes: 0, heapUsedBytes: 0 },
    },
    isLoadingWithoutCache: false,
  }),
}));

vi.mock("./hooks/useToolHarnessSettings", () => ({
  useToolHarnessSettings: () => ({
    isLoadingToolHarness: false,
    refreshOperatorState: vi.fn(),
    isRefreshingOperatorState: false,
    toolHarnessError: null,
    toolHarnessCatalog: {
      generatedAt: "2026-09-08T00:00:00.000Z",
      phase: "catalog-and-policy",
      safetySummary: "No tool adapter is callable yet.",
      definitions: [
        {
          name: "wiki.query",
          label: "Query wiki memory",
          description: "Retrieves scoped operational memory without modifying the vault.",
          classification: "read",
          autonomy: "automatic",
          executionState: "policy-only",
          allowedRoles: ["pm", "builder"],
          inputSummary: "A bounded query.",
          evidenceSummary: "Recorded evidence.",
        },
      ],
    },
    evaluationLedgerSummary: {
      total: 1,
      outcomes: { passed: 1, "needs-human": 0, failed: 0, cancelled: 0 },
      toolInvocations: { succeeded: 1, denied: 0, failed: 0 },
      generatedAt: "2026-09-08T00:00:00.000Z",
    },
    learningCandidates: [
      {
        id: "validation-failures",
        evidenceDigest: "a".repeat(64),
        title: "Review validation failures",
        rationale: "One run failed validation.",
        evidence: {
          total: 1,
          outcomes: { passed: 0, "needs-human": 0, failed: 1, cancelled: 0 },
          toolInvocations: { succeeded: 0, denied: 0, failed: 0 },
          generatedAt: "2026-09-08T00:00:00.000Z",
        },
        status: "pending-review",
      },
    ],
    decideLearningCandidate: vi.fn(),
    isDecidingLearningCandidate: false,
    controlBundles: [],
    controlBundleProposals: [
      {
        id: "proposal-verified",
        experimentId: "shadow-verified",
        bundleId: "bundle-verified",
        bundleFingerprint: "b".repeat(64),
        evidenceDigest: "e".repeat(64),
        fingerprint: "p".repeat(64),
        status: "approved",
        rationale: "Observed evidence is sufficient.",
        createdAt: "2026-09-09T00:00:00.000Z",
        path: "wiki/decisions/control-bundles/proposals/proposal-verified.md",
      },
    ],
    controlBundleCanaries: [
      {
        id: "canary-verified",
        proposalId: "proposal-verified",
        proposalFingerprint: "p".repeat(64),
        bundleId: "bundle-verified",
        bundleFingerprint: "b".repeat(64),
        approvalId: "approval-verified",
        fingerprint: "c".repeat(64),
        frozenBundle: { modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:4b", deep: "qwen3.5:4b" }, limits: { executionTimeoutMs: 120000, maxRetries: 3, contextBytes: 16000 }, allowedTools: [] },
        samplePercent: 5,
        status: "planned",
        createdAt: "2026-09-09T00:00:00.000Z",
        path: "wiki/decisions/control-bundles/canaries/canary-verified.md",
      },
    ],
    workspaceChanges: [
      {
        id: "change-verified",
        path: "docs/note.md",
        before: "before",
        after: "after",
        beforeDigest: "a".repeat(64),
        afterDigest: "b".repeat(64),
        fingerprint: "c".repeat(64),
        status: "approved",
        createdAt: "2026-09-09T00:00:00.000Z",
        evidencePath: "wiki/decisions/reversible-changes/change-verified.md",
      },
    ],
    supervisedCodeChanges: [
      {
        id: "supervised-0123456789abcdef",
        changeId: "change-verified",
        changeFingerprint: "c".repeat(64),
        targetPath: "apps/api/sample.ts",
        worktreePath: "/tmp/atellier-worktree",
        baseRevision: "d".repeat(40),
        status: "verification-failed",
        verificationPlan: ["api-typecheck", "api-tests"],
        verificationReceipts: [
          { check: "api-typecheck", command: "corepack pnpm --filter @atellier/api typecheck", status: "passed", exitCode: 0, durationMs: 10, termination: "completed", stdoutPath: "runs/artifacts/sample.stdout.log", stderrPath: "runs/artifacts/sample.stderr.log", idempotencyKey: "key", fingerprint: "e".repeat(64), recordedAt: "2026-09-10T00:00:00.000Z" },
          { check: "api-tests", command: "corepack pnpm test:api", status: "failed", exitCode: null, durationMs: 20, termination: "cancelled", stdoutPath: "runs/artifacts/sample-tests.stdout.log", stderrPath: "runs/artifacts/sample-tests.stderr.log", idempotencyKey: "key-tests", fingerprint: "f".repeat(64), recordedAt: "2026-09-10T00:01:00.000Z" },
        ],
        createdAt: "2026-09-10T00:00:00.000Z",
        evidencePath: "wiki/decisions/supervised-code-changes/supervised-0123456789abcdef.md",
      },
    ],
    evaluationLedgerEvidencePairs: [
      {
        id: "ledger-pair-verified",
        experimentId: "shadow-verified",
        comparisonKey: "k".repeat(64),
        fingerprint: "f".repeat(64),
        baseline: { runId: "baseline-run", evaluationId: "baseline-evaluation", fingerprint: "a".repeat(64), terminalStatus: "completed", outcome: "passed", validationPassed: true, needsHuman: false, modelProfile: "standard", agentRole: "builder", logicalStepId: "build", contextReceiptHash: "c".repeat(64), durationMs: 1000, recordedAt: "2026-09-10T00:00:00.000Z" },
        shadow: { runId: "shadow-run", evaluationId: "shadow-evaluation", fingerprint: "b".repeat(64), terminalStatus: "completed", outcome: "passed", validationPassed: true, needsHuman: false, modelProfile: "standard", agentRole: "builder", logicalStepId: "build", contextReceiptHash: "c".repeat(64), durationMs: 800, recordedAt: "2026-09-10T00:01:00.000Z" },
        verdict: "improving",
        createdAt: "2026-09-10T00:02:00.000Z",
        path: "wiki/decisions/learning/experiments/shadow-verified/ledger-pairs/ledger-pair-verified.md",
      },
    ],
    controlBundleBudgetReceipts: [
      {
        id: "budget-verified",
        canaryId: "canary-verified",
        canaryFingerprint: "c".repeat(64),
        proposalFingerprint: "p".repeat(64),
        bundleId: "bundle-verified",
        bundleFingerprint: "b".repeat(64),
        runId: "selected-run",
        selectionBucket: 2,
        assignmentFingerprint: "d".repeat(64),
        modelProfiles: { cheap: "qwen3.5:4b", standard: "qwen3.5:4b", deep: "qwen3.5:4b" },
        limits: { executionTimeoutMs: 120000, maxRetries: 3, contextBytes: 16000 },
        allowedTools: [],
        status: "reserved",
        createdAt: "2026-09-10T00:03:00.000Z",
        path: "wiki/decisions/control-bundles/budgets/budget-verified.md",
      },
    ],
  }),
}));

describe("SettingsView", () => {
  it("shows the catalogued harness capabilities and their safety state", () => {
    render(<SettingsView />);

    expect(screen.getByRole("heading", { name: "Tool capabilities" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Refresh operator state" })).toBeInTheDocument();
    expect(screen.getByText("QA model")).toBeInTheDocument();
    expect(screen.getByText("qwen3.5:9b")).toBeInTheDocument();
    expect(screen.getByText("Query wiki memory")).toBeInTheDocument();
    expect(screen.getByText(/read · automatic/i)).toBeInTheDocument();
    expect(screen.getByText("Adapter: policy-only")).toBeInTheDocument();
    expect(screen.getByText("No tool adapter is callable yet.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Evaluation ledger" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Learning candidates" })).toBeInTheDocument();
    expect(screen.getByLabelText("Operator note")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accept for experiment" })).toBeDisabled();
    expect(screen.getByText("Governance receipts")).toBeInTheDocument();
    expect(screen.getByText(/proposal-verified/i)).toBeInTheDocument();
    expect(screen.getByText(/canary-verified/i)).toBeInTheDocument();
    expect(screen.getByText(/docs\/note.md/i)).toBeInTheDocument();
    expect(screen.getByText("Supervised code worktrees")).toBeInTheDocument();
    expect(screen.getByText(/apps\/api\/sample.ts/i)).toBeInTheDocument();
    expect(screen.getByText("api-tests cancelled")).toBeInTheDocument();
    expect(screen.getByText("Paired ledger evidence")).toBeInTheDocument();
    expect(screen.getByText(/baseline-run → shadow-run/i)).toBeInTheDocument();
    expect(screen.getByText("Frozen canary budgets")).toBeInTheDocument();
    expect(screen.getByText(/bucket 2 · selected-run/i)).toBeInTheDocument();
  });
});
