import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type { Agent, CreateAgentInput, UpdateAgentStatusInput } from "@atellier/shared";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { queryKeys } from "../../query/queryKeys";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { agentsService } from "../../services/agents.service";

export function useAgentsApi() {
  return useQueryInstance<Agent[]>({
    queryKey: queryKeys.agents.all,
    queryFn: agentsService.list,
  });
}

export type UseCreateAgentApiOptions = UseMutationOptions<Agent, Error, CreateAgentInput>;

export function useCreateAgentApi(options: UseCreateAgentApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Agent, Error, CreateAgentInput>(
    {
      mutationFn: (input) => agentsService.create(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Agent created");
        await queryClient.invalidateQueries({ queryKey: queryKeys.agents.all });
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UpdateAgentStatusVariables = {
  agentId: string;
  input: UpdateAgentStatusInput;
};

export type UseUpdateAgentStatusApiOptions = UseMutationOptions<Agent, Error, UpdateAgentStatusVariables>;

export function useUpdateAgentStatusApi(options: UseUpdateAgentStatusApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError } = useApiAlerts();

  return useMutationInstance<Agent, Error, UpdateAgentStatusVariables>(
    {
      mutationFn: ({ agentId, input }) => agentsService.updateStatus(agentId, input),
      ...options,
    },
    {
      onSuccess: async (agent) => {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
