import { useEffect, useMemo, useState } from "react";
import { marked } from "marked";
import type { KnowledgeGraphEdge, KnowledgeGraphNode, KnowledgeGraphNodeType, KnowledgeNodeAnnotation } from "@atellier/shared";
import { useWikiPageApi } from "../../../api/hooks/wiki/useWikiApi";
import { useRunsApi } from "../../../api/hooks/runs/useRunsApi";
import { cn } from "../../../lib/cn";

marked.setOptions({ gfm: true, breaks: false });

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
  "dream-decision": "Dream decision",
};

type Tab = "lectura" | "curacion";

type Props = {
  node: KnowledgeGraphNode | null;
  edges: KnowledgeGraphEdge[];
  nodeLabelById: Map<string, string>;
  onSelectNode: (id: string) => void;
  annotation: KnowledgeNodeAnnotation | null;
  isSavingAnnotation: boolean;
  onSaveAnnotation: (note: string, tags: string[]) => Promise<void>;
};

export function KnowledgeInspector({
  node,
  edges,
  nodeLabelById,
  onSelectNode,
  annotation,
  isSavingAnnotation,
  onSaveAnnotation,
}: Props) {
  const [tab, setTab] = useState<Tab>("lectura");
  const [annotationNote, setAnnotationNote] = useState("");
  const [annotationTags, setAnnotationTags] = useState("");
  const hasPath = Boolean(node?.path);
  const isTextual = node?.path ? /\.(md|markdown|txt|json|jsonl|yaml|yml|csv)$/i.test(node.path) : false;
  const fetchablePath =
    isTextual && (node?.type === "wiki-page" || node?.type === "raw-source" || node?.type === "deliverable" || node?.type === "runtime-log")
      ? node?.path ?? null
      : null;
  const { data: page, isFetching: isFetchingPage } = useWikiPageApi(fetchablePath);

  const { data: runs } = useRunsApi();
  const runDetail = useMemo(() => {
    if (node?.type !== "run" || !node.sourceId) return null;
    return runs?.find((r) => r.id === node.sourceId) ?? null;
  }, [runs, node]);

  const dreamDecision = node?.type === "dream-decision" ? String(node.metadata?.decision ?? "") : null;
  const dreamProposal = node?.type === "dream-decision" ? String(node.metadata?.proposal ?? "") : null;
  const dreamReportPath = node?.type === "dream-decision" ? String(node.metadata?.reportPath ?? "") : null;

  useEffect(() => {
    setAnnotationNote(annotation?.note ?? "");
    setAnnotationTags((annotation?.tags ?? []).join(", "));
  }, [annotation?.note, annotation?.tags]);

  if (!node) {
    return (
      <aside className="border border-[var(--border-card)] bg-[var(--bg-card)] p-4">
        <p className="eyebrow">Inspector</p>
        <p className="mt-2 text-sm text-ink-faint">
          Selecciona un nodo en el grafo para inspeccionar su contenido y conexiones.
        </p>
      </aside>
    );
  }

  const neighbours = edges
    .map((edge) => {
      const otherId = edge.from === node.id ? edge.to : edge.from;
      return { edge, otherId, otherLabel: nodeLabelById.get(otherId) ?? otherId };
    })
    .slice(0, 12);

  return (
    <aside className="flex max-h-[calc(100vh-220px)] flex-col border border-[var(--border-card)] bg-[var(--bg-card)] p-4">
      <p className="eyebrow">Inspector</p>
      <h2 className="mt-1 text-lg font-extrabold leading-tight text-ink">{node.label}</h2>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded bg-white/5 px-2 py-0.5 text-ink-muted">{NODE_TYPE_LABELS[node.type]}</span>
        <span
          className={cn(
            "rounded px-2 py-0.5 font-bold uppercase",
            node.quality === "verified"
              ? "bg-teal/15 text-teal"
              : node.quality === "stale" || node.quality === "orphaned" || node.quality === "contradicted"
                ? "bg-gold/15 text-gold"
                : "bg-violet-500/15 text-violet-300",
          )}
        >
          {node.quality}
        </span>
        {node.status && <span className="rounded bg-white/5 px-2 py-0.5 text-ink-muted">{node.status}</span>}
      </div>

      <div className="mt-3 flex gap-1 border-b border-white/5">
        <button
          type="button"
          onClick={() => setTab("lectura")}
          className={cn(
            "px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
            tab === "lectura" ? "border-b-2 border-violet-400 text-ink" : "text-ink-faint hover:text-ink-muted",
          )}
        >
          Lectura
        </button>
        <button
          type="button"
          onClick={() => setTab("curacion")}
          className={cn(
            "px-3 py-1.5 text-xs font-bold uppercase tracking-wide",
            tab === "curacion" ? "border-b-2 border-violet-400 text-ink" : "text-ink-faint hover:text-ink-muted",
          )}
        >
          Curación · {edges.length}
        </button>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto pr-1">
        {tab === "lectura" && (
          <div className="space-y-3 text-xs">
            {hasPath && (
              <div>
                <p className="text-ink-faint">Path</p>
                <p className="mt-0.5 break-all text-ink-muted">{node.path}</p>
              </div>
            )}
            {node.updatedAt && (
              <div>
                <p className="text-ink-faint">Updated</p>
                <p className="mt-0.5 text-ink-muted">{new Date(node.updatedAt).toLocaleString()}</p>
              </div>
            )}
            {node.metadata && Object.keys(node.metadata).length > 0 && (
              <div>
                <p className="text-ink-faint">Metadata</p>
                <pre className="mt-1 max-h-32 overflow-auto bg-black/30 p-2 text-[0.68rem] leading-tight text-ink-muted">
                  {JSON.stringify(node.metadata, null, 2)}
                </pre>
              </div>
            )}
            {node.type === "dream-decision" && (
              <div className="rounded border border-white/10 bg-black/25 p-2">
                <p className="text-ink-faint">Dream decision</p>
                <p className="mt-1 text-ink-muted">
                  <span className="font-bold text-ink">Status:</span> {dreamDecision || "unknown"}
                </p>
                {dreamReportPath ? (
                  <div className="mt-1">
                    <span className="font-bold text-ink">Report:</span>{" "}
                    <button
                      type="button"
                      onClick={() => onSelectNode(`wiki-page:${dreamReportPath}`)}
                      className="break-all text-left text-teal hover:text-teal/80"
                    >
                      {dreamReportPath}
                    </button>
                  </div>
                ) : null}
                {dreamProposal ? (
                  <p className="mt-1 whitespace-pre-wrap text-ink-muted">
                    <span className="font-bold text-ink">Proposal:</span> {dreamProposal}
                  </p>
                ) : null}
              </div>
            )}
            {fetchablePath && (
              <div>
                <p className="text-ink-faint">Contenido fuente</p>
                {isFetchingPage && <p className="mt-1 text-ink-muted">Cargando…</p>}
                {page?.content && (
                  <RenderedMarkdown content={page.content} maxChars={4000} />
                )}
                {!isFetchingPage && !page?.content && (
                  <p className="mt-1 text-ink-faint">Sin contenido disponible.</p>
                )}
              </div>
            )}
            {node && (
              <div className="rounded border border-white/10 bg-black/25 p-2">
                <p className="text-ink-faint">Annotation</p>
                <textarea
                  aria-label="Node annotation note"
                  value={annotationNote}
                  onChange={(event) => setAnnotationNote(event.target.value)}
                  className="mt-1 min-h-16 w-full border border-[var(--border-card)] bg-[var(--bg-card)] p-2 text-[0.72rem] text-ink"
                />
                <input
                  aria-label="Node annotation tags"
                  value={annotationTags}
                  onChange={(event) => setAnnotationTags(event.target.value)}
                  placeholder="tags comma-separated"
                  className="mt-1 h-8 w-full border border-[var(--border-card)] bg-[var(--bg-card)] px-2 text-[0.72rem] text-ink"
                />
                <button
                  type="button"
                  disabled={!annotationNote.trim() || isSavingAnnotation}
                  onClick={() =>
                    void onSaveAnnotation(
                      annotationNote.trim(),
                      annotationTags
                        .split(",")
                        .map((tag) => tag.trim())
                        .filter((tag) => tag.length > 0),
                    )
                  }
                  className="mt-1 h-8 border border-[var(--border-card)] bg-[var(--bg-card)] px-2 text-[0.72rem] text-ink"
                >
                  {isSavingAnnotation ? "Saving…" : "Save annotation"}
                </button>
              </div>
            )}
            {runDetail && (
              <div>
                <p className="text-ink-faint">Timeline del run</p>
                <div className="mt-1 space-y-1.5 rounded bg-black/30 p-2">
                  <p className="text-[0.7rem] text-ink-muted">
                    {runDetail.type} · {runDetail.status}
                    {runDetail.reviewStatus ? ` · ${runDetail.reviewStatus}` : ""}
                  </p>
                  <ol className="space-y-1.5 border-l border-white/10 pl-2">
                    {runDetail.logs.length === 0 && (
                      <li className="text-[0.7rem] text-ink-faint">Sin entradas en el log todavía.</li>
                    )}
                    {runDetail.logs.slice(0, 20).map((entry, idx) => (
                      <li key={`${entry.timestamp}-${idx}`} className="text-[0.7rem] text-ink-muted">
                        <span className="font-bold text-ink-faint">
                          {new Date(entry.timestamp).toLocaleTimeString()}
                        </span>
                        <span className="ml-2 rounded bg-white/5 px-1 py-px text-[0.6rem] uppercase tracking-wider text-ink-faint">
                          {entry.level}
                        </span>
                        <p className="mt-0.5 whitespace-pre-wrap">{entry.message}</p>
                      </li>
                    ))}
                    {runDetail.logs.length > 20 && (
                      <li className="text-[0.62rem] text-ink-faint">+{runDetail.logs.length - 20} más</li>
                    )}
                  </ol>
                </div>
              </div>
            )}
          </div>
        )}

        {tab === "curacion" && (
          <div className="space-y-2 text-xs">
            <p className="text-ink-faint">Conexiones cercanas</p>
            {neighbours.length === 0 && (
              <p className="text-ink-faint">Este nodo todavía no tiene conexiones visibles.</p>
            )}
            {neighbours.map(({ edge, otherId, otherLabel }) => (
              <button
                key={edge.id}
                type="button"
                onClick={() => onSelectNode(otherId)}
                className="block w-full border border-white/5 bg-black/20 p-2 text-left hover:border-violet-400/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-ink">{edge.label}</span>
                  <span
                    className={cn(
                      "rounded px-1.5 py-0.5 text-[0.62rem] font-bold uppercase",
                      edge.quality === "verified" ? "bg-teal/15 text-teal" : "bg-gold/15 text-gold",
                    )}
                  >
                    {edge.quality}
                  </span>
                </div>
                <p className="mt-1 truncate text-ink-muted">{otherLabel}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RenderedMarkdown({ content, maxChars }: { content: string; maxChars: number }) {
  const html = useMemo(() => {
    const trimmed = content.length > maxChars ? `${content.slice(0, maxChars)}\n\n…` : content;
    return marked.parse(trimmed, { async: false }) as string;
  }, [content, maxChars]);

  return (
    <div
      className="prose-inspector mt-1 max-h-72 overflow-auto rounded bg-black/30 p-3 text-[0.72rem] leading-snug text-ink-muted"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
