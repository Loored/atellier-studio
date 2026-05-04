import { Check, FilePlus2, Play, TimerReset } from "lucide-react";
import { RUN_LOG_MESSAGE_MAX_LENGTH } from "@atellier/shared";
import { useRunsTimeline } from "../hooks/useRunsTimeline";

export function RunsTimeline() {
  const {
    runList,
    runLogMessages,
    isCreatingRun,
    isAppendingRunLog,
    isCompletingRun,
    isLoadingRunsWithoutCache,
    setRunLogMessage,
    handleAppendRunLog,
    startManualRun,
    completeRun,
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
      </div>

      {isLoadingRunsWithoutCache ? <p className="empty-state">Loading runs</p> : null}
      {!isLoadingRunsWithoutCache && runList.length === 0 ? <p className="empty-state">No runs yet</p> : null}

      <ul className="item-list">
        {runList.map((run) => {
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
            </li>
          );
        })}
      </ul>
    </section>
  );
}
