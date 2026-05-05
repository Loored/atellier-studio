import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { RUN_REVIEW_STATUSES, RUN_TYPES, type RunReviewStatus, type RunType } from "@atellier/shared";
import { useRunsApi } from "../../../api/hooks/runs/useRunsApi";
import { useWikiPageApi } from "../../../api/hooks/wiki/useWikiApi";

export function DeliverablesPanel() {
  const { data: runList = [], isLoadingWithoutCache } = useRunsApi();
  const deliverableRuns = useMemo(
    () => runList.filter((run) => Boolean(run.deliverablePath)),
    [runList],
  );
  const [selectedDeliverablePath, setSelectedDeliverablePath] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<"all" | RunType>("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | RunReviewStatus>("all");
  const { data: selectedDeliverable, isLoadingWithoutCache: isLoadingDeliverable } = useWikiPageApi(
    selectedDeliverablePath,
  );
  const filteredDeliverableRuns = useMemo(
    () =>
      deliverableRuns.filter((run) => {
        const typeMatches = typeFilter === "all" ? true : run.type === typeFilter;
        const reviewMatches = reviewFilter === "all" ? true : run.reviewStatus === reviewFilter;
        return typeMatches && reviewMatches;
      }),
    [deliverableRuns, typeFilter, reviewFilter],
  );

  return (
    <section className="col-span-6 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3.5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Outputs</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Deliverables</h2>
        </div>
        <span className="inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap">
          {deliverableRuns.length} saved
        </span>
      </div>

      {/* Filters */}
      <div className="inline-flex gap-2 mb-2.5">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          {RUN_TYPES.map((type) => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
        <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
          <option value="all">All reviews</option>
          {RUN_REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>{status}</option>
          ))}
        </select>
      </div>

      {isLoadingWithoutCache ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          Loading deliverables
        </p>
      ) : null}
      {!isLoadingWithoutCache && deliverableRuns.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No deliverables linked yet
        </p>
      ) : null}
      {!isLoadingWithoutCache && deliverableRuns.length > 0 && filteredDeliverableRuns.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No deliverables match current filters
        </p>
      ) : null}

      <ul className="grid gap-2 list-none m-0 p-0 max-h-[340px] overflow-auto">
        {filteredDeliverableRuns.map((run) => (
          <li
            key={run.id}
            className="grid border border-[var(--border-card)] rounded-lg px-3 py-2.5 bg-white/[0.02] transition-[border-color,background] hover:bg-[var(--bg-card-hover)] hover:border-purple/[0.22]"
          >
            <div className="grid grid-cols-[auto_1fr] items-center gap-2.5">
              <FileText size={18} className="text-ink-faint" />
              <div>
                <strong className="block text-[0.88rem] font-semibold text-ink mb-0.5">{run.type}</strong>
                <span className="flex items-center flex-wrap gap-1.5 text-ink-muted text-[0.78rem]">
                  <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                  {run.reviewStatus ? (
                    <small className={`status-badge status-badge-review-${run.reviewStatus}`}>
                      {run.reviewStatus}
                    </small>
                  ) : null}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="justify-start w-full text-left border-[var(--border-card)] bg-[var(--bg-input)] text-ink-muted px-2.5 overflow-hidden text-ellipsis whitespace-nowrap mt-2"
              onClick={() => setSelectedDeliverablePath(run.deliverablePath ?? null)}
            >
              {run.deliverablePath}
            </button>
          </li>
        ))}
      </ul>

      {selectedDeliverablePath ? (
        <div className="mt-3 grid gap-2">
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Preview</p>
          <strong className="text-ink text-[0.88rem]">{selectedDeliverablePath}</strong>
          {isLoadingDeliverable ? (
            <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
              Loading deliverable
            </p>
          ) : null}
          {!isLoadingDeliverable ? (
            <pre className="min-h-[120px] max-h-[240px] overflow-auto border border-[var(--border-card)] rounded-lg p-3 text-ink-muted bg-black/25 whitespace-pre-wrap text-[0.78rem] font-mono leading-relaxed m-0">
              {selectedDeliverable?.content ?? "Deliverable not available."}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
