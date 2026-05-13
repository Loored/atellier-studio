import { useEffect, useMemo, useRef, useState } from "react";
import type { KnowledgeGraphNodeType } from "@atellier/shared";
import {
  DENSITY_MODES,
  KNOWLEDGE_LAYERS,
  type KnowledgeLayer,
  useKnowledgeGraphPanel,
} from "./hooks/useKnowledgeGraphPanel";
import { ForceGraphCanvas } from "./components/ForceGraphCanvas";
import { KnowledgeInspector } from "./components/KnowledgeInspector";
import { LayerBreakdown } from "./components/LayerBreakdown";
import { LiveTimestamp } from "./components/LiveTimestamp";
import { NodeTooltip } from "./components/NodeTooltip";
import { SearchBar } from "./components/SearchBar";
import { TimelineSlider } from "./components/TimelineSlider";
import { cn } from "../../lib/cn";

const NODE_COLORS: Record<KnowledgeGraphNodeType, string> = {
  agent: "#14b8a6",
  role: "#8b5cf6",
  task: "#f59e0b",
  run: "#38bdf8",
  "wiki-page": "#22c55e",
  deliverable: "#f97316",
  "lint-issue": "#ef4444",
  "raw-source": "#fb7185",
  "runtime-log": "#0ea5e9",
};

const NODE_TYPE_LABELS: Record<KnowledgeGraphNodeType, string> = {
  agent: "Agent",
  role: "Role",
  task: "Task",
  run: "Run",
  "wiki-page": "Wiki page",
  deliverable: "Deliverable",
  "lint-issue": "Lint issue",
  "raw-source": "Raw source",
  "runtime-log": "Runtime log",
};

const LAYER_LABELS: Record<KnowledgeLayer, string> = {
  wiki: "WIKI",
  raw: "RAW",
  runtime: "RUNTIME",
  meta: "META",
};

const LAYER_DOT: Record<KnowledgeLayer, string> = {
  wiki: "#22c55e",
  raw: "#f97316",
  runtime: "#38bdf8",
  meta: "#8b5cf6",
};

type View = "dashboard" | "agents" | "runs" | "review" | "wiki" | "knowledge" | "office" | "settings";

type KnowledgeGraphViewProps = {
  onNavigate?: (view: View) => void;
};

