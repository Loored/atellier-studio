import type { AppendWikiLogInput, AppendWikiLogResponse, WikiPageResponse } from "@atellier/shared";
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

  async appendLog(input: AppendWikiLogInput): Promise<AppendWikiLogResponse> {
    const response = await httpClient.post<AppendWikiLogResponse>("/wiki/append-log", input);
    return response.data;
  },
};
