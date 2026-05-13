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
