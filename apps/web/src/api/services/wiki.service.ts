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
};
