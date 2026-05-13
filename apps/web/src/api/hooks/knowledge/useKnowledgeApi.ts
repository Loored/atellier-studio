import type {
  KnowledgeGraphResponse,
  KnowledgeGraphSnapshotListResponse,
} from "@atellier/shared";
import { queryKeys } from "../../query/queryKeys";
import { useQueryInstance } from "../../query/useQueryInstance";
import { knowledgeService } from "../../services/knowledge.service";

export function useKnowledgeGraphApi() {
  return useQueryInstance<KnowledgeGraphResponse>({
    queryKey: queryKeys.knowledge.graph,
    queryFn: knowledgeService.readGraph,
    refetchInterval: 15_000,
    refetchIntervalInBackground: false,
  });
}

export function useKnowledgeSnapshotsApi() {
  return useQueryInstance<KnowledgeGraphSnapshotListResponse>({
    queryKey: queryKeys.knowledge.snapshots,
    queryFn: knowledgeService.listSnapshots,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  });
}
