import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  OrchestrationSkillSummary,
  OrchestrationStatusResult,
  StartSkillOrchestrationInput,
  StartSkillOrchestrationResponse,
} from "@atellier/shared";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { orchestrationsService } from "../../services/orchestrations.service";

export function useOrchestrationSkillsApi() {
  return useQueryInstance<OrchestrationSkillSummary[]>({
    queryKey: queryKeys.orchestrations.skills,
    queryFn: orchestrationsService.listSkills,
  });
}

const TERMINAL_RUN_STATUSES = ["completed", "failed", "blocked", "cancelled"] as const;
const TERMINAL_EXECUTION_PHASES = ["completed", "failed", "blocked", "cancelled"] as const;

export function isOrchestrationStatusSettled(data?: OrchestrationStatusResult): boolean {
  if (!data || !TERMINAL_RUN_STATUSES.includes(data.status as (typeof TERMINAL_RUN_STATUSES)[number])) {
    return false;
  }
  if (!data.execution) {
    return true;
  }
  return TERMINAL_EXECUTION_PHASES.includes(
    data.execution.phase as (typeof TERMINAL_EXECUTION_PHASES)[number],
  );
}

export function useOrchestrationStatusApi(runId: string | null) {
  return useQueryInstance<OrchestrationStatusResult>({
    queryKey: queryKeys.orchestrations.status(runId ?? ""),
    queryFn: () => orchestrationsService.getStatus(runId!),
    enabled: !!runId,
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data as OrchestrationStatusResult | undefined;
      if (!data) return 2_000;
      return isOrchestrationStatusSettled(data) ? false : 2_000;
    },
  });
}

export type UseStartSkillOrchestrationApiOptions =
  UseMutationOptions<StartSkillOrchestrationResponse, Error, StartSkillOrchestrationInput>;

export function useStartSkillOrchestrationApi(options: UseStartSkillOrchestrationApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError } = useApiAlerts();

  return useMutationInstance<StartSkillOrchestrationResponse, Error, StartSkillOrchestrationInput>(
    {
      mutationFn: (input) => orchestrationsService.startSkillRun(input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.activeOrchestrations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.orchestrations.status(result.runId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.tasks.all }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
