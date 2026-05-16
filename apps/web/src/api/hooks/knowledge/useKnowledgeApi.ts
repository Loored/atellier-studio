import { useEffect, useState } from "react";
import { useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import type {
  KnowledgeFilterPreset,
  KnowledgeFilterPresetCreateInput,
  KnowledgeFilterPresetListResponse,
  KnowledgeGraphResponse,
  KnowledgeNodeAnnotation,
  KnowledgeNodeAnnotationListResponse,
  KnowledgeNodeAnnotationUpsertInput,
  KnowledgeGraphSnapshotListResponse,
} from "@atellier/shared";
import { queryKeys } from "../../query/queryKeys";
import { useApiAlerts } from "../../alerts/useApiAlerts";
import { useMutationInstance } from "../../query/useMutationInstance";
import { useQueryInstance } from "../../query/useQueryInstance";
import { knowledgeService } from "../../services/knowledge.service";

export function useKnowledgeGraphApi() {
  return useQueryInstance<KnowledgeGraphResponse>({
    queryKey: queryKeys.knowledge.graph,
    queryFn: knowledgeService.readGraph,
    refetchInterval: false,
  });
}

export function useKnowledgeSnapshotsApi() {
  return useQueryInstance<KnowledgeGraphSnapshotListResponse>({
    queryKey: queryKeys.knowledge.snapshots,
    queryFn: knowledgeService.listSnapshots,
    refetchInterval: false,
  });
}

export function useKnowledgeAnnotationsApi() {
  return useQueryInstance<KnowledgeNodeAnnotationListResponse>({
    queryKey: queryKeys.knowledge.annotations,
    queryFn: knowledgeService.listAnnotations,
  });
}

export function useKnowledgeFilterPresetsApi() {
  return useQueryInstance<KnowledgeFilterPresetListResponse>({
    queryKey: queryKeys.knowledge.filterPresets,
    queryFn: knowledgeService.listFilterPresets,
  });
}

export type UseSaveKnowledgeAnnotationApiOptions = UseMutationOptions<
  KnowledgeNodeAnnotation,
  Error,
  KnowledgeNodeAnnotationUpsertInput
>;

export function useSaveKnowledgeAnnotationApi(options: UseSaveKnowledgeAnnotationApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<KnowledgeNodeAnnotation, Error, KnowledgeNodeAnnotationUpsertInput>(
    {
      mutationFn: (input) => knowledgeService.saveAnnotation(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Node annotation saved");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.annotations }),
          queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.graph }),
        ]);
      },
      onError: (error) => notifyError(error),
    },
  );
}

export type UseCreateKnowledgeFilterPresetApiOptions = UseMutationOptions<
  KnowledgeFilterPreset,
  Error,
  KnowledgeFilterPresetCreateInput
>;

export function useCreateKnowledgeFilterPresetApi(options: UseCreateKnowledgeFilterPresetApiOptions = {}) {
  const queryClient = useQueryClient();
  const { notifyError, notifySuccess } = useApiAlerts();
  return useMutationInstance<KnowledgeFilterPreset, Error, KnowledgeFilterPresetCreateInput>(
    {
      mutationFn: (input) => knowledgeService.createFilterPreset(input),
      ...options,
    },
    {
      onSuccess: async () => {
        notifySuccess("Filter preset saved");
        await queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.filterPresets });
      },
      onError: (error) => notifyError(error),
    },
  );
}

export function useKnowledgeLiveUpdates() {
  const queryClient = useQueryClient();
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const origin = window.location.origin.replace(/^http/i, "ws");
    const socket = new WebSocket(`${origin}/knowledge/graph/live`);

    socket.onopen = () => {
      setIsConnected(true);
    };

    socket.onmessage = () => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.graph }),
        queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.snapshots }),
      ]);
    };

    socket.onerror = () => {
      setIsConnected(false);
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => {
      socket.close();
    };
  }, [queryClient]);

  useEffect(() => {
    if (isConnected) return;
    const intervalId = window.setInterval(() => {
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.graph }),
        queryClient.invalidateQueries({ queryKey: queryKeys.knowledge.snapshots }),
      ]);
    }, 15_000);
    return () => window.clearInterval(intervalId);
  }, [isConnected, queryClient]);

  return { isKnowledgeLiveConnected: isConnected };
}
