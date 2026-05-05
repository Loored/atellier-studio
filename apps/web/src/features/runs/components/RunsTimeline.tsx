import { Check, CircleSlash, Clock, FilePlus2, Loader2, Play, RotateCcw, ShieldCheck, TimerReset } from "lucide-react";
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
    isOpenAiExecution,
    executorModel,
    modelProfile,
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
    <section className="col-span-6 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="mb-3.5">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Timeline</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Recent Runs</h2>
          </div>
          <div className="inline-flex items-center gap-2">
            <span className="inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap">
              {runList.filter((run) => run.status === "running").length} running
            </span>
            <button className="whitespace-nowrap" type="button" onClick={startManualRun} disabled={isCreatingRun} title="Start run">
              <Play size={18} />
              <span>Start</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={agentFilter} onChange={(event) => setAgentFilter(event.target.value as typeof agentFilter)}>
            <option value="all">All agents</option>
            <option value="needs-human">Needs human</option>
            <option value="blocked">Blocked</option>
          </select>
          <select value={reviewFilter} onChange={(event) => setReviewFilter(event.target.value as typeof reviewFilter)}>
            <option value="all">All reviews</option>
            {RUN_REVIEW_STATUSES.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
        </div>
        {isOpenAiExecution ? (
          <p className="mt-2 m-0 border border-orange/30 rounded-lg px-2.5 py-2 text-[0.74rem] text-orange bg-orange/10">
            OpenAI execution is active ({modelProfile} · {executorModel}). Starting manual runs may consume tokens.
          </p>
        ) : null}
      </div>

      {isLoadingRunsWithoutCache ? (
        <p className="m-0 flex items-center gap-2 border border-[var(--border-card)] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          <Loader2 size={14} className="spin text-purple flex-shrink-0" />
          Loading runs
        </p>
      ) : null}
      {!isLoadingRunsWithoutCache && runList.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No runs yet
        </p>
      ) : null}
      {!isLoadingRunsWithoutCache && runList.length > 0 && filteredRunList.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No runs match current filters
        </p>
      ) : null}

      <p className="mb-2 text-[0.75rem] text-ink-faint">
        Review queue: prioritize runs marked <span className="text-ink">pending review</span>, and resolve any
        <span className="text-orange"> blocked</span> or <span className="text-purple">needs-human</span> state quickly.
      </p>

      <ul className="grid gap-2 list-none m-0 p-0 max-h-[44vh] overflow-auto">
        {filteredRunList.map((run) => {
          const pendingLogMessage = runLogMessages[run.id]?.trim() ?? "";
          const latestLog = run.logs.at(-1);
          const isRunning = run.status === "running";

          return (
            <li
              key={run.id}
              className={`grid min-h-14 border rounded-lg px-3 py-2.5 transition-[border-color,background] ${
                isRunning
                  ? "border-teal/[0.22] bg-teal/[0.03]"
                  : "border-[var(--border-card)] bg-white/[0.02] hover:bg-[var(--bg-card-hover)] hover:border-purple/[0.22]"
              }`}
            >
              {/* Run summary */}
              <div className="grid grid-cols-[auto_1fr] items-center gap-2.5">
                <TimerReset size={18} className="text-ink-faint" />
                <div>
                  <strong className="block text-[0.88rem] font-semibold text-ink mb-0.5">{run.type}</strong>
                  <span className="flex items-center flex-wrap gap-1.5 text-ink-muted text-[0.78rem]">
                    <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                    {run.reviewStatus ? (
                      <small className={`status-badge status-badge-review-${run.reviewStatus}`}>
                        {run.reviewStatus}
                      </small>
                    ) : null}
                    <span>{run.logs.length} logs</span>
                  </span>
                </div>
              </div>

              {latestLog ? (
                <p className="mt-2 text-[0.72rem] text-ink-muted overflow-wrap-anywhere">
                  {latestLog.level}: {latestLog.message}
                </p>
              ) : null}

              {run.status !== "completed" ? (
                <div className="grid grid-cols-[1fr_auto] gap-2 mt-2.5">
                  <form
                    className="grid grid-cols-[1fr_auto] gap-1.5"
                    onSubmit={(event) => handleAppendRunLog(event, run.id)}
                  >
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
                <div className="mt-2.5 border border-[var(--border-card)] rounded-md px-2.5 py-2 bg-black/15">
                  <p className="m-0 mb-1 text-[0.7rem] uppercase tracking-[0.08em] text-ink-faint">Review actions</p>
                  <div className="inline-flex flex-wrap gap-1.5">
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
                    className="border-green-400/35 text-green-400 bg-green-400/10 hover:bg-green-400/20"
                    onClick={() => setRunReview(run.id, "approved")}
                    disabled={isUpdatingRunReview}
                    title="Approve run"
                  >
                    <ShieldCheck size={16} />
                    <span>Approve</span>
                  </button>
                  <button
                    type="button"
                    className="border-orange/35 text-orange bg-orange/10 hover:bg-orange/20"
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
                    title="Reset to pending review"
                    aria-label="Reset to pending review"
                  >
                    <RotateCcw size={16} />
                  </button>
                  </div>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
