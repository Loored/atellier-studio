import type { KnowledgeGraphResponse } from "@atellier/shared";
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
