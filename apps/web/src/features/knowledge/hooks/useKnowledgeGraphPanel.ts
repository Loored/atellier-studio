import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KnowledgeGraphLayer,
  KnowledgeGraphNode,
  KnowledgeGraphNodeType,
  KnowledgeGraphQualityState,
} from "@atellier/shared";
import {
  KNOWLEDGE_GRAPH_LAYERS,
  KNOWLEDGE_GRAPH_NODE_TYPES,
  KNOWLEDGE_GRAPH_QUALITY_STATES,
} from "@atellier/shared";
import {
  useCreateKnowledgeFilterPresetApi,
  useKnowledgeAnnotationsApi,
  useKnowledgeFilterPresetsApi,
  useKnowledgeGraphApi,
  useKnowledgeLiveUpdates,
  useKnowledgeRoleMemoryApi,
  useSaveKnowledgeAnnotationApi,
} from "../../../api/hooks/knowledge/useKnowledgeApi";
import { useUrlNullable, useUrlSetState, useUrlState } from "./useUrlState";

const ALL_NODE_TYPES = "all";
const ALL_QUALITIES = "all";
const ALL_DREAM_DECISIONS = "all";

export const KNOWLEDGE_LAYERS = KNOWLEDGE_GRAPH_LAYERS;
export type KnowledgeLayer = KnowledgeGraphLayer;

export const DENSITY_MODES = ["auto", "comfort", "sparse"] as const;
export type DensityMode = (typeof DENSITY_MODES)[number];

export function layerForNode(node: Pick<KnowledgeGraphNode, "type" | "layer">): KnowledgeLayer {
  if (node.layer) return node.layer;
  if (node.type === "wiki-page" || node.type === "deliverable") return "wiki";
  if (node.type === "raw-source") return "raw";
  if (node.type === "run" || node.type === "agent" || node.type === "task") return "runtime";
  return "meta";
}

const NODE_TYPE_VALUES: ReadonlyArray<KnowledgeGraphNodeType | typeof ALL_NODE_TYPES> = [
  ALL_NODE_TYPES,
  ...KNOWLEDGE_GRAPH_NODE_TYPES,
];
const QUALITY_VALUES: ReadonlyArray<KnowledgeGraphQualityState | typeof ALL_QUALITIES> = [
  ALL_QUALITIES,
  ...KNOWLEDGE_GRAPH_QUALITY_STATES,
];

function isValidNodeTypeFilter(
  raw: string,
): raw is KnowledgeGraphNodeType | typeof ALL_NODE_TYPES {
  return (NODE_TYPE_VALUES as ReadonlyArray<string>).includes(raw);
}

function isValidQualityFilter(
  raw: string,
): raw is KnowledgeGraphQualityState | typeof ALL_QUALITIES {
  return (QUALITY_VALUES as ReadonlyArray<string>).includes(raw);
}

function isValidDensityMode(raw: string): raw is DensityMode {
  return (DENSITY_MODES as ReadonlyArray<string>).includes(raw);
}

