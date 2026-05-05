import { useState } from "react";
import {
  Check,
  CircleSlash,
  FilePlus2,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import { RUN_REVIEW_STATUSES } from "@atellier/shared";
import { useRunsTimeline } from "../runs/hooks/useRunsTimeline";
import { WikiPanel } from "../wiki/components/WikiPanel";

type TabFilter = "all" | "pending" | "approved" | "changes-requested" | "unlinked";

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all",               label: "All" },
  { id: "pending",           label: "Pending" },
  { id: "approved",          label: "Approved" },
  { id: "changes-requested", label: "Needs changes" },
  { id: "unlinked",          label: "Unlinked" },
];

export function ReviewView() {
  const {
    runList,
    filteredRunList,
    runLogMessages,
    agentFilter,
    reviewFilter,
    isCreatingRun,
    isLoadingRunsWithoutCache,
    isUpdatingRunReview,
    isPromotingRunDeliverable,
    isUnlinkingRunDeliverable,
    isAppendingRunLog,
    isCompletingRun,
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

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const pendingCount   = runList.filter((r) => r.reviewStatus === "pending").length;
  const approvedCount  = runList.filter((r) => r.reviewStatus === "approved").length;
  const changesCount   = runList.filter((r) => r.reviewStatus === "changes-requested").length;
  const unlinkedCount  = runList.filter((r) => !r.reviewStatus).length;

  const tabCounts: Record<TabFilter, number> = {
    all:               runList.length,
    pending:           pendingCount,
    approved:          approvedCount,
    "changes-requested": changesCount,
    unlinked:          unlinkedCount,
  };

  const displayList = filteredRunList.filter((run) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "unlinked" ? !run.reviewStatus : run.reviewStatus === activeTab);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      run.type.toLowerCase().includes(q) ||
      run.id.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">
              Review
            </h1>
            <p className="text-[0.78rem] text-ink-muted mt-1">
              Review agent runs and approve, request changes or unlink results.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 h-7 border border-gold/30 rounded-lg px-3 text-[0.75rem] text-gold bg-gold/10 font-semibold">
                {pendingCount} pending
              </span>
            )}
            <button
              type="button"
              onClick={startManualRun}
              disabled={isCreatingRun}
              className="btn-primary"
            >
              <Play size={14} />
              Start run
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="search"
              placeholder="Search by title or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 h-8 w-52 text-[0.8rem]"
              aria-label="Search runs"
            />
          </div>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as typeof agentFilter)}
            className="h-8 text-[0.8rem]"
            aria-label="Filter by agent status"
          >
            <option value="all">All agents</option>
            <option value="needs-human">Needs human</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
            className="h-8 text-[0.8rem]"
            aria-label="Filter by review status"
          >
            <option value="all">All reviews</option>
            {RUN_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <span className="text-[0.72rem] text-ink-faint ml-auto tabular-nums">
            {displayList.length} / {runList.length}
          </span>
        </div>

        {/* Tabs */}
        <div className="review-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`review-tab ${activeTab === id ? "review-tab--active" : ""}`}
            >
              {label}
              <span className="review-tab-count">{tabCounts[id]}</span>
            </button>
          ))}
        </div>

        {/* States */}
        {isLoadingRunsWithoutCache && (
          <p className="flex items-center gap-2 border border-[var(--border-card)] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            <Loader2 size={14} className="spin text-purple flex-shrink-0" />
            Loading runs
          </p>
        )}
        {!isLoadingRunsWithoutCache && runList.length === 0 && (
          <p className="border border-dashed border-purple/[0.18] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            No runs yet. Start a manual run to begin.
          </p>
        )}
        {!isLoadingRunsWithoutCache && runList.length > 0 && displayList.length === 0 && (
          <p className="border border-dashed border-purple/[0.18] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            No runs match current filters.
          </p>
        )}

        {/* Run rows */}
        <div className="grid gap-2">
          {displayList.map((run) => {
            const pendingLog = runLogMessages[run.id]?.trim() ?? "";
            const latestLog  = run.logs.at(-1);
            const isRunning  = run.status === "running";

            return (
              <div
                key={run.id}
                className={`border rounded-xl px-4 py-3 transition-all duration-150 ${
                  isRunning
                    ? "border-teal/[0.22] bg-teal/[0.03]"
                    : "border-[var(--border-card)] bg-[var(--bg-card)] hover:border-purple/22"
                }`}
              >
                {/* Summary row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <TimerReset size={15} className="text-ink-faint flex-shrink-0" />
                  <span className="font-semibold text-[0.88rem] text-ink">{run.type}</span>
                  <span className="text-ink-faint text-[0.68rem] font-mono">{run.id.slice(0, 14)}…</span>

                  <div className="flex items-center gap-1.5">
                    <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                    {run.reviewStatus && (
                      <small className={`status-badge status-badge-review-${run.reviewStatus}`}>
                        {run.reviewStatus}
                      </small>
                    )}
                  </div>

                  <span className="text-ink-faint text-[0.7rem] ml-auto tabular-nums">
                    {run.logs.length} logs
                  </span>
                </div>

                {latestLog && (
                  <p className="mt-1.5 text-[0.72rem] text-ink-muted ml-6 overflow-wrap-anywhere">
                    {latestLog.level}: {latestLog.message}
                  </p>
                )}

                {/* Running: append log + complete */}
                {run.status !== "completed" && (
                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-2.5 ml-6">
                    <form
                      className="grid grid-cols-[1fr_auto] gap-1.5"
                      onSubmit={(e) => handleAppendRunLog(e, run.id)}
                    >
                      <input
                        aria-label={`Log message for ${run.type}`}
                        value={runLogMessages[run.id] ?? ""}
                        onChange={(e) => setRunLogMessage(run.id, e.target.value)}
                        placeholder="Append log message…"
                        className="h-8 text-[0.8rem]"
                      />
                      <button
                        type="submit"
                        disabled={isAppendingRunLog || pendingLog.length === 0}
                        className="btn-ghost h-8 px-3 text-[0.78rem]"
                      >
                        <FilePlus2 size={13} />
                        Log
                      </button>
                    </form>
                    <button
                      type="button"
                      className="icon-only-button"
                      onClick={() => completeRun(run.id)}
                      disabled={isCompletingRun}
                      title="Complete run"
                      aria-label="Complete run"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                )}

                {/* Completed: review actions inline */}
                {run.status === "completed" && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-6">
                    {!run.deliverablePath ? (
                      <button
                        type="button"
                        className="btn-ghost h-7 px-2.5 text-[0.75rem]"
                        onClick={() => promoteRunDeliverable(run.id)}
                        disabled={isPromotingRunDeliverable}
                      >
                        <FilePlus2 size={13} />
                        Promote
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost h-7 px-2.5 text-[0.75rem]"
                        onClick={() => unlinkRunDeliverable(run.id)}
                        disabled={isUnlinkingRunDeliverable}
                      >
                        <CircleSlash size={13} />
                        Unlink
                      </button>
                    )}

                    <button
                      type="button"
                      className="h-7 px-2.5 text-[0.75rem] border-green-400/35 text-green-400 bg-green-400/10 hover:bg-green-400/20"
                      onClick={() => setRunReview(run.id, "approved")}
                      disabled={isUpdatingRunReview}
                    >
                      <ShieldCheck size={13} />
                      Approve
                    </button>

                    <button
                      type="button"
                      className="h-7 px-2.5 text-[0.75rem] border-orange/35 text-orange bg-orange/10 hover:bg-orange/20"
                      onClick={() => setRunReview(run.id, "changes-requested")}
                      disabled={isUpdatingRunReview}
                    >
                      <CircleSlash size={13} />
                      Request changes
                    </button>

                    <button
                      type="button"
                      className="icon-only-button w-7 min-w-[28px] h-7"
                      onClick={() => setRunReview(run.id, "pending")}
                      disabled={isUpdatingRunReview}
                      title="Reset to pending"
                      aria-label="Reset to pending review"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Wiki tools */}
      <aside className="w-[300px] flex-shrink-0 border-l border-[var(--border-subtle)] overflow-y-auto bg-[var(--bg-sidebar)]">
        <div className="p-4">
          <p className="eyebrow mb-3">Tools</p>
          <WikiPanel />
        </div>
      </aside>
    </div>
  );
}
