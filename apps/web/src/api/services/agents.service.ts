import type { Agent, CreateAgentInput, UpdateAgentStatusInput } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const agentsService = {
  async list(): Promise<Agent[]> {
    const response = await httpClient.get<Agent[]>("/agents");
    return response.data;
  },

  async create(input: CreateAgentInput): Promise<Agent> {
    const response = await httpClient.post<Agent>("/agents", input);
    return response.data;
  },

  async updateStatus(agentId: string, input: UpdateAgentStatusInput): Promise<Agent> {
    const response = await httpClient.patch<Agent>(`/agents/${agentId}/status`, input);
    return response.data;
  },
};
