import type { KnowledgeGraphResponse } from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const knowledgeService = {
  async readGraph(): Promise<KnowledgeGraphResponse> {
    const response = await httpClient.get<KnowledgeGraphResponse>("/knowledge/graph");
    return response.data;
  },
};
