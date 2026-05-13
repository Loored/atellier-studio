import { useEffect, useMemo, useRef } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphLayer,
  KnowledgeGraphNode,
  KnowledgeGraphNodeType,
} from "@atellier/shared";
import type { DensityMode } from "../hooks/useKnowledgeGraphPanel";

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

const LAYER_ANCHORS: Record<KnowledgeGraphLayer, { x: number; y: number }> = {
  wiki: { x: 0, y: 0 },
  raw: { x: -0.35, y: -0.25 },
  runtime: { x: 0.35, y: 0.25 },
  meta: { x: -0.3, y: 0.3 },
};

const DENSITY: Record<DensityMode, { linkDistance: number; charge: number; clusterStrength: number }> = {
  auto: { linkDistance: 55, charge: -180, clusterStrength: 0.12 },
  comfort: { linkDistance: 110, charge: -340, clusterStrength: 0.08 },
  sparse: { linkDistance: 200, charge: -700, clusterStrength: 0.05 },
};

type ForceNode = {
  id: string;
  label: string;
  type: KnowledgeGraphNodeType;
  layer: KnowledgeGraphLayer;
  quality: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
};

type ForceLink = {
  source: string;
  target: string;
  quality: string;
};

type Props = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  density: DensityMode;
  selectedNodeId: string | null;
  onSelectNode: (id: string | null) => void;
  onHoverNode?: (id: string | null) => void;
  width: number;
  height: number;
  recentlyAddedNodeIds?: Set<string>;
  matchedNodeIds?: Set<string>;
};

