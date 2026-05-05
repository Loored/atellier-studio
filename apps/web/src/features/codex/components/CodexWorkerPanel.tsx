import { useCodexWorkerPanel } from "../hooks/useCodexWorkerPanel";

export function CodexWorkerPanel() {
  const {
    goal,
    setGoal,
    mode,
    setMode,
    profile,
    setProfile,
    runId,
    runStatus,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    runLogPath,
    finalizedAt,
    runLogContent,
    actionError,
    steps,
    canPlan,
    canExecuteNext,
    canCancel,
    canFinalize,
    planBlockedReason,
    executeBlockedReason,
    cancelBlockedReason,
    finalizeBlockedReason,
    createRun,
    plan,
    approve,
    executeNext,
    cancel,
    finalize,
    openRunLog,
  } =
    useCodexWorkerPanel();
  const finalizedAtLabel = finalizedAt
    ? (() => {
        const parsed = new Date(finalizedAt);
        return Number.isNaN(parsed.getTime()) ? finalizedAt : parsed.toLocaleString();
      })()
    : null;
  async function copyRunLogPath() {
    if (!runLogPath) return;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(runLogPath);
      return;
    }
    const temp = document.createElement("textarea");
    temp.value = runLogPath;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.focus();
    temp.select();
    document.execCommand("copy");
    document.body.removeChild(temp);
  }

  return (
    <section className="col-span-12 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Developer</p>
          <h3 className="m-0 text-[1.1rem] font-bold text-ink tracking-tight">Codex Worker</h3>
        </div>
        {runId ? <span className="text-xs text-ink-muted">Run: {runId}</span> : null}
      </div>
      {runStatus ? (
        <p className="mt-0 mb-3 text-xs text-ink-muted">
          Status: <span className="text-ink">{runStatus}</span>
          {finalizedAtLabel ? <span> · Finalized at: <span className="text-ink">{finalizedAtLabel}</span></span> : null}
        </p>
      ) : null}
      {isOpenAiExecution ? (
        <p className="mt-0 mb-3 border border-orange/35 rounded-lg px-2.5 py-2 text-[0.78rem] text-orange bg-orange/10">
          OpenAI execution is active ({modelProfile} · {executorModel}). Create and execution actions may consume tokens.
        </p>
      ) : null}
      <div className="grid grid-cols-12 gap-2.5 mb-3">
        <input aria-label="Codex goal" className="col-span-6 input-base" value={goal} onChange={(e) => setGoal(e.target.value)} />
        <select aria-label="Codex mode" className="col-span-3 input-base" value={mode} onChange={(e) => setMode(e.target.value as any)}>
          <option value="dry_run">dry_run</option>
          <option value="approved_step">approved_step</option>
          <option value="monitored_run">monitored_run</option>
        </select>
        <select aria-label="Codex profile" className="col-span-3 input-base" value={profile} onChange={(e) => setProfile(e.target.value as any)}>
          <option value="cheap">cheap</option>
          <option value="standard">standard</option>
          <option value="deep">deep</option>
        </select>
      </div>
      {actionError ? (
        <p className="mt-0 mb-3 border border-orange/35 rounded-lg px-2.5 py-2 text-[0.78rem] text-orange bg-orange/10">
          {actionError}
        </p>
      ) : null}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <button type="button" onClick={() => void createRun()}>Create run</button>
        <button type="button" onClick={() => void plan()} disabled={!canPlan} title={planBlockedReason ?? "Build execution plan"}>
          Plan
        </button>
        <button type="button" onClick={() => void executeNext()} disabled={!canExecuteNext} title={executeBlockedReason ?? "Execute next available step"}>
          Execute next
        </button>
        <button
          type="button"
          className="border-orange/35 text-orange bg-orange/10 hover:bg-orange/20"
          onClick={() => void cancel()}
          disabled={!canCancel}
          title={cancelBlockedReason ?? "Cancel current run"}
        >
          Cancel
        </button>
        <button type="button" onClick={() => void finalize()} disabled={!canFinalize} title={finalizeBlockedReason ?? "Finalize run and persist evidence"}>
          Finalize
        </button>
      </div>
      {!canExecuteNext && executeBlockedReason ? (
        <p className="mt-0 mb-3 text-xs text-ink-faint">Execute next blocked: <span className="text-ink">{executeBlockedReason}</span></p>
      ) : null}
      {!canFinalize && finalizeBlockedReason ? (
        <p className="mt-0 mb-3 text-xs text-ink-faint">Finalize blocked: <span className="text-ink">{finalizeBlockedReason}</span></p>
      ) : null}
      {!canCancel && cancelBlockedReason ? (
        <p className="mt-0 mb-3 text-xs text-ink-faint">Cancel blocked: <span className="text-ink">{cancelBlockedReason}</span></p>
      ) : null}
      {!canPlan && planBlockedReason ? (
        <p className="mt-0 mb-3 text-xs text-ink-faint">Plan blocked: <span className="text-ink">{planBlockedReason}</span></p>
      ) : null}
      <div className="mt-2 mb-3 border border-[var(--border-card)] rounded-md p-2 text-xs text-ink-muted">
        Approval queue: {steps.filter((step) => step.needsApproval && step.status === "pending").length} protected step(s) waiting.
      </div>
      <ul className="m-0 p-0 list-none space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="border border-[var(--border-card)] rounded-md px-3 py-2 text-sm text-ink">
            <div className="flex items-center justify-between gap-2">
              <span>{step.summary} <small className="text-ink-muted">({step.status})</small></span>
              {step.needsApproval && step.status === "pending" ? (
                <button type="button" className="icon-only-button" onClick={() => void approve(step.id)} title="Approve protected step">
                  Approve step
                </button>
              ) : null}
            </div>
            <div className="mt-1 text-xs text-ink-faint">
              <span className="uppercase tracking-[0.08em]">risk</span>: {step.riskLevel}
              <span className="mx-1.5">·</span>
              <span className="uppercase tracking-[0.08em]">command</span>: <span className="text-ink">{step.command}</span>
            </div>
            {step.startedAt || step.finishedAt || step.exitCode !== undefined ? (
              <div className="mt-1 text-xs text-ink-faint">
                <span className="uppercase tracking-[0.08em]">execution</span>: {step.startedAt ? "started" : "not started"}
                {step.finishedAt ? " · finished" : ""}
                {step.exitCode !== undefined ? ` · exit ${step.exitCode}` : ""}
              </div>
            ) : null}
            {step.output ? (
              <pre aria-label={`Step output ${step.id}`} className="mt-2 mb-0 text-xs whitespace-pre-wrap border border-[var(--border-card)] rounded-md p-2 bg-black/20 text-ink">
                {step.output}
              </pre>
            ) : null}
            {step.stdoutPath || step.stderrPath ? (
              <div className="mt-1 text-xs text-ink-faint">
                {step.stdoutPath ? <p className="m-0">stdout: <span className="text-ink">{step.stdoutPath}</span></p> : null}
                {step.stderrPath ? <p className="m-0">stderr: <span className="text-ink">{step.stderrPath}</span></p> : null}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      {runLogPath ? (
        <div className="mt-3">
          <p className="mb-2 text-xs text-ink-muted">
            Final run log: <span className="text-ink">{runLogPath}</span>
          </p>
          <button type="button" className="icon-only-button" onClick={() => void openRunLog()}>
            Open run log
          </button>
          <button type="button" className="icon-only-button ml-2" onClick={() => void copyRunLogPath()}>
            Copy run log path
          </button>
          {runLogContent ? (
            <pre className="mt-2 mb-0 text-xs whitespace-pre-wrap border border-[var(--border-card)] rounded-md p-2 bg-black/20 text-ink">
              {runLogContent}
            </pre>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
