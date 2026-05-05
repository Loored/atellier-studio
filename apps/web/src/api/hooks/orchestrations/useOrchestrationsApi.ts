import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  OrchestrationSkillSummary,
  SkillOrchestrationResult,
  StartSkillOrchestrationInput,
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

export type UseStartSkillOrchestrationApiOptions =
  UseMutationOptions<SkillOrchestrationResult, Error, StartSkillOrchestrationInput>;

export function useStartSkillOrchestrationApi(options: UseStartSkillOrchestrationApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<SkillOrchestrationResult, Error, StartSkillOrchestrationInput>(
    {
      mutationFn: (input) => orchestrationsService.startSkillRun(input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess("Skill orchestration completed");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(result.orchestrationRun.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page("wiki/deliverables/index.md") }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
