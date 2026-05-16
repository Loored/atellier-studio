import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeGraphNode } from "@atellier/shared";
import { KnowledgeGraphView } from "./KnowledgeGraphView";

const useKnowledgeGraphPanelMock = vi.hoisted(() => vi.fn());

vi.mock("./hooks/useKnowledgeGraphPanel", () => ({
  DENSITY_MODES: ["auto", "comfort", "sparse"],
  KNOWLEDGE_LAYERS: ["wiki", "raw", "runtime", "meta"],
  useKnowledgeGraphPanel: useKnowledgeGraphPanelMock,
}));

vi.mock("./components/ForceGraphCanvas", () => ({
  ForceGraphCanvas: () => null,
}));

vi.mock("./components/KnowledgeInspector", () => ({
  KnowledgeInspector: () => null,
}));

vi.mock("../../api/hooks/knowledge/useKnowledgeApi", () => ({
  useKnowledgeSnapshotsApi: vi.fn(() => ({ data: { snapshots: [] } })),
}));

function makeNode(id: string, label: string, decision: "accepted" | "rejected" | "deferred"): KnowledgeGraphNode {
  return {
    id,
    type: "dream-decision",
    layer: "meta",
    label,
    quality: decision === "accepted" ? "verified" : decision === "rejected" ? "contradicted" : "proposed",
    metadata: { decision },
  };
}

describe("KnowledgeGraphView", () => {
  it("shows dream decision counters and triggers filter change", async () => {
    const user = userEvent.setup();
    const setDreamDecisionFilter = vi.fn();
    const nodes = [
      makeNode("a", "Dream accepted", "accepted"),
      makeNode("b", "Dream rejected", "rejected"),
      makeNode("c", "Dream deferred", "deferred"),
      makeNode("d", "Dream accepted 2", "accepted"),
    ];

    useKnowledgeGraphPanelMock.mockReturnValue({
      knowledgeGraph: {
        generatedAt: "2026-05-13T00:00:00.000Z",
        nodes,
        edges: [],
        stats: {
          nodes: nodes.length,
          edges: 0,
          byNodeType: {
            agent: 0,
            role: 0,
            task: 0,
            run: 0,
            "wiki-page": 0,
            deliverable: 0,
            "lint-issue": 0,
            "raw-source": 0,
            "runtime-log": 0,
            "dream-decision": 4,
          },
          byQuality: { verified: 2, proposed: 1, contradicted: 1, stale: 0, orphaned: 0, generated: 0 },
          byLayer: { wiki: 0, raw: 0, runtime: 0, meta: 4 },
        },
      },
      filteredNodes: nodes,
      filteredEdges: [],
      nodeTypes: ["dream-decision"],
      qualities: ["verified", "proposed", "contradicted"],
      nodeTypeFilter: "all",
      setNodeTypeFilter: vi.fn(),
      qualityFilter: "all",
      setQualityFilter: vi.fn(),
      activeLayers: new Set(["wiki", "raw", "runtime", "meta"]),
      toggleLayer: vi.fn(),
      densityMode: "auto",
      setDensityMode: vi.fn(),
      selectedNodeId: null,
      setSelectedNodeId: vi.fn(),
      dreamDecisionFilter: "all",
      setDreamDecisionFilter,
      dreamDecisionCounts: { accepted: 2, rejected: 1, deferred: 1 },
      filterPresets: [],
      selectedNodeAnnotation: null,
      selectedNode: null,
      selectedNodeEdges: [],
      isFetchingKnowledgeGraph: false,
      isKnowledgeLiveConnected: true,
      knowledgeGraphError: null,
      refetch: vi.fn(),
      dataUpdatedAt: Date.now(),
      recentlyAddedNodeIds: new Set<string>(),
      searchQuery: "",
      setSearchQuery: vi.fn(),
      searchMatches: [],
      matchedNodeIds: new Set<string>(),
      timelineCursor: null,
      setTimelineCursor: vi.fn(),
      nodeTimestamps: [],
      isSavingAnnotation: false,
      isSavingFilterPreset: false,
      saveSelectedNodeAnnotation: vi.fn(),
      saveCurrentFilterPreset: vi.fn(),
      applyFilterPreset: vi.fn(),
    });

    render(<KnowledgeGraphView />);

    expect(screen.getByRole("button", { name: /accepted \(2\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /rejected \(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /deferred \(1\)/i })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /rejected \(1\)/i }));
    expect(setDreamDecisionFilter).toHaveBeenCalledWith("rejected");
  });
});
