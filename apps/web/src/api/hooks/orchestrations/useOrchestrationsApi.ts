import type { UseMutationOptions } from "@tanstack/react-query";
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

export function useOrchestrationStatusApi(runId: string | null) {
  return useQueryInstance<OrchestrationStatusResult>({
    queryKey: queryKeys.orchestrations.status(runId ?? ""),
    queryFn: () => orchestrationsService.getStatus(runId!),
    enabled: !!runId,
    staleTime: 0,
    refetchInterval: (query) => {
      const data = query.state.data as OrchestrationStatusResult | undefined;
      if (!data) return 2_000;
      return data.status === "completed" || data.status === "failed" ? false : 2_000;
    },
  });
}

export type UseStartSkillOrchestrationApiOptions =
  UseMutationOptions<StartSkillOrchestrationResponse, Error, StartSkillOrchestrationInput>;

export function useStartSkillOrchestrationApi(options: UseStartSkillOrchestrationApiOptions = {}) {
  const { notifyError } = useApiAlerts();

  return useMutationInstance<StartSkillOrchestrationResponse, Error, StartSkillOrchestrationInput>(
    {
      mutationFn: (input) => orchestrationsService.startSkillRun(input),
      ...options,
    },
    {
      onError: (error) => notifyError(error),
    },
  );
}