export function useKnowledgeGraphPanel() {
  const [nodeTypeFilter, setNodeTypeFilter] = useUrlState<
    KnowledgeGraphNodeType | typeof ALL_NODE_TYPES
  >("type", ALL_NODE_TYPES, { isValid: isValidNodeTypeFilter });
  const [qualityFilter, setQualityFilter] = useUrlState<
    KnowledgeGraphQualityState | typeof ALL_QUALITIES
  >("quality", ALL_QUALITIES, { isValid: isValidQualityFilter });
  const [activeLayers, setActiveLayers] = useUrlSetState<KnowledgeLayer>(
    "layer",
    KNOWLEDGE_LAYERS,
    { allValues: KNOWLEDGE_LAYERS },
  );
  const [densityMode, setDensityMode] = useUrlState<DensityMode>("density", "auto", {
    isValid: isValidDensityMode,
  });
  const [selectedNodeId, setSelectedNodeId] = useUrlNullable<string>("selected");
  const [dreamDecisionFilter, setDreamDecisionFilter] = useUrlState<
    "all" | "accepted" | "rejected" | "deferred"
  >("dreamDecision", ALL_DREAM_DECISIONS, {
    isValid: (raw): raw is "all" | "accepted" | "rejected" | "deferred" =>
      raw === "all" || raw === "accepted" || raw === "rejected" || raw === "deferred",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [timelineCursor, setTimelineCursor] = useState<number | null>(null);

  const {
    data: knowledgeGraph,
    isFetching: isFetchingKnowledgeGraph,
    error: knowledgeGraphError,
    refetch,
    dataUpdatedAt,
  } = useKnowledgeGraphApi();
  const { isKnowledgeLiveConnected } = useKnowledgeLiveUpdates();
  const { data: annotationsData } = useKnowledgeAnnotationsApi();
  const { data: filterPresetsData } = useKnowledgeFilterPresetsApi();
  const { data: roleMemoryData } = useKnowledgeRoleMemoryApi();
  const saveAnnotationMutation = useSaveKnowledgeAnnotationApi();
  const createPresetMutation = useCreateKnowledgeFilterPresetApi();

  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const [recentlyAddedNodeIds, setRecentlyAddedNodeIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    function onSelect(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (typeof detail === "string" && detail.length > 0) {
        setSelectedNodeId(detail);
      }
    }
    window.addEventListener("knowledge:select", onSelect);
    return () => window.removeEventListener("knowledge:select", onSelect);
  }, [setSelectedNodeId]);

  useEffect(() => {
    const currentIds = new Set((knowledgeGraph?.nodes ?? []).map((node) => node.id));
    if (previousNodeIdsRef.current.size === 0) {
      previousNodeIdsRef.current = currentIds;
      return;
    }
    const added = new Set<string>();
    for (const id of currentIds) {
      if (!previousNodeIdsRef.current.has(id)) added.add(id);
    }
    previousNodeIdsRef.current = currentIds;
    if (added.size === 0) return;
    setRecentlyAddedNodeIds(added);
    const timer = window.setTimeout(() => setRecentlyAddedNodeIds(new Set()), 6_000);
    return () => window.clearTimeout(timer);
  }, [knowledgeGraph?.nodes]);

  const filteredNodes = useMemo(() => {
    const nodes = knowledgeGraph?.nodes ?? [];
    return nodes.filter((node) => {
      const matchesType = nodeTypeFilter === ALL_NODE_TYPES || node.type === nodeTypeFilter;
      const matchesQuality = qualityFilter === ALL_QUALITIES || node.quality === qualityFilter;
      const matchesLayer = activeLayers.has(layerForNode(node));
      const nodeDreamDecision =
        node.type === "dream-decision" && typeof node.metadata?.decision === "string"
          ? node.metadata.decision
          : null;
      const matchesDreamDecision =
        dreamDecisionFilter === ALL_DREAM_DECISIONS ||
        nodeDreamDecision === dreamDecisionFilter;
      const matchesTimeline =
        timelineCursor === null ||
        !node.updatedAt ||
        Date.parse(node.updatedAt) <= timelineCursor;
      return matchesType && matchesQuality && matchesLayer && matchesDreamDecision && matchesTimeline;
    });
  }, [knowledgeGraph?.nodes, nodeTypeFilter, qualityFilter, activeLayers, dreamDecisionFilter, timelineCursor]);

  const nodeTimestamps = useMemo(
    () => (knowledgeGraph?.nodes ?? []).map((n) => n.updatedAt).filter((t): t is string => Boolean(t)),
    [knowledgeGraph?.nodes],
  );

  const visibleNodeIds = useMemo(() => new Set(filteredNodes.map((node) => node.id)), [filteredNodes]);

  const filteredEdges = useMemo(() => {
    const edges = knowledgeGraph?.edges ?? [];
    return edges.filter((edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to));
  }, [knowledgeGraph?.edges, visibleNodeIds]);

  const nodeTypes = useMemo(
    () => Object.keys(knowledgeGraph?.stats.byNodeType ?? {}) as KnowledgeGraphNodeType[],
    [knowledgeGraph],
  );
  const qualities = useMemo(
    () => Object.keys(knowledgeGraph?.stats.byQuality ?? {}) as KnowledgeGraphQualityState[],
    [knowledgeGraph],
  );

  const selectedNode = useMemo(
    () => filteredNodes.find((node) => node.id === selectedNodeId) ?? null,
    [filteredNodes, selectedNodeId],
  );
  const selectedNodeAnnotation = useMemo(() => {
    if (!selectedNodeId) return null;
    return annotationsData?.annotations.find((annotation) => annotation.nodeId === selectedNodeId) ?? null;
  }, [annotationsData?.annotations, selectedNodeId]);

  const searchMatches = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase();
    if (trimmed.length === 0) return [];
    return filteredNodes
      .filter((node) => {
        const label = node.label.toLowerCase();
        const path = node.path?.toLowerCase() ?? "";
        return label.includes(trimmed) || path.includes(trimmed);
      })
      .slice(0, 30);
  }, [filteredNodes, searchQuery]);

  const matchedNodeIds = useMemo(() => new Set(searchMatches.map((node) => node.id)), [searchMatches]);

  const selectedNodeEdges = useMemo(() => {
    if (!selectedNodeId) return [];
    return filteredEdges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId);
  }, [filteredEdges, selectedNodeId]);

  const dreamDecisionCounts = useMemo(() => {
    const counts = { accepted: 0, rejected: 0, deferred: 0 };
    for (const node of knowledgeGraph?.nodes ?? []) {
      if (node.type !== "dream-decision") continue;
      const decision = node.metadata?.decision;
      if (decision === "accepted" || decision === "rejected" || decision === "deferred") {
        counts[decision] += 1;
      }
    }
    return counts;
  }, [knowledgeGraph?.nodes]);

  const roleMemoryByRole = useMemo(() => {
    const map = new Map<string, { blocked: number; failed: number; pendingReview: number; focusCount: number }>();
    for (const roleEntry of roleMemoryData?.roles ?? []) {
      map.set(roleEntry.role, {
        blocked: roleEntry.stats.blocked,
        failed: roleEntry.stats.failed,
        pendingReview: roleEntry.stats.pendingReview,
        focusCount: roleEntry.focus.length,
      });
    }
    return map;
  }, [roleMemoryData?.roles]);

  function toggleLayer(layer: KnowledgeLayer): void {
    const next = new Set(activeLayers);
    if (next.has(layer)) {
      if (next.size === 1) return;
      next.delete(layer);
    } else {
      next.add(layer);
    }
    setActiveLayers(next);
  }

  async function saveSelectedNodeAnnotation(note: string, tags: string[]): Promise<void> {
    if (!selectedNodeId) return;
    await saveAnnotationMutation.mutateAsync({
      nodeId: selectedNodeId,
      note,
      tags,
    });
  }

  async function saveCurrentFilterPreset(name: string): Promise<void> {
    await createPresetMutation.mutateAsync({
      name,
      nodeTypeFilter,
      qualityFilter,
      activeLayers: Array.from(activeLayers),
      dreamDecisionFilter,
      densityMode,
    });
  }

  function applyFilterPreset(presetId: string): void {
    const preset = filterPresetsData?.presets.find((item) => item.id === presetId);
    if (!preset) return;
    setNodeTypeFilter(preset.nodeTypeFilter);
    setQualityFilter(preset.qualityFilter);
    setActiveLayers(new Set(preset.activeLayers));
    setDreamDecisionFilter(preset.dreamDecisionFilter);
    setDensityMode(preset.densityMode);
  }

  return {
    knowledgeGraph,
    filteredNodes,
    filteredEdges,
    nodeTypes,
    qualities,
    nodeTypeFilter,
    setNodeTypeFilter,
    qualityFilter,
    setQualityFilter,
    activeLayers,
    toggleLayer,
    densityMode,
    setDensityMode,
    selectedNodeId,
    setSelectedNodeId,
    dreamDecisionFilter,
    setDreamDecisionFilter,
    dreamDecisionCounts,
    roleMemoryByRole,
    filterPresets: filterPresetsData?.presets ?? [],
    selectedNodeAnnotation,
    selectedNode,
    selectedNodeEdges,
    isFetchingKnowledgeGraph,
    isKnowledgeLiveConnected,
    knowledgeGraphError,
    refetch,
    dataUpdatedAt,
    recentlyAddedNodeIds,
    searchQuery,
    setSearchQuery,
    searchMatches,
    matchedNodeIds,
    timelineCursor,
    setTimelineCursor,
    nodeTimestamps,
    isSavingAnnotation: saveAnnotationMutation.isPending,
    isSavingFilterPreset: createPresetMutation.isPending,
    saveSelectedNodeAnnotation,
    saveCurrentFilterPreset,
    applyFilterPreset,
  };
}
