import type {
  AppendRunLogInput,
  CaptureRunMemoryInput,
  CaptureRunMemoryResponse,
  CompleteRunInput,
  CurateRunLearningInput,
  CurateRunLearningResponse,
  CreateRunInput,
  ListRunsInput,
  ResolveRunLearningSignalInput,
  ResolveRunLearningSignalResponse,
  RecordContextReceiptEvaluationInput,
  ContextReceiptEvaluationSummary,
  AutomatedContextReceiptAssessmentSummary,
  Run,
  RunEventsResponse,
  UpdateRunReviewInput,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const runsService = {
  async list(input: ListRunsInput = {}): Promise<Run[]> {
    const response = await httpClient.get<Run[]>("/runs", {
      params: {
        type: input.type,
        status: input.statuses?.join(","),
        limit: input.limit,
      },
    });
    return response.data;
  },

  async getById(runId: string): Promise<Run> {
    const response = await httpClient.get<Run>(`/runs/${runId}`);
    return response.data;
  },

  async listEvents(runId: string): Promise<RunEventsResponse> {
    const response = await httpClient.get<RunEventsResponse>(`/runs/${runId}/events`, {
      params: { limit: 200 },
    });
    return response.data;
  },

  async cancel(runId: string): Promise<Run> {
    const response = await httpClient.post<Run>(`/runs/${runId}/cancel`);
    return response.data;
  },

  async retry(runId: string): Promise<Run> {
    const response = await httpClient.post<Run>(`/runs/${runId}/retry`);
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

  async recordContextEvaluation(runId: string, input: RecordContextReceiptEvaluationInput): Promise<Run> {
    const response = await httpClient.post<Run>(`/runs/${runId}/context-evaluation`, input);
    return response.data;
  },

  async getContextEvaluationSummary(): Promise<ContextReceiptEvaluationSummary> {
    const response = await httpClient.get<ContextReceiptEvaluationSummary>("/runs/context-evaluation-summary");
    return response.data;
  },

  async getAutomatedContextAssessmentSummary(): Promise<AutomatedContextReceiptAssessmentSummary> {
    const response = await httpClient.get<AutomatedContextReceiptAssessmentSummary>("/runs/context-auto-assessment-summary");
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

  async curateLearning(runId: string, input: CurateRunLearningInput): Promise<CurateRunLearningResponse> {
    const response = await httpClient.post<CurateRunLearningResponse>(`/runs/${runId}/curate-learning`, input);
    return response.data;
  },

  async resolveLearningSignal(
    runId: string,
    input: ResolveRunLearningSignalInput,
  ): Promise<ResolveRunLearningSignalResponse> {
    const response = await httpClient.post<ResolveRunLearningSignalResponse>(
      `/runs/${runId}/resolve-learning-signal`,
      input,
    );
    return response.data;
  },
};
