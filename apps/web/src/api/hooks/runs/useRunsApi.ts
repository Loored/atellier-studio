import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  AppendRunLogInput,
  CaptureRunMemoryInput,
  CaptureRunMemoryResponse,
  CompleteRunInput,
  CurateRunLearningInput,
  CurateRunLearningResponse,
  CreateRunInput,
  ResolveRunLearningSignalInput,
  ResolveRunLearningSignalResponse,
  RecordContextReceiptEvaluationInput,
  ContextReceiptEvaluationSummary,
  AutomatedContextReceiptAssessmentSummary,
  Run,
  UpdateRunReviewInput,
} from "@atellier/shared";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { runsService } from "../../services/runs.service";

export function useRunsApi() {
  return useQueryInstance<Run[]>({
    queryKey: queryKeys.runs.all,
    queryFn: () => runsService.list(),
  });
}

export function useActiveOrchestrationsApi() {
  return useQueryInstance<Run[]>({
    queryKey: queryKeys.runs.activeOrchestrations,
    queryFn: async () => {
      const runs = await runsService.list({
        type: "orchestration",
        statuses: ["queued", "running"],
        limit: 10,
      });
      return runs.filter((run) => run.type === "orchestration" && ["queued", "running"].includes(run.status));
    },
    staleTime: 0,
    refetchInterval: 2_000,
  });
}

export function useContextReceiptEvaluationSummaryApi() {
  return useQueryInstance<ContextReceiptEvaluationSummary>({
    queryKey: queryKeys.runs.contextEvaluationSummary,
    queryFn: () => runsService.getContextEvaluationSummary(),
  });
}

export function useAutomatedContextReceiptAssessmentSummaryApi() {
  return useQueryInstance<AutomatedContextReceiptAssessmentSummary>({
    queryKey: queryKeys.runs.contextAutoAssessmentSummary,
    queryFn: () => runsService.getAutomatedContextAssessmentSummary(),
  });
}

export function useRunEventsApi(runId: string | null, shouldPoll = true) {
  return useQueryInstance({
    queryKey: queryKeys.runs.events(runId ?? ""),
    queryFn: () => runsService.listEvents(runId!),
    enabled: Boolean(runId),
    staleTime: 0,
    refetchInterval: shouldPoll ? 1_000 : false,
  });
}

export type RunControlVariables = { runId: string };

