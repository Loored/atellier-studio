import type {
  OrchestrationSkillSummary,
  OrchestrationStatusResult,
  StartSkillOrchestrationInput,
  StartSkillOrchestrationResponse,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const orchestrationsService = {
  async listSkills(): Promise<OrchestrationSkillSummary[]> {
    const response = await httpClient.get<OrchestrationSkillSummary[]>("/orchestrations/skills");
    return response.data;
  },

  async startSkillRun(input: StartSkillOrchestrationInput): Promise<StartSkillOrchestrationResponse> {
    const response = await httpClient.post<StartSkillOrchestrationResponse>(
      `/orchestrations/skills/${input.skillId}/run`,
      {
        goal: input.goal,
        context: input.context,
        taskId: input.taskId,
        executorModeOverride: input.executorModeOverride,
      },
    );
    return response.data;
  },

  async getStatus(runId: string): Promise<OrchestrationStatusResult> {
    const response = await httpClient.get<OrchestrationStatusResult>(`/orchestrations/${runId}/status`);
    return response.data;
  },
};
