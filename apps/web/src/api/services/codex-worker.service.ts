import type {
  CodexWorkerFinalizeEvidence,
  CodexWorkerMode,
  CodexWorkerProfile,
  CodexWorkerStep,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

type CodexWorkerView = {
  run: { id: string; status: string; output?: { finalize?: { runLog?: string; finalizedAt?: string; evidence?: CodexWorkerFinalizeEvidence } } };
  mode: CodexWorkerMode;
  profile: CodexWorkerProfile;
  goal: string;
  steps: CodexWorkerStep[];
};

export const codexWorkerService = {
  async create(input: { goal: string; mode: CodexWorkerMode; profile: CodexWorkerProfile }) {
    const response = await httpClient.post<{ id: string }>("/codex/runs", input);
    return response.data;
  },
  async get(runId: string) {
    const response = await httpClient.get<CodexWorkerView>(`/codex/runs/${runId}`);
    return response.data;
  },
  async getActive(): Promise<CodexWorkerView | null> {
    const response = await httpClient.get<CodexWorkerView | null>("/codex/runs/active");
    return response.data ?? null;
  },
  async plan(runId: string) {
    const response = await httpClient.post(`/codex/runs/${runId}/plan`);
    return response.data;
  },
  async approveStep(runId: string, stepId: string) {
    const response = await httpClient.post(`/codex/runs/${runId}/approve-step`, { stepId });
    return response.data;
  },
  async executeNext(runId: string) {
    const response = await httpClient.post(`/codex/runs/${runId}/execute-next`);
    return response.data;
  },
  async cancel(runId: string) {
    const response = await httpClient.post(`/codex/runs/${runId}/cancel`);
    return response.data;
  },
  async finalize(runId: string, summary?: string) {
    const response = await httpClient.post(`/codex/runs/${runId}/finalize`, { summary });
    return response.data;
  },
};