export function useCancelRunApi(options: UseMutationOptions<Run, Error, RunControlVariables> = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<Run, Error, RunControlVariables>(
    {
      mutationFn: ({ runId }) => runsService.cancel(runId),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess(run.status === "cancelled" ? "Run cancelled" : "Cancellation requested");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.contextEvaluationSummary }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.activeOrchestrations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.events(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.orchestrations.status(run.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export function useRetryRunApi(options: UseMutationOptions<Run, Error, RunControlVariables> = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<Run, Error, RunControlVariables>(
    {
      mutationFn: ({ runId }) => runsService.retry(runId),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Run retry queued");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.activeOrchestrations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.events(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.orchestrations.status(run.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UseCreateRunApiOptions = UseMutationOptions<Run, Error, CreateRunInput>;

export function useCreateRunApi(options: UseCreateRunApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Run, Error, CreateRunInput>(
    {
      mutationFn: (input) => runsService.create(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Run created");
        await queryClient.invalidateQueries({ queryKey: queryKeys.runs.all });
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type AppendRunLogVariables = {
  runId: string;
  input: AppendRunLogInput;
};

export type UseAppendRunLogApiOptions = UseMutationOptions<Run, Error, AppendRunLogVariables>;

export function useAppendRunLogApi(options: UseAppendRunLogApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError } = useApiAlerts();

  return useMutationInstance<Run, Error, AppendRunLogVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.appendLog(runId, input),
      ...options,
    },
    {
      onSuccess: async (run) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.contextEvaluationSummary }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type CompleteRunVariables = {
  runId: string;
  input: CompleteRunInput;
};

export type UseCompleteRunApiOptions = UseMutationOptions<Run, Error, CompleteRunVariables>;

export function useCompleteRunApi(options: UseCompleteRunApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Run, Error, CompleteRunVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.complete(runId, input),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Run completed");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UpdateRunReviewVariables = {
  runId: string;
  input: UpdateRunReviewInput;
};

export type UseUpdateRunReviewApiOptions = UseMutationOptions<Run, Error, UpdateRunReviewVariables>;

export function useUpdateRunReviewApi(options: UseUpdateRunReviewApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Run, Error, UpdateRunReviewVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.updateReview(runId, input),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Run review updated");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type RecordContextEvaluationVariables = {
  runId: string;
  input: RecordContextReceiptEvaluationInput;
};

export function useRecordContextEvaluationApi(
  options: UseMutationOptions<Run, Error, RecordContextEvaluationVariables> = {},
) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<Run, Error, RecordContextEvaluationVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.recordContextEvaluation(runId, input),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Context receipt evaluation saved");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.contextEvaluationSummary }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.orchestrations.status(run.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type PromoteRunDeliverableVariables = {
  runId: string;
};

export type UsePromoteRunDeliverableApiOptions = UseMutationOptions<Run, Error, PromoteRunDeliverableVariables>;

export function usePromoteRunDeliverableApi(options: UsePromoteRunDeliverableApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Run, Error, PromoteRunDeliverableVariables>(
    {
      mutationFn: ({ runId }) => runsService.promoteDeliverable(runId),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Deliverable created");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page("wiki/deliverables/index.md") }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UseUnlinkRunDeliverableApiOptions = UseMutationOptions<Run, Error, PromoteRunDeliverableVariables>;

export function useUnlinkRunDeliverableApi(options: UseUnlinkRunDeliverableApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Run, Error, PromoteRunDeliverableVariables>(
    {
      mutationFn: ({ runId }) => runsService.unlinkDeliverable(runId),
      ...options,
    },
    {
      onSuccess: async (run) => {
        notifySuccess("Deliverable unlinked");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page("wiki/deliverables/index.md") }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type CaptureRunMemoryVariables = {
  runId: string;
  input?: CaptureRunMemoryInput;
};

export type UseCaptureRunMemoryApiOptions = UseMutationOptions<CaptureRunMemoryResponse, Error, CaptureRunMemoryVariables>;

export function useCaptureRunMemoryApi(options: UseCaptureRunMemoryApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<CaptureRunMemoryResponse, Error, CaptureRunMemoryVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.captureMemory(runId, input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess("Run memory captured");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(result.run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.index }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page(result.wikiPath) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type CurateRunLearningVariables = {
  runId: string;
  input: CurateRunLearningInput;
};

export type UseCurateRunLearningApiOptions = UseMutationOptions<
  CurateRunLearningResponse,
  Error,
  CurateRunLearningVariables
>;

export function useCurateRunLearningApi(options: UseCurateRunLearningApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<CurateRunLearningResponse, Error, CurateRunLearningVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.curateLearning(runId, input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess("Approved learning curated");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(result.run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.roleMemory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.graph }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.index }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page(result.roleMemoryPath) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type ResolveRunLearningSignalVariables = {
  runId: string;
  input: ResolveRunLearningSignalInput;
};

export type UseResolveRunLearningSignalApiOptions = UseMutationOptions<
  ResolveRunLearningSignalResponse,
  Error,
  ResolveRunLearningSignalVariables
>;

export function useResolveRunLearningSignalApi(options: UseResolveRunLearningSignalApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<ResolveRunLearningSignalResponse, Error, ResolveRunLearningSignalVariables>(
    {
      mutationFn: ({ runId, input }) => runsService.resolveLearningSignal(runId, input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess("Learning signal resolved");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(result.run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.roleMemory }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.graph }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.index }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page(result.roleMemoryPath) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
