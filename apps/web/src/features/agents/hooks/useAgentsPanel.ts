import { useState } from "react";
import type { AgentRole } from "@atellier/shared";
import { AGENT_ROLES } from "@atellier/shared";
import { useCreateAgentApi, useAgentsApi } from "../../../api/hooks/agents/useAgentsApi";

export function useAgentsPanel() {
  const {
    data: agentList = [],
    isFetching: isFetchingAgents,
    isLoadingWithoutCache: isLoadingAgentsWithoutCache,
  } = useAgentsApi();
  const createAgent = useCreateAgentApi();

  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("builder");

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createAgent.mutate({ name: trimmed, role, status: "idle" }, {
      onSuccess: () => {
        setName("");
        setRole("builder");
      },
    });
  };

  return {
    agentList,
    isFetchingAgents,
    isLoadingAgentsWithoutCache,
    isCreatingAgent: createAgent.isPending,
    name,
    setName,
    role,
    setRole,
    roles: AGENT_ROLES as readonly AgentRole[],
    handleCreate,
  };
}
