import type {
  AppendWikiLogInput,
  AppendWikiLogResponse,
  WikiIngestInput,
  WikiIngestResponse,
  WikiLintResponse,
  WikiPageResponse,
  WikiWritePageInput,
  WikiQueryInput,
  WikiQueryResponse,
  WikiDreamDecisionRecord,
  WikiDreamDecisionRecordInput,
  WikiReflectionInput,
  WikiReflectionReviewResponse,
  WikiReflectionResponse,
  WikiReflectionDecisionInput,
  WikiReflectionDecisionRecord,
  WikiReflectionPromotionInput,
  WikiReflectionPromotionRecord,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const wikiService = {
  async readIndex(): Promise<WikiPageResponse> {
    const response = await httpClient.get<WikiPageResponse>("/wiki/index");
    return response.data;
  },

  async readLog(): Promise<WikiPageResponse> {
    const response = await httpClient.get<WikiPageResponse>("/wiki/log");
    return response.data;
  },

  async readPage(path: string): Promise<WikiPageResponse> {
    const response = await httpClient.get<WikiPageResponse>("/wiki/page", {
      params: { path },
    });
    return response.data;
  },

  async writePage(input: WikiWritePageInput): Promise<WikiPageResponse> {
    const response = await httpClient.post<WikiPageResponse>("/wiki/page", input);
    return response.data;
  },

  async appendLog(input: AppendWikiLogInput): Promise<AppendWikiLogResponse> {
    const response = await httpClient.post<AppendWikiLogResponse>("/wiki/append-log", input);
    return response.data;
  },

  async ingest(input: WikiIngestInput): Promise<WikiIngestResponse> {
    const response = await httpClient.post<WikiIngestResponse>("/wiki/ingest", input);
    return response.data;
  },

  async query(input: WikiQueryInput): Promise<WikiQueryResponse> {
    const response = await httpClient.post<WikiQueryResponse>("/wiki/query", input);
    return response.data;
  },

  async lint(): Promise<WikiLintResponse> {
    const response = await httpClient.post<WikiLintResponse>("/wiki/lint");
    return response.data;
  },

  async reflect(input: WikiReflectionInput = {}): Promise<WikiReflectionResponse> {
    const response = await httpClient.post<WikiReflectionResponse>("/wiki/reflections", input);
    return response.data;
  },

  async readReflectionReview(): Promise<WikiReflectionReviewResponse> {
    const response = await httpClient.get<WikiReflectionReviewResponse>("/wiki/reflections/review");
    return response.data;
  },

  async decideReflection(input: WikiReflectionDecisionInput): Promise<WikiReflectionDecisionRecord> {
    const response = await httpClient.post<WikiReflectionDecisionRecord>("/wiki/reflections/decisions", input);
    return response.data;
  },

  async promoteReflection(input: WikiReflectionPromotionInput): Promise<WikiReflectionPromotionRecord> {
    const response = await httpClient.post<WikiReflectionPromotionRecord>("/wiki/reflections/promote", input);
    return response.data;
  },

  async recordDreamDecision(input: WikiDreamDecisionRecordInput): Promise<WikiDreamDecisionRecord> {
    const response = await httpClient.post<WikiDreamDecisionRecord>("/wiki/dream-decisions", input);
    return response.data;
  },
};
