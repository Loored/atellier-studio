import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  Agent,
  AgentRunStreamEvent,
  AgentMessage,
  CreateAgentInput,
  RunAgentInput,
  RunAgentResult,
  UpdateAgentInstructionsInput,
  UpdateAgentStatusInput,
} from "@atellier/shared";
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

export function useAgentMessagesApi(agentId: string) {
  return useQueryInstance<AgentMessage[]>({
    queryKey: queryKeys.agents.messages(agentId),
    queryFn: () => agentsService.listMessages(agentId),
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

export type UpdateAgentInstructionsVariables = {
  agentId: string;
  input: UpdateAgentInstructionsInput;
};

export type UseUpdateAgentInstructionsApiOptions =
  UseMutationOptions<Agent, Error, UpdateAgentInstructionsVariables>;

export function useUpdateAgentInstructionsApi(options: UseUpdateAgentInstructionsApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<Agent, Error, UpdateAgentInstructionsVariables>(
    {
      mutationFn: ({ agentId, input }) => agentsService.updateInstructions(agentId, input),
      ...options,
    },
    {
      onSuccess: async (agent) => {
        notifySuccess("Agent instructions updated");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(agent.id) }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type RunAgentVariables = {
  agentId: string;
  input: RunAgentInput;
};

export type UseRunAgentApiOptions = UseMutationOptions<RunAgentResult, Error, RunAgentVariables>;

export function useRunAgentApi(options: UseRunAgentApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<RunAgentResult, Error, RunAgentVariables>(
    {
      mutationFn: ({ agentId, input }) => agentsService.run(agentId, input),
      ...options,
    },
    {
      onSuccess: async (result) => {
        notifySuccess("Agent run completed");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(result.agent.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.messages(result.agent.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.detail(result.run.id) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type RunAgentStreamVariables = {
  agentId: string;
  input: RunAgentInput;
  onEvent: (event: AgentRunStreamEvent) => void;
};

export type UseRunAgentStreamApiOptions = UseMutationOptions<void, Error, RunAgentStreamVariables>;

export function useRunAgentStreamApi(options: UseRunAgentStreamApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();

  return useMutationInstance<void, Error, RunAgentStreamVariables>(
    {
      mutationFn: ({ agentId, input, onEvent }) => agentsService.runStream(agentId, input, onEvent),
      ...options,
    },
    {
      onSuccess: async (_result, variables) => {
        notifySuccess("Agent run completed");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.detail(variables.agentId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.agents.messages(variables.agentId) }),
          queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
          queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}
