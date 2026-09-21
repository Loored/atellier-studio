import type { ControlBundle, ControlBundleCanary, ControlBundleProposal, EvaluationLedgerEvidencePair, EvaluationLedgerSummary, ExecutionBudgetReceipt, LearningCandidate, LearningCandidateDecision, LearningExperiment, LearningShadowComparison, LearningShadowObservation, ReversibleWorkspaceChange, SupervisedCodeChange, ToolHarnessCatalogResponse } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const toolHarnessService = {
  async readCatalog(): Promise<ToolHarnessCatalogResponse> {
    const response = await httpClient.get<ToolHarnessCatalogResponse>("/tool-harness/catalog");
    return response.data;
  },
  async readEvaluationSummary(): Promise<EvaluationLedgerSummary> {
    const response = await httpClient.get<EvaluationLedgerSummary>("/evaluations/summary");
    return response.data;
  },
  async listLearningCandidates(): Promise<{ candidates: LearningCandidate[] }> {
    const response = await httpClient.get<{ candidates: LearningCandidate[] }>("/evaluations/candidates");
    return response.data;
  },
  async decideLearningCandidate(input: Omit<LearningCandidateDecision, "decidedAt">): Promise<LearningCandidateDecision & { path: string; created: boolean }> {
    const response = await httpClient.post<LearningCandidateDecision & { path: string; created: boolean }>("/evaluations/candidates/decisions", input);
    return response.data;
  },
  async prepareLearningExperiment(input: { candidateId: string; evidenceDigest: string; note: string }): Promise<LearningExperiment & { created: boolean }> {
    const response = await httpClient.post<LearningExperiment & { created: boolean }>("/evaluations/candidates/experiments", input);
    return response.data;
  },
  async recordLearningShadowObservation(input: Omit<LearningShadowObservation, "observedAt" | "path">): Promise<LearningShadowObservation> {
    const response = await httpClient.post<LearningShadowObservation>(`/evaluations/experiments/${encodeURIComponent(input.experimentId)}/observations`, input);
    return response.data;
  },
  async compareLearningShadowExperiment(experimentId: string): Promise<LearningShadowComparison> {
    const response = await httpClient.get<LearningShadowComparison>(`/evaluations/experiments/${encodeURIComponent(experimentId)}/comparison`);
    return response.data;
  },
  async listControlBundles(): Promise<{ bundles: ControlBundle[] }> { const response = await httpClient.get<{ bundles: ControlBundle[] }>("/control-bundles"); return response.data; },
  async listControlBundleProposals(): Promise<{ proposals: ControlBundleProposal[] }> { const response = await httpClient.get<{ proposals: ControlBundleProposal[] }>("/control-bundle-proposals"); return response.data; },
  async listControlBundleCanaries(): Promise<{ canaries: ControlBundleCanary[] }> { const response = await httpClient.get<{ canaries: ControlBundleCanary[] }>("/control-bundle-canaries"); return response.data; },
  async listWorkspaceChanges(): Promise<{ changes: ReversibleWorkspaceChange[] }> { const response = await httpClient.get<{ changes: ReversibleWorkspaceChange[] }>("/workspace-changes"); return response.data; },
  async listSupervisedCodeChanges(): Promise<{ changes: SupervisedCodeChange[] }> { const response = await httpClient.get<{ changes: SupervisedCodeChange[] }>("/supervised-code-changes"); return response.data; },
  async prepareSupervisedCodeChange(changeId: string): Promise<SupervisedCodeChange> { const response = await httpClient.post<SupervisedCodeChange>("/supervised-code-changes/prepare", { changeId }); return response.data; },
  async verifySupervisedCodeChange(id: string): Promise<SupervisedCodeChange> { const response = await httpClient.post<SupervisedCodeChange>(`/supervised-code-changes/${encodeURIComponent(id)}/verify`); return response.data; },
  async discardSupervisedCodeChange(id: string): Promise<SupervisedCodeChange> { const response = await httpClient.post<SupervisedCodeChange>(`/supervised-code-changes/${encodeURIComponent(id)}/discard`); return response.data; },
  async listEvaluationLedgerEvidencePairs(): Promise<{ pairs: EvaluationLedgerEvidencePair[] }> { const response = await httpClient.get<{ pairs: EvaluationLedgerEvidencePair[] }>("/evaluation-ledger/pairs"); return response.data; },
  async listControlBundleBudgetReceipts(): Promise<{ receipts: ExecutionBudgetReceipt[] }> { const response = await httpClient.get<{ receipts: ExecutionBudgetReceipt[] }>("/control-bundle-budget-receipts"); return response.data; },
};
