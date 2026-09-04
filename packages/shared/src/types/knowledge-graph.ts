import type { ReviewLearningRecord } from "./review-learning";

export const KNOWLEDGE_GRAPH_NODE_TYPES = [
  "agent",
  "role",
  "task",
  "run",
  "wiki-page",
  "deliverable",
  "lint-issue",
  "raw-source",
  "runtime-log",
  "dream-decision",
] as const;

export type KnowledgeGraphNodeType = (typeof KNOWLEDGE_GRAPH_NODE_TYPES)[number];

export const KNOWLEDGE_GRAPH_EDGE_TYPES = [
  "agent_has_role",
  "agent_assigned_task",
  "run_by_agent",
  "run_for_task",
  "run_created_deliverable",
  "deliverable_is_wiki_page",
  "wiki_page_has_lint_issue",
  "wiki_page_links_to",
  "wiki_page_mentions_raw_source",
  "wiki_page_mentions_runtime_log",
  "dream_decision_for_report",
  "dream_decision_for_proposal",
] as const;

export type KnowledgeGraphEdgeType = (typeof KNOWLEDGE_GRAPH_EDGE_TYPES)[number];

export const KNOWLEDGE_GRAPH_QUALITY_STATES = [
  "verified",
  "proposed",
  "contradicted",
  "stale",
  "orphaned",
  "generated",
] as const;

export type KnowledgeGraphQualityState = (typeof KNOWLEDGE_GRAPH_QUALITY_STATES)[number];

export const KNOWLEDGE_GRAPH_LAYERS = ["wiki", "raw", "runtime", "meta"] as const;

export type KnowledgeGraphLayer = (typeof KNOWLEDGE_GRAPH_LAYERS)[number];

export type KnowledgeGraphNode = {
  id: string;
  type: KnowledgeGraphNodeType;
  layer: KnowledgeGraphLayer;
  label: string;
  path?: string;
  sourceId?: string;
  role?: string;
  status?: string;
  reviewStatus?: string;
  quality: KnowledgeGraphQualityState;
  createdAt?: string;
  updatedAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type KnowledgeGraphEdge = {
  id: string;
  type: KnowledgeGraphEdgeType;
  from: string;
  to: string;
  label: string;
  quality: KnowledgeGraphQualityState;
  createdAt?: string;
  metadata?: Record<string, string | number | boolean | null>;
};

export type KnowledgeGraphResponse = {
  generatedAt: string;
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  stats: {
    nodes: number;
    edges: number;
    byNodeType: Record<KnowledgeGraphNodeType, number>;
    byQuality: Record<KnowledgeGraphQualityState, number>;
    byLayer: Record<KnowledgeGraphLayer, number>;
  };
};

export type KnowledgeGraphSnapshotMeta = {
  id: string;
  generatedAt: string;
  stats: KnowledgeGraphResponse["stats"];
};

export type KnowledgeGraphSnapshotListResponse = {
  snapshots: KnowledgeGraphSnapshotMeta[];
};

export type KnowledgeGraphSnapshotDiffResponse = {
  generatedAt: string;
  baseId: string;
  headId: string;
  nodes: {
    added: number;
    removed: number;
    addedNodeIds: string[];
    removedNodeIds: string[];
  };
  edges: {
    added: number;
    removed: number;
    addedEdgeIds: string[];
    removedEdgeIds: string[];
  };
};

export type KnowledgeNodeAnnotation = {
  nodeId: string;
  note: string;
  tags: string[];
  updatedAt: string;
};

export type KnowledgeNodeAnnotationUpsertInput = {
  nodeId: string;
  note: string;
  tags?: string[];
};

export type KnowledgeNodeAnnotationListResponse = {
  annotations: KnowledgeNodeAnnotation[];
};

export type KnowledgeFilterPreset = {
  id: string;
  name: string;
  nodeTypeFilter: KnowledgeGraphNodeType | "all";
  qualityFilter: KnowledgeGraphQualityState | "all";
  activeLayers: KnowledgeGraphLayer[];
  dreamDecisionFilter: "all" | "accepted" | "rejected" | "deferred";
  densityMode: "auto" | "comfort" | "sparse";
  createdAt: string;
  updatedAt: string;
};

export type KnowledgeFilterPresetCreateInput = {
  name: string;
  nodeTypeFilter: KnowledgeGraphNodeType | "all";
  qualityFilter: KnowledgeGraphQualityState | "all";
  activeLayers: KnowledgeGraphLayer[];
  dreamDecisionFilter: "all" | "accepted" | "rejected" | "deferred";
  densityMode: "auto" | "comfort" | "sparse";
};

export type KnowledgeFilterPresetListResponse = {
  presets: KnowledgeFilterPreset[];
};

export type RoleMemoryRunSummary = {
  runId: string;
  type: string;
  status: string;
  reviewStatus?: string;
  taskId?: string;
  updatedAt: string;
};

export type RoleMemoryEntry = {
  role: string;
  agentIds: string[];
  agentNames: string[];
  stats: {
    agents: number;
    tasks: number;
    runs: number;
    completed: number;
    blocked: number;
    failed: number;
    pendingReview: number;
    curatedLearnings: number;
    curationSignals: number;
    openCurationSignals: number;
    resolvedCurationSignals: number;
  };
  recentRuns: RoleMemoryRunSummary[];
  blockers: string[];
  focus: string[];
  learnings: ReviewLearningRecord[];
};

export type RoleMemoryResponse = {
  generatedAt: string;
  roles: RoleMemoryEntry[];
};
