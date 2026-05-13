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
import { useKnowledgeGraphApi } from "../../../api/hooks/knowledge/useKnowledgeApi";
import { useUrlNullable, useUrlSetState, useUrlState } from "./useUrlState";

const ALL_NODE_TYPES = "all";
const ALL_QUALITIES = "all";

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
  const [searchQuery, setSearchQuery] = useState("");

  const {
    data: knowledgeGraph,
    isFetching: isFetchingKnowledgeGraph,
    error: knowledgeGraphError,
    refetch,
    dataUpdatedAt,
  } = useKnowledgeGraphApi();

  const previousNodeIdsRef = useRef<Set<string>>(new Set());
  const [recentlyAddedNodeIds, setRecentlyAddedNodeIds] = useState<Set<string>>(new Set());

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
      return matchesType && matchesQuality && matchesLayer;
    });
  }, [knowledgeGraph?.nodes, nodeTypeFilter, qualityFilter, activeLayers]);

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
    selectedNode,
    selectedNodeEdges,
    isFetchingKnowledgeGraph,
    knowledgeGraphError,
    refetch,
    dataUpdatedAt,
    recentlyAddedNodeIds,
    searchQuery,
    setSearchQuery,
    searchMatches,
    matchedNodeIds,
  };
}
