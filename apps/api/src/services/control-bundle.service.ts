import type {
  ControlBundle,
  ControlBundleApproval,
  ControlBundleCanary,
  ControlBundleProposal,
  CreateControlBundleInput,
  ExecutionBudgetReceipt,
  EvaluationLedgerEvidenceComparison,
  EvaluationLedgerEvidencePair,
  EvaluationLedgerReceiptReference,
  GrantControlBundleApprovalInput,
  RecordEvaluationLedgerEvidencePairInput,
} from "@atellier/shared";
import { RunService } from "./run.service";
import { WikiService } from "./wiki.service";

export class ControlBundleRunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run ${runId} was not found.`);
    this.name = "ControlBundleRunNotFoundError";
  }
}

export class ControlBundleRuntimeBudgetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ControlBundleRuntimeBudgetError";
  }
}

/**
 * Coordinates the current Control Bundle governance records.
 *
 * This service intentionally does not activate runtime routing or canaries yet.
 * It gives the HTTP boundary one owner while the durable Markdown records remain
 * in WikiService until the later persistence/state-machine slice.
 */
export class ControlBundleService {
  constructor(
    private readonly wiki: WikiService,
    private readonly runs: RunService,
  ) {}

  createBundle(input: CreateControlBundleInput): Promise<ControlBundle> {
    return this.wiki.createControlBundle(input);
  }

  getBundle(bundleId: string): Promise<ControlBundle | null> {
    return this.wiki.getControlBundle(bundleId);
  }

  listBundles(): Promise<ControlBundle[]> {
    return this.wiki.listControlBundles();
  }

  async createProposal(input: { experimentId: string; bundleId: string; rationale: string }): Promise<ControlBundleProposal> {
    const [bundle, comparison] = await Promise.all([
      this.wiki.getControlBundle(input.bundleId),
      this.wiki.compareEvaluationLedgerEvidence(input.experimentId),
    ]);
    if (!bundle) throw new Error("Control Bundle does not exist.");
    if (!comparison.eligibility.eligibleForProposal) {
      throw new Error(comparison.eligibility.reasons.join(" "));
    }
    if (comparison.shadowConfigurationFingerprint !== bundle.fingerprint) {
      throw new Error("Paired shadow evidence was not produced by this exact Control Bundle configuration.");
    }
    return this.wiki.createControlBundleProposal(input);
  }

  async recordEvaluationLedgerEvidencePair(input: RecordEvaluationLedgerEvidencePairInput): Promise<EvaluationLedgerEvidencePair> {
    const [baseline, shadow] = await Promise.all([
      this.runs.getEvaluationReceipt(input.baseline.runId, input.baseline.evaluationId),
      this.runs.getEvaluationReceipt(input.shadow.runId, input.shadow.evaluationId),
    ]);
    if (!baseline || !shadow) throw new Error("A referenced Evaluation Ledger receipt does not exist.");
    return this.wiki.recordEvaluationLedgerEvidencePair({
      experimentId: input.experimentId,
      baseline: this.toEvidenceReference(baseline),
      shadow: this.toEvidenceReference(shadow),
    });
  }

  listEvaluationLedgerEvidencePairs(experimentId: string): Promise<EvaluationLedgerEvidencePair[]> {
    return this.wiki.listEvaluationLedgerEvidencePairs(experimentId);
  }

  listAllEvaluationLedgerEvidencePairs(): Promise<EvaluationLedgerEvidencePair[]> {
    return this.wiki.listAllEvaluationLedgerEvidencePairs();
  }

  compareEvaluationLedgerEvidence(experimentId: string): Promise<EvaluationLedgerEvidenceComparison> {
    return this.wiki.compareEvaluationLedgerEvidence(experimentId);
  }

  grantApproval(input: GrantControlBundleApprovalInput): Promise<ControlBundleApproval> {
    return this.wiki.grantControlBundleApproval(input);
  }

  getProposal(proposalId: string): Promise<ControlBundleProposal | null> {
    return this.wiki.getControlBundleProposal(proposalId);
  }

  listProposals(): Promise<ControlBundleProposal[]> {
    return this.wiki.listControlBundleProposals();
  }

  verifyApproval(proposalId: string): Promise<{ approved: boolean; approval?: ControlBundleApproval }> {
    return this.wiki.verifyControlBundleApproval(proposalId);
  }

  listApprovals(proposalId?: string): Promise<ControlBundleApproval[]> {
    return this.wiki.listControlBundleApprovals(proposalId);
  }

  planCanary(input: { proposalId: string; samplePercent: number }): Promise<ControlBundleCanary> {
    return this.wiki.planControlBundleCanary(input);
  }

  rollbackCanary(canaryId: string, reason: string): Promise<ControlBundleCanary> {
    return this.wiki.rollbackControlBundleCanary(canaryId, reason);
  }

  getCanary(canaryId: string): Promise<ControlBundleCanary | null> {
    return this.wiki.getControlBundleCanary(canaryId);
  }

  listCanaries(): Promise<ControlBundleCanary[]> {
    return this.wiki.listControlBundleCanaries();
  }

  async reserveCanaryExecutionBudget(input: { canaryId: string; runId: string }): Promise<ExecutionBudgetReceipt> {
    const run = await this.runs.getById(input.runId);
    if (!run) {
      throw new ControlBundleRunNotFoundError(input.runId);
    }
    const receipt = await this.wiki.reserveCanaryExecutionBudget(input);
    if (receipt.status === "reserved" && run.type === "orchestration") {
      const bound = await this.runs.bindExecutionBudget(run.id, receipt);
      if (!bound) throw new ControlBundleRuntimeBudgetError("Canary budget can only bind to a queued orchestration before its first attempt.");
    }
    return receipt;
  }

  async resolveRuntimeBudget(run: import("@atellier/shared").Run): Promise<ExecutionBudgetReceipt | undefined> {
    const input = run.input && typeof run.input === "object" ? run.input as Record<string, unknown> : {};
    const receiptId = typeof input.controlBudgetReceiptId === "string" ? input.controlBudgetReceiptId : undefined;
    if (!receiptId) return undefined;
    const receipt = (await this.wiki.listExecutionBudgetReceipts()).find((candidate) => candidate.id === receiptId);
    if (!receipt || receipt.status !== "reserved" || receipt.runId !== run.id) {
      throw new ControlBundleRuntimeBudgetError("Bound canary execution budget is missing or invalid.");
    }
    const canary = await this.wiki.getControlBundleCanary(receipt.canaryId);
    if (!canary || canary.status !== "planned") {
      throw new ControlBundleRuntimeBudgetError("Bound canary was rolled back or is no longer executable.");
    }
    if (canary.fingerprint !== receipt.canaryFingerprint || canary.bundleFingerprint !== receipt.bundleFingerprint) {
      throw new ControlBundleRuntimeBudgetError("Bound canary provenance no longer matches its reserved budget.");
    }
    return receipt;
  }

  listExecutionBudgetReceipts(): Promise<ExecutionBudgetReceipt[]> {
    return this.wiki.listExecutionBudgetReceipts();
  }

  private toEvidenceReference(receipt: import("@atellier/shared").AgentRunEvaluation): EvaluationLedgerReceiptReference {
    const logicalStepId = receipt.orchestration?.logicalStepId;
    if (!receipt.contextReceiptHash || !receipt.agentRole || !logicalStepId || !/^[a-f0-9]{64}$/.test(receipt.configurationFingerprint ?? "")) {
      throw new Error("Evaluation Ledger receipt lacks the required context, role, logical-step, or configuration provenance.");
    }
    return {
      runId: receipt.runId,
      evaluationId: receipt.evaluationId,
      fingerprint: receipt.fingerprint,
      terminalStatus: receipt.terminalStatus,
      outcome: receipt.outcome,
      validationPassed: receipt.validationPassed,
      needsHuman: receipt.needsHuman,
      modelProfile: receipt.modelProfile,
      configurationFingerprint: receipt.configurationFingerprint!,
      agentRole: receipt.agentRole,
      logicalStepId,
      contextReceiptHash: receipt.contextReceiptHash,
      durationMs: receipt.durationMs,
      recordedAt: receipt.recordedAt,
    };
  }
}
