import { Check, CircleSlash, FilePlus2, Play, ShieldCheck, TimerReset } from "lucide-react";
import { RUN_REVIEW_STATUSES } from "@atellier/shared";
import { RUN_LOG_MESSAGE_MAX_LENGTH } from "@atellier/shared";
import { useRunsTimeline } from "../hooks/useRunsTimeline";

export function RunsTimeline() {
  const {
    runList,
    filteredRunList,
    runLogMessages,
    agentFilter,
    reviewFilter,
    isCreatingRun,
    isAppendingRunLog,
    isCompletingRun,
    isUpdatingRunReview,
    isPromotingRunDeliverable,
    isUnlinkingRunDeliverable,
    isLoadingRunsWithoutCache,
    setAgentFilter,
    setReviewFilter,
    setRunLogMessage,
    handleAppendRunLog,
    startManualRun,
    completeRun,
    setRunReview,
    promoteRunDeliverable,
    unlinkRunDeliverable,
  } = useRunsTimeline();

  return (
    <section className="panel panel-compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Recent Runs</h2>
        </div>
        <div className="panel-actions">
          <span className="panel-chip">{runList.filter((run) => run.status === "running").length} running</span>
          <button className="icon-button" type="button" onClick={startManualRun} disabled={isCreatingRun} title="Start run">
            <Play size={18} />
            <span>Start</span>
          </button>
        </div>
        <div className="run-filters">
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as typeof agentFilter)}>
            <option value="all">All agents</option>
            <option value="needs-human">Needs human</option>
            <option value="blocked">Blocked</option>
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
      </div>

      {isLoadingRunsWithoutCache ? <p className="empty-state">Loading runs</p> : null}
      {!isLoadingRunsWithoutCache && runList.length === 0 ? <p className="empty-state">No runs yet</p> : null}
      {!isLoadingRunsWithoutCache && runList.length > 0 && filteredRunList.length === 0 ? (
        <p className="empty-state">No runs match current filters</p>
      ) : null}

      <ul className="item-list">
        {filteredRunList.map((run) => {
          const pendingLogMessage = runLogMessages[run.id]?.trim() ?? "";
          const latestLog = run.logs.at(-1);

          return (
            <li className="item-card run-item" data-status={run.status} key={run.id}>
              <div className="run-summary">
                <TimerReset size={18} />
                <div>
                  <strong>{run.type}</strong>
                  <span className="item-meta">
                    <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                    {run.reviewStatus ? (
                      <small className={`status-badge status-badge-review-${run.reviewStatus}`}>{run.reviewStatus}</small>
                    ) : null}
                    <span>{run.logs.length} logs</span>
                  </span>
                </div>
              </div>
              {latestLog ? (
                <p className="run-latest-log">
                  {latestLog.level}: {latestLog.message}
                </p>
              ) : null}
              {run.status !== "completed" ? (
                <div className="run-actions">
                  <form className="run-log-form" onSubmit={(event) => handleAppendRunLog(event, run.id)}>
                    <input
                      aria-label={`Run log message for ${run.type} run`}
                      maxLength={RUN_LOG_MESSAGE_MAX_LENGTH}
                      value={runLogMessages[run.id] ?? ""}
                      onChange={(event) => setRunLogMessage(run.id, event.target.value)}
                      placeholder="Run log"
                    />
                    <button
                      type="submit"
                      disabled={isAppendingRunLog || pendingLogMessage.length === 0}
                      title="Append log"
                      aria-label="Append log"
                    >
                      <FilePlus2 size={16} />
                      <span>Log</span>
                    </button>
                  </form>
                  <button
                    className="icon-only-button"
                    type="button"
                    onClick={() => completeRun(run.id)}
                    disabled={isCompletingRun}
                    title="Complete run"
                    aria-label={`Complete ${run.type} run`}
                  >
                    <Check size={16} />
                  </button>
                </div>
              ) : null}
              {run.status === "completed" ? (
                <div className="run-review-actions">
                  {!run.deliverablePath ? (
                    <button
                      type="button"
                      onClick={() => promoteRunDeliverable(run.id)}
                      disabled={isPromotingRunDeliverable}
                      title="Promote to deliverable"
                    >
                      <FilePlus2 size={16} />
                      <span>Promote</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => unlinkRunDeliverable(run.id)}
                      disabled={isUnlinkingRunDeliverable}
                      title="Unlink deliverable"
                    >
                      <CircleSlash size={16} />
                      <span>Unlink</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setRunReview(run.id, "approved")}
                    disabled={isUpdatingRunReview}
                    title="Approve run"
                  >
                    <ShieldCheck size={16} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRunReview(run.id, "changes-requested")}
                    disabled={isUpdatingRunReview}
                    title="Request changes"
                  >
                    <CircleSlash size={16} />
                    <span>Changes</span>
                  </button>
                  <button
                    className="icon-only-button"
                    type="button"
                    onClick={() => setRunReview(run.id, "pending")}
                    disabled={isUpdatingRunReview}
                    title="Set pending review"
                    aria-label="Set pending review"
                  >
                    <TimerReset size={16} />
                  </button>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
