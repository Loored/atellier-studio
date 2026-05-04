import type { AppendRunLogInput, CompleteRunInput, CreateRunInput, Run } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const runsService = {
  async list(): Promise<Run[]> {
    const response = await httpClient.get<Run[]>("/runs");
    return response.data;
  },

  async create(input: CreateRunInput): Promise<Run> {
    const response = await httpClient.post<Run>("/runs", input);
    return response.data;
  },

  async appendLog(runId: string, input: AppendRunLogInput): Promise<Run> {
    const response = await httpClient.patch<Run>(`/runs/${runId}/log`, input);
    return response.data;
  },

  async complete(runId: string, input: CompleteRunInput): Promise<Run> {
    const response = await httpClient.patch<Run>(`/runs/${runId}/complete`, input);
    return response.data;
  },
};
