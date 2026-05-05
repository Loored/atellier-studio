import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  AppendRunLogInput,
  CompleteRunInput,
  CreateRunInput,
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
    queryFn: runsService.list,
  });
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
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
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
