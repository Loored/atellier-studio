import type { KnowledgeGraphLayer } from "@atellier/shared";
import { KNOWLEDGE_GRAPH_LAYERS } from "@atellier/shared";

const LAYER_LABELS: Record<KnowledgeGraphLayer, string> = {
  wiki: "Wiki",
  raw: "Raw",
  runtime: "Runtime",
  meta: "Meta",
};

const LAYER_COLORS: Record<KnowledgeGraphLayer, string> = {
  wiki: "#22c55e",
  raw: "#fb7185",
  runtime: "#0ea5e9",
  meta: "#8b5cf6",
};

type Props = {
  byLayer: Record<KnowledgeGraphLayer, number> | undefined;
  total: number;
};

export function LayerBreakdown({ byLayer, total }: Props) {
  const max = byLayer ? Math.max(...Object.values(byLayer), 1) : 1;
  return (
    <div className="border border-[var(--border-card)] bg-[var(--bg-card)] p-3">
      <p className="mb-2 text-xs text-ink-faint">Composición por capa</p>
      <div className="space-y-1.5">
        {KNOWLEDGE_GRAPH_LAYERS.map((layer) => {
          const count = byLayer?.[layer] ?? 0;
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          const width = max > 0 ? (count / max) * 100 : 0;
          return (
            <div key={layer} className="flex items-center gap-2 text-xs">
              <span className="w-16 text-ink-muted">{LAYER_LABELS[layer]}</span>
              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${width}%`, backgroundColor: LAYER_COLORS[layer] }}
                />
              </div>
              <span className="w-10 text-right font-bold tabular-nums text-ink">{count}</span>
              <span className="w-9 text-right text-ink-faint tabular-nums">{percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
