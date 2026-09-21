import type { LearningCandidate, LearningCandidateDecision } from "@atellier/shared";
import { useState } from "react";
import { useCompareLearningShadowExperimentApi, useControlBundleBudgetReceiptsApi, useControlBundleCanariesApi, useControlBundleProposalsApi, useControlBundlesApi, useDecideLearningCandidateApi, useDiscardSupervisedCodeChangeApi, useEvaluationLedgerEvidencePairsApi, useEvaluationLedgerSummaryApi, useLearningCandidatesApi, usePrepareLearningExperimentApi, usePrepareSupervisedCodeChangeApi, useRecordLearningShadowObservationApi, useRefreshToolHarnessStateApi, useSupervisedCodeChangesApi, useToolHarnessCatalogApi, useVerifySupervisedCodeChangeApi, useWorkspaceChangesApi } from "../../../api/hooks/tool-harness/useToolHarnessApi";

export function useToolHarnessSettings() {
  const [preparedExperiments, setPreparedExperiments] = useState<Record<string, string>>({});
  const [shadowComparisons, setShadowComparisons] = useState<Record<string, import("@atellier/shared").LearningShadowComparison>>({});
  const {
    data: toolHarnessCatalog,
    error: toolHarnessError,
    isLoading: isLoadingToolHarness,
  } = useToolHarnessCatalogApi();
  const { data: evaluationLedgerSummary } = useEvaluationLedgerSummaryApi();
  const { data: learningCandidates } = useLearningCandidatesApi();
  const { data: controlBundles } = useControlBundlesApi();
  const { data: controlBundleProposals } = useControlBundleProposalsApi();
  const { data: controlBundleCanaries } = useControlBundleCanariesApi();
  const { data: workspaceChanges } = useWorkspaceChangesApi();
  const { data: supervisedCodeChanges } = useSupervisedCodeChangesApi();
  const { data: evaluationLedgerEvidencePairs } = useEvaluationLedgerEvidencePairsApi();
  const { data: controlBundleBudgetReceipts } = useControlBundleBudgetReceiptsApi();
  const { mutate: decide, isPending: isDecidingLearningCandidate } = useDecideLearningCandidateApi();
  const { mutate: prepareExperiment, isPending: isPreparingLearningExperiment } = usePrepareLearningExperimentApi();
  const { mutate: recordObservation, isPending: isRecordingShadowObservation } = useRecordLearningShadowObservationApi();
  const { mutate: compareExperiment, isPending: isComparingShadowExperiment } = useCompareLearningShadowExperimentApi();
  const { mutate: prepareSupervisedCodeChange, isPending: isPreparingSupervisedCodeChange } = usePrepareSupervisedCodeChangeApi();
  const { mutate: verifySupervisedCodeChange, isPending: isVerifyingSupervisedCodeChange } = useVerifySupervisedCodeChangeApi();
  const { mutate: discardSupervisedCodeChange, isPending: isDiscardingSupervisedCodeChange } = useDiscardSupervisedCodeChangeApi();
  const { refreshToolHarnessState, isRefreshingToolHarnessState } = useRefreshToolHarnessStateApi();

  return {
    refreshOperatorState: refreshToolHarnessState,
    isRefreshingOperatorState: isRefreshingToolHarnessState,
    toolHarnessCatalog,
    toolHarnessError,
    isLoadingToolHarness,
    evaluationLedgerSummary,
    learningCandidates: learningCandidates?.candidates ?? [],
    controlBundles: controlBundles?.bundles ?? [],
    controlBundleProposals: controlBundleProposals?.proposals ?? [],
    controlBundleCanaries: controlBundleCanaries?.canaries ?? [],
    workspaceChanges: workspaceChanges?.changes ?? [],
    supervisedCodeChanges: supervisedCodeChanges?.changes ?? [],
    evaluationLedgerEvidencePairs: evaluationLedgerEvidencePairs?.pairs ?? [],
    controlBundleBudgetReceipts: controlBundleBudgetReceipts?.receipts ?? [],
    prepareSupervisedCodeChange,
    isPreparingSupervisedCodeChange,
    verifySupervisedCodeChange,
    isVerifyingSupervisedCodeChange,
    discardSupervisedCodeChange,
    isDiscardingSupervisedCodeChange,
    decideLearningCandidate: (candidate: LearningCandidate, decision: LearningCandidateDecision["decision"], note: string) => decide({
      candidateId: candidate.id,
      evidenceDigest: candidate.evidenceDigest,
      decision,
      note,
    }),
    isDecidingLearningCandidate,
    prepareLearningExperiment: (candidate: LearningCandidate, note: string) => prepareExperiment({ candidateId: candidate.id, evidenceDigest: candidate.evidenceDigest, note }, { onSuccess: (result) => setPreparedExperiments((current) => ({ ...current, [candidate.id]: result.id })) }),
    isPreparingLearningExperiment,
    preparedExperiments,
    recordLearningShadowObservation: recordObservation,
    isRecordingShadowObservation,
    compareLearningShadowExperiment: (candidateId: string, experimentId: string) => compareExperiment(experimentId, { onSuccess: (result) => setShadowComparisons((current) => ({ ...current, [candidateId]: result })) }),
    isComparingShadowExperiment,
    shadowComparisons,
  };
}
