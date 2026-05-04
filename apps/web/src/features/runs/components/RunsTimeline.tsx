import { Check, FilePlus2, Play, TimerReset } from "lucide-react";
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
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Timeline</p>
          <h2>Recent Runs</h2>
        </div>
        <button className="icon-button" type="button" onClick={startManualRun} disabled={isCreatingRun} title="Start run">
          <Play size={18} />
          <span>Start</span>
        </button>
      </div>

      {isLoadingRunsWithoutCache ? <p className="empty-state">Loading runs</p> : null}
      {!isLoadingRunsWithoutCache && runList.length === 0 ? <p className="empty-state">No runs yet</p> : null}

      <ul className="item-list">
        {runList.map((run) => (
          <li className="item-card run-item" key={run.id}>
            <div className="run-summary">
              <TimerReset size={18} />
              <div>
                <strong>{run.type}</strong>
                <span>
                  {run.status} - {run.logs.length} logs
                </span>
              </div>
            </div>
            {run.status !== "completed" ? (
              <div className="run-actions">
                <form className="run-log-form" onSubmit={(event) => handleAppendRunLog(event, run.id)}>
                  <input
                    aria-label={`Run log message for ${run.type} run`}
                    value={runLogMessages[run.id] ?? ""}
                    onChange={(event) => setRunLogMessage(run.id, event.target.value)}
                    placeholder="Run log"
                  />
                  <button type="submit" disabled={isAppendingRunLog} title="Append log" aria-label="Append log">
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
        ))}
      </ul>
    </section>
  );
}
