import type { KnowledgeGraphNode, KnowledgeGraphNodeType } from "@atellier/shared";

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

const LAYER_DOT: Record<string, string> = {
  wiki: "#22c55e",
  raw: "#fb7185",
  runtime: "#0ea5e9",
  meta: "#8b5cf6",
};

type Props = {
  node: KnowledgeGraphNode;
  x: number;
  y: number;
};

export function NodeTooltip({ node, x, y }: Props) {
  return (
    <div
      className="pointer-events-none absolute z-20 max-w-[280px] rounded-md border border-white/10 bg-[rgba(8,11,24,0.95)] p-2.5 shadow-lg shadow-black/40"
      style={{ left: x + 12, top: y + 12 }}
    >
      <div className="flex items-center gap-2 text-xs font-bold text-ink">
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: LAYER_DOT[node.layer] ?? "#94a3b8" }}
        />
        <span className="truncate">{node.label}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1 text-[0.68rem] uppercase tracking-wide text-ink-faint">
        <span>{NODE_TYPE_LABELS[node.type] ?? node.type}</span>
        <span>·</span>
        <span>{node.layer}</span>
        <span>·</span>
        <span className={node.quality === "verified" ? "text-emerald-300" : "text-amber-300"}>
          {node.quality}
        </span>
      </div>
      {node.path && (
        <p className="mt-1.5 truncate text-[0.68rem] text-ink-muted">{node.path}</p>
      )}
      <p className="mt-1.5 text-[0.62rem] text-ink-faint">click para inspeccionar</p>
    </div>
  );
}