export function KnowledgeGraphView({ onNavigate }: KnowledgeGraphViewProps = {}) {
  const {
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
    timelineCursor,
    setTimelineCursor,
    nodeTimestamps,
  } = useKnowledgeGraphPanel();

  const canvasRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 800, height: 520 });
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const hoveredNode = useMemo(
    () => (hoveredNodeId ? filteredNodes.find((n) => n.id === hoveredNodeId) ?? null : null),
    [filteredNodes, hoveredNodeId],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (document.activeElement instanceof HTMLInputElement) return;
        if (selectedNodeId) setSelectedNodeId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedNodeId, setSelectedNodeId]);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    function onMove(event: MouseEvent) {
      const rect = node!.getBoundingClientRect();
      setTooltipPos({ x: event.clientX - rect.left, y: event.clientY - rect.top });
    }
    function onLeave() {
      setTooltipPos(null);
      setHoveredNodeId(null);
    }
    node.addEventListener("mousemove", onMove);
    node.addEventListener("mouseleave", onLeave);
    return () => {
      node.removeEventListener("mousemove", onMove);
      node.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  useEffect(() => {
    const node = canvasRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize({ width: Math.max(320, width), height: Math.max(320, height) });
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const nodeLabelById = useMemo(
    () => new Map(filteredNodes.map((node) => [node.id, node.label])),
    [filteredNodes],
  );

  const needsCuration =
    (knowledgeGraph?.stats.byQuality.stale ?? 0) +
    (knowledgeGraph?.stats.byQuality.orphaned ?? 0) +
    (knowledgeGraph?.stats.byQuality.contradicted ?? 0);

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      <div className="mb-5 flex items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Memory</p>
          <div className="flex items-center gap-3">
            <h1 className="text-[2rem] font-extrabold leading-none text-ink">Knowledge Graph</h1>
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate("office")}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wider text-ink-muted hover:bg-white/10"
              >
                ← Volver a Oficina
              </button>
            )}
          </div>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Red viva del sistema, sus relaciones y los puntos donde hace falta curación.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <SearchBar
            query={searchQuery}
            onQueryChange={setSearchQuery}
            matches={searchMatches}
            onPick={(id) => setSelectedNodeId(id)}
          />
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "h-2 w-2 rounded-full transition-shadow",
                isFetchingKnowledgeGraph
                  ? "bg-violet-300 shadow-[0_0_10px_2px_rgba(196,181,253,0.55)]"
                  : "bg-emerald-400 shadow-[0_0_8px_1px_rgba(52,211,153,0.45)]",
              )}
            />
            <span className="font-bold uppercase tracking-wider text-ink-muted">
              {isFetchingKnowledgeGraph ? "Refrescando" : "Sesión viva"}
            </span>
          </div>
          <span className="text-ink-faint">
            Última actividad <LiveTimestamp timestamp={dataUpdatedAt} />
          </span>
          <button
            type="button"
            onClick={() => refetch()}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 font-bold uppercase tracking-wider text-ink-muted hover:bg-white/10"
          >
            Refrescar
          </button>
        </div>
      </div>

      {knowledgeGraphError && (
        <div className="mb-4 border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
          Knowledge graph could not be loaded.
        </div>
      )}

      <div className="mb-4 grid grid-cols-[repeat(4,minmax(0,1fr))_minmax(320px,1.4fr)] gap-3">
        <Stat label="Nodes" value={knowledgeGraph?.stats.nodes ?? 0} />
        <Stat label="Edges" value={knowledgeGraph?.stats.edges ?? 0} />
        <Stat label="Verified" value={knowledgeGraph?.stats.byQuality.verified ?? 0} tone="teal" />
        <Stat label="Needs curation" value={needsCuration} tone="gold" />
        <LayerBreakdown
          byLayer={knowledgeGraph?.stats.byLayer}
          total={knowledgeGraph?.stats.nodes ?? 0}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {KNOWLEDGE_LAYERS.map((layer) => {
          const active = activeLayers.has(layer);
          return (
            <button
              key={layer}
              type="button"
              onClick={() => toggleLayer(layer)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide transition",
                active
                  ? "border-white/20 bg-white/10 text-ink"
                  : "border-white/5 bg-transparent text-ink-faint hover:text-ink-muted",
              )}
            >
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LAYER_DOT[layer] }} />
              {LAYER_LABELS[layer]}
            </button>
          );
        })}

        <div className="ml-auto flex items-center gap-2">
          <TimelineSlider
            timestamps={nodeTimestamps}
            value={timelineCursor}
            onChange={setTimelineCursor}
          />
          <div className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 p-0.5">
            {DENSITY_MODES.map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setDensityMode(mode)}
                className={cn(
                  "rounded-full px-3 py-1 text-[0.68rem] font-bold uppercase tracking-wide",
                  densityMode === mode ? "bg-white/15 text-ink" : "text-ink-faint hover:text-ink-muted",
                )}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <select
          aria-label="Filter graph node type"
          value={nodeTypeFilter}
          onChange={(event) => setNodeTypeFilter(event.target.value as KnowledgeGraphNodeType | "all")}
          className="h-8 border border-[var(--border-card)] bg-[var(--bg-card)] px-2 text-xs text-ink"
        >
          <option value="all">All node types</option>
          {nodeTypes.map((type) => (
            <option key={type} value={type}>
              {NODE_TYPE_LABELS[type] ?? type}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter graph quality"
          value={qualityFilter}
          onChange={(event) => setQualityFilter(event.target.value as never)}
          className="h-8 border border-[var(--border-card)] bg-[var(--bg-card)] px-2 text-xs text-ink"
        >
          <option value="all">All quality states</option>
          {qualities.map((quality) => (
            <option key={quality} value={quality}>
              {quality}
            </option>
          ))}
        </select>
        {(Object.keys(NODE_COLORS) as KnowledgeGraphNodeType[]).map((type) => (
          <span
            key={type}
            className="inline-flex items-center gap-1.5 border border-[var(--border-card)] bg-[var(--bg-card)] px-2 py-1 text-[0.68rem] text-ink-muted"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: NODE_COLORS[type] }} />
            {NODE_TYPE_LABELS[type]}
          </span>
        ))}
        {isFetchingKnowledgeGraph && <span className="text-xs text-ink-faint">Refreshing…</span>}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_minmax(320px,360px)] gap-4">
        <section
          ref={canvasRef}
          className="relative h-[640px] overflow-hidden border border-[var(--border-card)] bg-[rgba(8,11,24,0.95)]"
        >
          <div className="pointer-events-none absolute left-3 top-3 z-10 flex items-center gap-2 text-[0.65rem] uppercase tracking-wider text-ink-faint">
            <span>drag · zoom · click · {filteredNodes.length} nodes / {filteredEdges.length} edges</span>
            {recentlyAddedNodeIds.size > 0 && (
              <span className="rounded-full bg-rose-500/20 px-2 py-0.5 font-bold text-rose-200">
                +{recentlyAddedNodeIds.size} nuevo{recentlyAddedNodeIds.size > 1 ? "s" : ""}
              </span>
            )}
            {searchQuery.trim().length > 0 && (
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 font-bold text-amber-200">
                {matchedNodeIds.size} match{matchedNodeIds.size !== 1 ? "es" : ""}
              </span>
            )}
          </div>
          <ForceGraphCanvas
            nodes={filteredNodes}
            edges={filteredEdges}
            density={densityMode}
            selectedNodeId={selectedNodeId}
            onSelectNode={setSelectedNodeId}
            onHoverNode={setHoveredNodeId}
            width={size.width}
            height={size.height}
            recentlyAddedNodeIds={recentlyAddedNodeIds}
            matchedNodeIds={matchedNodeIds}
          />
          {hoveredNode && tooltipPos && (
            <NodeTooltip node={hoveredNode} x={tooltipPos.x} y={tooltipPos.y} />
          )}
          {filteredNodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center text-sm text-ink-faint">
              No graph nodes match the current filters.
            </div>
          )}
        </section>

        <KnowledgeInspector
          node={selectedNode}
          edges={selectedNodeEdges}
          nodeLabelById={nodeLabelById}
          onSelectNode={setSelectedNodeId}
        />
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "teal" | "gold" }) {
  return (
    <div className="border border-[var(--border-card)] bg-[var(--bg-card)] p-3">
      <p className="text-xs text-ink-faint">{label}</p>
      <p
        className={cn(
          "mt-1 text-2xl font-extrabold",
          tone === "teal" ? "text-teal" : tone === "gold" ? "text-gold" : "text-ink",
        )}
      >
        {value}
      </p>
    </div>
  );
}
