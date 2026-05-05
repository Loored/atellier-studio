import type {
  OrchestrationSkillId,
  OrchestrationSkillSummary,
  SkillOrchestrationResult,
  StartSkillOrchestrationInput,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const orchestrationsService = {
  async listSkills(): Promise<OrchestrationSkillSummary[]> {
    const response = await httpClient.get<OrchestrationSkillSummary[]>("/orchestrations/skills");
    return response.data;
  },

  async startSkillRun(input: StartSkillOrchestrationInput): Promise<SkillOrchestrationResult> {
    const response = await httpClient.post<SkillOrchestrationResult>(
      `/orchestrations/skills/${input.skillId}/run`,
      {
        goal: input.goal,
        context: input.context,
        taskId: input.taskId,
      },
    );
    return response.data;
  },
};

export type StartSkillRunVariables = {
  skillId: OrchestrationSkillId;
  goal: string;
  context?: string;
  taskId?: string;
};
