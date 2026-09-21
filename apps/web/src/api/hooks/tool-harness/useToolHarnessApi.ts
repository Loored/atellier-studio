import type { ControlBundle, ControlBundleCanary, ControlBundleProposal, EvaluationLedgerEvidencePair, EvaluationLedgerSummary, ExecutionBudgetReceipt, LearningCandidate, LearningCandidateDecision, LearningExperiment, LearningShadowComparison, LearningShadowObservation, ReversibleWorkspaceChange, SupervisedCodeChange, ToolHarnessCatalogResponse } from "@atellier/shared";
import { useCallback } from "react";
import { useIsFetching, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { toolHarnessService } from "../../services/tool-harness.service";

const GOVERNANCE_POLL_INTERVAL_MS = 15_000;

async function invalidateGovernanceState(queryClient: QueryClient) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.toolHarness.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
  ]);
}

export async function refreshToolHarnessState(queryClient: Pick<QueryClient, "invalidateQueries">) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.toolHarness.all }),
    queryClient.invalidateQueries({ queryKey: queryKeys.system.health }),
  ]);
}

export function useRefreshToolHarnessStateApi() {
  const queryClient = useQueryClient();
  const isFetchingHarness = useIsFetching({ queryKey: queryKeys.toolHarness.all }) > 0;
  const isFetchingHealth = useIsFetching({ queryKey: queryKeys.system.health }) > 0;
  const refresh = useCallback(async () => {
    await refreshToolHarnessState(queryClient);
  }, [queryClient]);
  return { refreshToolHarnessState: refresh, isRefreshingToolHarnessState: isFetchingHarness || isFetchingHealth };
}

export function useToolHarnessCatalogApi() {
  return useQueryInstance<ToolHarnessCatalogResponse>({
    queryKey: queryKeys.toolHarness.catalog,
    queryFn: toolHarnessService.readCatalog,
    refetchInterval: false,
  });
}

export function useEvaluationLedgerSummaryApi() {
  return useQueryInstance<EvaluationLedgerSummary>({
    queryKey: queryKeys.toolHarness.evaluations,
    queryFn: toolHarnessService.readEvaluationSummary,
    refetchInterval: GOVERNANCE_POLL_INTERVAL_MS,
  });
}

export function useLearningCandidatesApi() {
  return useQueryInstance<{ candidates: LearningCandidate[] }>({ queryKey: queryKeys.toolHarness.candidates, queryFn: toolHarnessService.listLearningCandidates, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS });
}
export function useControlBundlesApi() { return useQueryInstance<{ bundles: ControlBundle[] }>({ queryKey: queryKeys.toolHarness.controlBundles, queryFn: toolHarnessService.listControlBundles, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useControlBundleProposalsApi() { return useQueryInstance<{ proposals: ControlBundleProposal[] }>({ queryKey: queryKeys.toolHarness.controlBundleProposals, queryFn: toolHarnessService.listControlBundleProposals, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useControlBundleCanariesApi() { return useQueryInstance<{ canaries: ControlBundleCanary[] }>({ queryKey: queryKeys.toolHarness.controlBundleCanaries, queryFn: toolHarnessService.listControlBundleCanaries, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useWorkspaceChangesApi() { return useQueryInstance<{ changes: ReversibleWorkspaceChange[] }>({ queryKey: queryKeys.toolHarness.workspaceChanges, queryFn: toolHarnessService.listWorkspaceChanges, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useSupervisedCodeChangesApi() { return useQueryInstance<{ changes: SupervisedCodeChange[] }>({ queryKey: queryKeys.toolHarness.supervisedCodeChanges, queryFn: toolHarnessService.listSupervisedCodeChanges, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useEvaluationLedgerEvidencePairsApi() { return useQueryInstance<{ pairs: EvaluationLedgerEvidencePair[] }>({ queryKey: queryKeys.toolHarness.evaluationLedgerPairs, queryFn: toolHarnessService.listEvaluationLedgerEvidencePairs, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }
export function useControlBundleBudgetReceiptsApi() { return useQueryInstance<{ receipts: ExecutionBudgetReceipt[] }>({ queryKey: queryKeys.toolHarness.controlBundleBudgetReceipts, queryFn: toolHarnessService.listControlBundleBudgetReceipts, refetchInterval: GOVERNANCE_POLL_INTERVAL_MS }); }

export function usePrepareSupervisedCodeChangeApi() {
  const queryClient = useQueryClient(); const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<SupervisedCodeChange, Error, string>(
    { mutationFn: toolHarnessService.prepareSupervisedCodeChange },
    { onSuccess: async () => { notifySuccess("Supervised worktree prepared"); await invalidateGovernanceState(queryClient); }, onError: (error) => notifyError(error) },
  );
}

export function useVerifySupervisedCodeChangeApi() {
  const queryClient = useQueryClient(); const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<SupervisedCodeChange, Error, string>(
    { mutationFn: toolHarnessService.verifySupervisedCodeChange },
    { onSuccess: async () => { notifySuccess("Server verification recorded"); await invalidateGovernanceState(queryClient); }, onError: (error) => notifyError(error) },
  );
}

export function useDiscardSupervisedCodeChangeApi() {
  const queryClient = useQueryClient(); const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<SupervisedCodeChange, Error, string>(
    { mutationFn: toolHarnessService.discardSupervisedCodeChange },
    { onSuccess: async () => { notifySuccess("Supervised worktree discarded"); await invalidateGovernanceState(queryClient); }, onError: (error) => notifyError(error) },
  );
}

export function useDecideLearningCandidateApi() {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<
    LearningCandidateDecision & { path: string; created: boolean },
    Error,
    Omit<LearningCandidateDecision, "decidedAt">
  >(
    { mutationFn: toolHarnessService.decideLearningCandidate },
    {
      onSuccess: async (decision) => {
        notifySuccess(decision.created ? "Learning candidate decision saved" : "Learning candidate decision already recorded");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.toolHarness.candidates }),
          queryClient.invalidateQueries({ queryKey: queryKeys.toolHarness.evaluations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export function usePrepareLearningExperimentApi() {
  const queryClient = useQueryClient(); const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<LearningExperiment & { created: boolean }, Error, { candidateId: string; evidenceDigest: string; note: string }>(
    { mutationFn: toolHarnessService.prepareLearningExperiment },
    { onSuccess: async (result) => { notifySuccess(result.created ? "Shadow experiment prepared" : "Shadow experiment already prepared"); await Promise.all([queryClient.invalidateQueries({ queryKey: queryKeys.toolHarness.candidates }), queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log })]); }, onError: (error) => notifyError(error) },
  );
}

export function useRecordLearningShadowObservationApi() {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<LearningShadowObservation, Error, Omit<LearningShadowObservation, "observedAt" | "path">>(
    { mutationFn: toolHarnessService.recordLearningShadowObservation },
    { onSuccess: async () => { notifySuccess("Shadow observation recorded"); await invalidateGovernanceState(queryClient); }, onError: (error) => notifyError(error) },
  );
}

export function useCompareLearningShadowExperimentApi() {
  return useMutationInstance<LearningShadowComparison, Error, string>({ mutationFn: toolHarnessService.compareLearningShadowExperiment });
}
