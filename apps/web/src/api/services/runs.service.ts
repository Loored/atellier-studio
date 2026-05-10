import type {
  AppendRunLogInput,
  CaptureRunMemoryInput,
  CaptureRunMemoryResponse,
  CompleteRunInput,
  CreateRunInput,
  Run,
  UpdateRunReviewInput,
} from "@atellier/shared";
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

  async updateReview(runId: string, input: UpdateRunReviewInput): Promise<Run> {
    const response = await httpClient.patch<Run>(`/runs/${runId}/review`, input);
    return response.data;
  },

  async promoteDeliverable(runId: string): Promise<Run> {
    const response = await httpClient.patch<Run>(`/runs/${runId}/promote-deliverable`);
    return response.data;
  },

  async unlinkDeliverable(runId: string): Promise<Run> {
    const response = await httpClient.patch<Run>(`/runs/${runId}/unlink-deliverable`);
    return response.data;
  },

  async captureMemory(runId: string, input: CaptureRunMemoryInput = {}): Promise<CaptureRunMemoryResponse> {
    const response = await httpClient.post<CaptureRunMemoryResponse>(`/runs/${runId}/capture-memory`, input);
    return response.data;
  },
};
