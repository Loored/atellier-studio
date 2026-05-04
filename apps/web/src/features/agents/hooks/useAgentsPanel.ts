import { useCreateAgentApi, useAgentsApi } from "../../../api/hooks/agents/useAgentsApi";

export function useAgentsPanel() {
  const {
    data: agentList = [],
    isFetching: isFetchingAgents,
    isLoadingWithoutCache: isLoadingAgentsWithoutCache,
  } = useAgentsApi();
  const createAgent = useCreateAgentApi();

  return {
    agentList,
    isFetchingAgents,
    isLoadingAgentsWithoutCache,
    isCreatingAgent: createAgent.isPending,
    createBuilderAgent: () =>
      createAgent.mutate({
        name: "Builder Agent",
        role: "builder",
        status: "idle",
      }),
  };
}
