import type {
  KnowledgeFilterPreset,
  KnowledgeFilterPresetCreateInput,
  KnowledgeFilterPresetListResponse,
  KnowledgeNodeAnnotation,
  KnowledgeNodeAnnotationListResponse,
  KnowledgeNodeAnnotationUpsertInput,
  KnowledgeGraphResponse,
  KnowledgeGraphSnapshotDiffResponse,
  KnowledgeGraphSnapshotListResponse,
  RoleMemoryResponse,
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

  async readSnapshotDiff(baseId: string, headId: string): Promise<KnowledgeGraphSnapshotDiffResponse> {
    const response = await httpClient.get<KnowledgeGraphSnapshotDiffResponse>(
      `/knowledge/graph/diff?base=${encodeURIComponent(baseId)}&head=${encodeURIComponent(headId)}`,
    );
    return response.data;
  },

  async listAnnotations(): Promise<KnowledgeNodeAnnotationListResponse> {
    const response = await httpClient.get<KnowledgeNodeAnnotationListResponse>("/knowledge/annotations");
    return response.data;
  },

  async readRoleMemory(): Promise<RoleMemoryResponse> {
    const response = await httpClient.get<RoleMemoryResponse>("/knowledge/role-memory");
    return response.data;
  },

  async saveAnnotation(input: KnowledgeNodeAnnotationUpsertInput): Promise<KnowledgeNodeAnnotation> {
    const response = await httpClient.post<KnowledgeNodeAnnotation>("/knowledge/annotations", input);
    return response.data;
  },

  async listFilterPresets(): Promise<KnowledgeFilterPresetListResponse> {
    const response = await httpClient.get<KnowledgeFilterPresetListResponse>("/knowledge/filter-presets");
    return response.data;
  },

  async createFilterPreset(input: KnowledgeFilterPresetCreateInput): Promise<KnowledgeFilterPreset> {
    const response = await httpClient.post<KnowledgeFilterPreset>("/knowledge/filter-presets", input);
    return response.data;
  },
};
