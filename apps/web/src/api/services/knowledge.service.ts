import type {
  KnowledgeGraphResponse,
  KnowledgeGraphSnapshotListResponse,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const knowledgeService = {
  async readGraph(): Promise<KnowledgeGraphResponse> {
    const response = await httpClient.get<KnowledgeGraphResponse>("/knowledge/graph");
    return response.data;
  },

  async listSnapshots(): Promise<KnowledgeGraphSnapshotListResponse> {
    const response = await httpClient.get<KnowledgeGraphSnapshotListResponse>(
      "/knowledge/graph/snapshots",
    );
    return response.data;
  },

  async readSnapshot(id: string): Promise<KnowledgeGraphResponse> {
    const response = await httpClient.get<KnowledgeGraphResponse>(
      `/knowledge/graph/snapshots/${encodeURIComponent(id)}`,
    );
    return response.data;
  },
};
