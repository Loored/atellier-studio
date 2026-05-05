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
    <section className="panel panel-compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Outputs</p>
          <h2>Deliverables</h2>
        </div>
        <span className="panel-chip">{deliverableRuns.length} saved</span>
      </div>
      <div className="deliverable-filters">
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as typeof typeFilter)}>
          <option value="all">All types</option>
          {RUN_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
        <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
          <option value="all">All reviews</option>
          {RUN_REVIEW_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {isLoadingWithoutCache ? <p className="empty-state">Loading deliverables</p> : null}
      {!isLoadingWithoutCache && deliverableRuns.length === 0 ? (
        <p className="empty-state">No deliverables linked yet</p>
      ) : null}
      {!isLoadingWithoutCache && deliverableRuns.length > 0 && filteredDeliverableRuns.length === 0 ? (
        <p className="empty-state">No deliverables match current filters</p>
      ) : null}

      <ul className="item-list">
        {filteredDeliverableRuns.map((run) => (
          <li className="item-card run-item" key={run.id}>
            <div className="run-summary">
              <FileText size={18} />
              <div>
                <strong>{run.type}</strong>
                <span className="item-meta">
                  <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                  {run.reviewStatus ? (
                    <small className={`status-badge status-badge-review-${run.reviewStatus}`}>{run.reviewStatus}</small>
                  ) : null}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="deliverable-path-button"
              onClick={() => setSelectedDeliverablePath(run.deliverablePath ?? null)}
            >
              {run.deliverablePath}
            </button>
          </li>
        ))}
      </ul>

      {selectedDeliverablePath ? (
        <div className="deliverable-preview">
          <p className="eyebrow">Preview</p>
          <strong>{selectedDeliverablePath}</strong>
          {isLoadingDeliverable ? <p className="empty-state">Loading deliverable</p> : null}
          {!isLoadingDeliverable ? (
            <pre className="wiki-log">{selectedDeliverable?.content ?? "Deliverable not available."}</pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