export function ForceGraphCanvas({
  nodes,
  edges,
  density,
  selectedNodeId,
  onSelectNode,
  onHoverNode,
  width,
  height,
  recentlyAddedNodeIds,
  matchedNodeIds,
}: Props) {
  const ref = useRef<ForceGraphMethods<ForceNode, ForceLink> | undefined>(undefined);
  const lastFocusedRef = useRef<string | null>(null);
  const dimsRef = useRef({ width, height });
  dimsRef.current = { width, height };
  const initialFitDoneRef = useRef(false);
  const previousNodeCountRef = useRef(0);

  const data = useMemo(
    () => ({
      nodes: nodes.map<ForceNode>((node) => ({
        id: node.id,
        label: node.label,
        type: node.type,
        layer: node.layer,
        quality: node.quality,
      })),
      links: edges.map<ForceLink>((edge) => ({
        source: edge.from,
        target: edge.to,
        quality: edge.quality,
      })),
    }),
    [nodes, edges],
  );

  useEffect(() => {
    const fg = ref.current;
    if (!fg) return;

    const preset = DENSITY[density];

    const chargeForce = fg.d3Force("charge") as { strength: (n: number) => unknown } | undefined;
    chargeForce?.strength(preset.charge);
    const linkForce = fg.d3Force("link") as { distance: (n: number) => unknown } | undefined;
    linkForce?.distance(preset.linkDistance);

    let simNodes: ForceNode[] = [];
    function clusterForce(alpha: number) {
      const { width: w, height: h } = dimsRef.current;
      for (const node of simNodes) {
        const anchor = LAYER_ANCHORS[node.layer] ?? LAYER_ANCHORS.meta;
        const tx = anchor.x * w * 0.45;
        const ty = anchor.y * h * 0.45;
        node.vx = (node.vx ?? 0) + (tx - (node.x ?? 0)) * alpha * preset.clusterStrength;
        node.vy = (node.vy ?? 0) + (ty - (node.y ?? 0)) * alpha * preset.clusterStrength;
      }
    }
    (clusterForce as unknown as { initialize: (input: ForceNode[]) => void }).initialize = (input) => {
      simNodes = input;
    };

    fg.d3Force("cluster", clusterForce as never);
    fg.d3ReheatSimulation();

    const nodeCount = data.nodes.length;
    const previousCount = previousNodeCountRef.current;
    previousNodeCountRef.current = nodeCount;
    const shouldFit =
      !initialFitDoneRef.current ||
      previousCount === 0 ||
      Math.abs(nodeCount - previousCount) / Math.max(previousCount, 1) > 0.5;

    if (!shouldFit) return;

    const id = window.setTimeout(() => {
      try {
        fg.zoomToFit(400, 80);
        initialFitDoneRef.current = true;
      } catch {
        /* positions not ready */
      }
    }, 1200);
    return () => window.clearTimeout(id);
  }, [density, data]);

  useEffect(() => {
    if (!recentlyAddedNodeIds || recentlyAddedNodeIds.size === 0) return;
    const fg = ref.current;
    if (!fg) return;
    const interval = window.setInterval(() => {
      const maybeRefresh = fg as unknown as { refresh?: () => void };
      maybeRefresh.refresh?.();
    }, 60);
    return () => window.clearInterval(interval);
  }, [recentlyAddedNodeIds]);

  useEffect(() => {
    if (!selectedNodeId) {
      lastFocusedRef.current = null;
      return;
    }
    if (lastFocusedRef.current === selectedNodeId) return;
    const fg = ref.current;
    if (!fg) return;
    const target = data.nodes.find((n) => n.id === selectedNodeId);
    if (!target || !Number.isFinite(target.x) || !Number.isFinite(target.y)) return;
    fg.centerAt(target.x as number, target.y as number, 700);
    fg.zoom(Math.max(fg.zoom(), 2), 700);
    lastFocusedRef.current = selectedNodeId;
  }, [selectedNodeId, data.nodes]);

  const neighbourIds = useMemo(() => {
    if (!selectedNodeId) return null;
    const set = new Set<string>([selectedNodeId]);
    for (const edge of edges) {
      if (edge.from === selectedNodeId) set.add(edge.to);
      if (edge.to === selectedNodeId) set.add(edge.from);
    }
    return set;
  }, [edges, selectedNodeId]);

  return (
    <ForceGraph2D
      ref={ref}
      graphData={data}
      width={width}
      height={height}
      backgroundColor="rgba(8,11,24,0.95)"
      cooldownTicks={200}
      d3VelocityDecay={0.32}
      linkCurvature={0.18}
      linkColor={(link) => {
        const source = typeof link.source === "object" ? (link.source as ForceNode).id : (link.source as string);
        const target = typeof link.target === "object" ? (link.target as ForceNode).id : (link.target as string);
        if (selectedNodeId && (source === selectedNodeId || target === selectedNodeId)) {
          return "rgba(167,139,250,0.95)";
        }
        if (selectedNodeId) return "rgba(148,163,184,0.05)";
        return link.quality === "verified" ? "rgba(148,163,184,0.32)" : "rgba(250,189,79,0.4)";
      }}
      linkWidth={(link) => {
        const source = typeof link.source === "object" ? (link.source as ForceNode).id : (link.source as string);
        const target = typeof link.target === "object" ? (link.target as ForceNode).id : (link.target as string);
        return selectedNodeId && (source === selectedNodeId || target === selectedNodeId) ? 1.8 : 0.6;
      }}
      linkDirectionalParticles={(link) => {
        const source = typeof link.source === "object" ? (link.source as ForceNode).id : (link.source as string);
        const target = typeof link.target === "object" ? (link.target as ForceNode).id : (link.target as string);
        return selectedNodeId && (source === selectedNodeId || target === selectedNodeId) ? 3 : 0;
      }}
      linkDirectionalParticleWidth={1.8}
      linkDirectionalParticleColor={() => "rgba(196,181,253,0.95)"}
      nodeRelSize={4}
      nodeLabel={(node) => `${node.label} · ${node.type} · ${node.quality}`}
      nodeCanvasObjectMode={() => "replace"}
      nodeCanvasObject={(node, ctx, scale) => {
        const n = node as ForceNode & { x?: number; y?: number };
        const nx = n.x;
        const ny = n.y;
        if (!Number.isFinite(nx) || !Number.isFinite(ny)) return;
        const isSelected = selectedNodeId === n.id;
        const isNeighbour = neighbourIds?.has(n.id) ?? !selectedNodeId;
        const hasSearch = matchedNodeIds && matchedNodeIds.size > 0;
        const isMatched = !hasSearch || matchedNodeIds.has(n.id);
        const isProminent = (isSelected || isNeighbour) && isMatched;
        const baseRadius = isSelected ? 7.5 : isMatched && hasSearch ? 5.5 : 4.5;
        const color = NODE_COLORS[n.type];

        if (isProminent) {
          const gradient = ctx.createRadialGradient(nx as number, ny as number, 0, nx as number, ny as number, baseRadius * 3);
          gradient.addColorStop(0, `${color}55`);
          gradient.addColorStop(1, `${color}00`);
          ctx.beginPath();
          ctx.arc(nx as number, ny as number, baseRadius * 3, 0, Math.PI * 2, false);
          ctx.fillStyle = gradient;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(nx as number, ny as number, baseRadius, 0, Math.PI * 2, false);
        ctx.fillStyle = isMatched && (isNeighbour || !selectedNodeId) ? color : `${color}28`;
        ctx.fill();

        if (hasSearch && isMatched && !isSelected) {
          ctx.beginPath();
          ctx.arc(nx as number, ny as number, baseRadius + 2.5, 0, Math.PI * 2, false);
          ctx.strokeStyle = "rgba(250,204,21,0.9)";
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }

        if (isSelected) {
          ctx.beginPath();
          ctx.arc(nx as number, ny as number, baseRadius + 4, 0, Math.PI * 2, false);
          ctx.strokeStyle = "rgba(196,181,253,0.95)";
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }

        if (recentlyAddedNodeIds?.has(n.id)) {
          const pulse = (Math.sin(Date.now() / 220) + 1) / 2;
          ctx.beginPath();
          ctx.arc(nx as number, ny as number, baseRadius + 5 + pulse * 5, 0, Math.PI * 2, false);
          ctx.strokeStyle = `rgba(244,114,182,${0.45 + pulse * 0.35})`;
          ctx.lineWidth = 1.4;
          ctx.stroke();
        }

        const labelVisible = isSelected || scale >= 1.7 || (selectedNodeId !== null && isNeighbour);
        if (labelVisible) {
          const fontSize = Math.max(9, 11 / Math.sqrt(scale));
          ctx.font = `${fontSize}px ui-sans-serif`;
          const text = n.label.length > 28 ? `${n.label.slice(0, 27)}…` : n.label;
          const textWidth = ctx.measureText(text).width;
          const padX = 4;
          const padY = 2;
          const boxX = (nx as number) + baseRadius + 4;
          const boxY = (ny as number) - fontSize / 2 - padY;
          ctx.fillStyle = "rgba(8,11,24,0.75)";
          ctx.fillRect(boxX - padX, boxY, textWidth + padX * 2, fontSize + padY * 2);
          ctx.fillStyle = isNeighbour ? "#f1f5f9" : "rgba(241,245,249,0.45)";
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, boxX, ny as number);
        }
      }}
      onNodeClick={(node) => onSelectNode((node as ForceNode).id)}
      onNodeHover={(node) => onHoverNode?.(node ? (node as ForceNode).id : null)}
      onBackgroundClick={() => onSelectNode(null)}
    />
  );
}
