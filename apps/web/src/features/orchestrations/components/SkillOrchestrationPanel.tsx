import { Ban, Check, Loader2, Play, Route, RotateCcw, Workflow, X } from "lucide-react";
import type { ExecutorMode, OrchestrationSkillId, OrchestrationStepStatusEntry } from "@atellier/shared";
import { cn } from "../../../lib/cn";
import { useSkillOrchestrationPanel } from "../hooks/useSkillOrchestrationPanel";

function StepIndicator({ step, index }: { step: OrchestrationStepStatusEntry; index: number }) {
  if (step.status === "completed") {
    return (
      <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-green-400 bg-green-400/15">
        <Check size={11} strokeWidth={3} />
      </span>
    );
  }
  if (step.status === "running") {
    return (
      <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-teal bg-teal/[0.12]">
        <Loader2 size={11} className="spin" />
      </span>
    );
  }
  if (["failed", "blocked", "cancelled"].includes(step.status)) {
    return (
      <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-orange bg-orange/15">
        <X size={11} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-ink-faint bg-[rgba(74,80,106,0.2)]">
      {index + 1}
    </span>
  );
}

const STEP_CLASS: Record<OrchestrationStepStatusEntry["status"] | "pending", string> = {
  pending:   "border-[var(--border-card)] bg-white/[0.02]",
  queued:    "border-[var(--border-card)] bg-white/[0.02]",
  running:   "border-teal/30 bg-teal/[0.04] shadow-[0_0_12px_rgba(16,242,170,0.06)]",
  completed: "border-green-400/[0.22] bg-green-400/[0.03]",
  failed:    "border-orange/[0.28] bg-orange/[0.04]",
  blocked:   "border-orange/[0.28] bg-orange/[0.04]",
  cancelled: "border-[var(--border-card)] bg-white/[0.02] opacity-70",
};

export function SkillOrchestrationPanel() {
  const {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    selectedTaskId,
    availableTaskList,
    linkedTask,
    mode,
    liveStatus,
    runEvents,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    executorModeOverride,
    availableExecutorModes,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration,
    isCancellingRun,
    isRetryingRun,
    orchestrationErrorMessage,
    setSelectedSkillId,
    setGoal,
    setContext,
    setSelectedTaskId,
    setExecutorModeOverride,
    handleStartOrchestration,
    handleCancelRun,
    handleRetryRun,
    resetToForm,
  } = useSkillOrchestrationPanel();

  const orchStatus = liveStatus?.status;
  const isTerminal = orchStatus
    ? ["completed", "failed", "blocked", "cancelled"].includes(orchStatus)
    : false;
  const doneCount = liveStatus?.steps.filter((s) => s.status === "completed").length ?? 0;
  const totalCount = liveStatus?.steps.length ?? selectedSkill?.steps.length ?? 0;

  const statusBadgeClass = orchStatus === "completed"
    ? "status-badge status-badge-completed"
    : orchStatus && ["failed", "blocked", "cancelled"].includes(orchStatus)
      ? "status-badge status-badge-failed"
      : "status-badge status-badge-running";

  return (
    <section className="col-span-6 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3.5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Skill</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Orchestration</h2>
        </div>
        <div className="inline-flex items-center gap-2">
          {mode === "live" ? (
            <>
              {orchStatus && <span className={statusBadgeClass}>{orchStatus}</span>}
              {!isTerminal ? (
                <button
                  type="button"
                  className="icon-only-button"
                  onClick={handleCancelRun}
                  disabled={isCancellingRun || Boolean(liveStatus?.execution?.cancelRequestedAt)}
                  title="Cancelar al terminar el paso actual"
                >
                  {isCancellingRun ? <Loader2 size={14} className="spin" /> : <Ban size={14} />}
                </button>
              ) : (
                <>
                  {(orchStatus === "failed" || orchStatus === "blocked") && (
                    <button
                      type="button"
                      className="icon-only-button"
                      onClick={handleRetryRun}
                      disabled={isRetryingRun}
                      title="Reintentar conservando pasos completados"
                    >
                      {isRetryingRun ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                    </button>
                  )}
                  <button
                    type="button"
                    className="icon-only-button"
                    onClick={resetToForm}
                    title="Nueva orquestación"
                  >
                    <Play size={14} />
                  </button>
                </>
              )}
            </>
          ) : (
            <span className="inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap">
              {selectedSkill?.steps.length ?? 0} steps
            </span>
          )}
        </div>
      </div>

      {mode === "live" ? (
        <div>
          {/* Live meta bar */}
          <div className="flex items-baseline justify-between gap-2 mb-3 px-2.5 py-2 border border-[var(--border-card)] rounded-lg bg-purple/[0.04]">
            <div className="min-w-0 flex-1">
              <span className="block text-[0.78rem] text-ink-muted overflow-hidden text-ellipsis whitespace-nowrap italic">
                {liveStatus?.goal ?? "…"}
              </span>
              {linkedTask ? (
                <span className="block mt-0.5 text-[0.68rem] text-teal overflow-hidden text-ellipsis whitespace-nowrap">
                  Task: {linkedTask.title} · {linkedTask.status}
                </span>
              ) : null}
            </div>
            {!isTerminal && liveStatus && (
              <span className="text-[0.72rem] font-extrabold text-teal whitespace-nowrap tabular-nums">
                {doneCount}/{totalCount}
              </span>
            )}
          </div>

          {liveStatus?.execution && (
            <div className="flex items-center justify-between gap-2 mb-3 text-[0.68rem] text-ink-faint">
              <span>phase: {liveStatus.execution.phase}</span>
              <span className="tabular-nums">
                attempt {liveStatus.execution.attempt}/{liveStatus.execution.maxAttempts}
              </span>
            </div>
          )}

          {/* Step list */}
          <ol className="grid gap-2 list-none m-0 p-0 max-h-[280px] overflow-auto">
            {liveStatus
              ? liveStatus.steps.map((step, i) => (
                  <li
                    key={step.stepId}
                    className={cn(
                      "grid grid-cols-[auto_auto_1fr] items-center gap-2.5 min-h-12 border rounded-lg px-2.5 py-2.5 transition-[border-color,background-color,box-shadow]",
                      step.status === "running" ? "orchestration-step-active" : "",
                      STEP_CLASS[step.status]
                    )}
                  >
                    <StepIndicator step={step} index={i} />
                    <Route size={16} className="text-ink-faint" />
                    <div>
                      <strong className="block text-ink text-[0.82rem] overflow-wrap-anywhere">{step.label}</strong>
                      <span className="text-ink-muted text-[0.72rem] overflow-wrap-anywhere">
                        {step.agentName} · {step.phase}
                      </span>
                    </div>
                  </li>
                ))
              : selectedSkill?.steps.map((step, i) => (
                  <li
                    key={step.id}
                    className={cn("grid grid-cols-[auto_auto_1fr] items-center gap-2.5 min-h-12 border rounded-lg px-2.5 py-2.5", STEP_CLASS.pending)}
                  >
                    <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-ink-faint bg-[rgba(74,80,106,0.2)]">
                      {i + 1}
                    </span>
                    <Route size={16} className="text-ink-faint" />
                    <div>
                      <strong className="block text-ink text-[0.82rem] overflow-wrap-anywhere">{step.label}</strong>
                      <span className="text-ink-muted text-[0.72rem] overflow-wrap-anywhere">
                        {step.agentName} · {step.phase}
                      </span>
                    </div>
                  </li>
                ))}
          </ol>

          {runEvents.length > 0 && (
            <div className="mt-3 border-t border-[var(--border-card)] pt-2.5">
              <p className="m-0 mb-1.5 text-[0.65rem] font-bold tracking-[0.1em] uppercase text-ink-faint">
                Durable activity
              </p>
              <ol className="grid gap-1 list-none m-0 p-0 max-h-28 overflow-auto">
                {runEvents.slice(-6).reverse().map((event) => (
                  <li key={event.id} className="grid grid-cols-[auto_1fr] gap-2 text-[0.7rem] leading-[1.35]">
                    <span className="text-purple tabular-nums">#{event.sequence}</span>
                    <span className="text-ink-muted overflow-wrap-anywhere">
                      {event.message ?? event.type}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="grid gap-2 mb-3.5">
            {isOpenAiExecution ? (
              <p className="m-0 border border-orange/30 rounded-lg px-2.5 py-2 text-[0.74rem] text-orange bg-orange/10">
                OpenAI execution is active ({modelProfile} · {executorModel}). Starting this orchestration may consume tokens.
              </p>
            ) : null}
            <select
              aria-label="Orchestration skill"
              value={selectedSkillId}
              onChange={(e) => setSelectedSkillId(e.target.value as OrchestrationSkillId)}
              disabled={isStartingOrchestration || orchestrationSkillList.length === 0}
            >
              {orchestrationSkillList.map((skill) => (
                <option key={skill.id} value={skill.id}>{skill.name}</option>
              ))}
            </select>
            <textarea
              aria-label="Orchestration goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Goal"
              rows={3}
              disabled={isStartingOrchestration}
              className="w-full border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-ink bg-[var(--bg-input)] font-[inherit] text-[0.82rem] leading-[1.45] resize-y outline-none focus:border-purple placeholder:text-ink-faint"
            />
            <textarea
              aria-label="Orchestration context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Context (optional)"
              rows={2}
              disabled={isStartingOrchestration}
              className="w-full border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-ink bg-[var(--bg-input)] font-[inherit] text-[0.82rem] leading-[1.45] resize-y outline-none focus:border-purple placeholder:text-ink-faint"
            />
            <select
              aria-label="Linked task"
              value={selectedTaskId}
              onChange={(e) => setSelectedTaskId(e.target.value)}
              disabled={isStartingOrchestration}
            >
              <option value="">No linked task</option>
              {availableTaskList.map((task) => (
                <option key={task.id} value={task.id}>{task.title} · {task.status}</option>
              ))}
            </select>
            <select
              aria-label="Orchestration executor override"
              value={executorModeOverride}
              onChange={(e) => setExecutorModeOverride((e.target.value as ExecutorMode | "") ?? "")}
              disabled={isStartingOrchestration}
            >
              <option value="">Executor por entorno (default)</option>
              {availableExecutorModes.map((mode) => (
                <option key={mode} value={mode}>{mode}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleStartOrchestration}
              disabled={!goal.trim() || !selectedSkill || isStartingOrchestration}
            >
              {isStartingOrchestration ? <Workflow size={16} /> : <Play size={16} />}
              {isStartingOrchestration ? "Dispatching…" : "Start"}
            </button>
          </div>

          {orchestrationErrorMessage && (
            <p className="m-0 mb-2.5 text-[#fca5a5] text-[0.78rem] overflow-wrap-anywhere">
              {orchestrationErrorMessage}
            </p>
          )}

          {isLoadingOrchestrationSkillsWithoutCache && (
            <p className="m-0 flex items-center gap-2 border border-[var(--border-card)] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
              <Loader2 size={14} className="spin text-purple flex-shrink-0" />
              Loading skills…
            </p>
          )}

          {/* Preview steps */}
          {selectedSkill && (
            <ol className="grid gap-2 list-none m-0 p-0 max-h-[280px] overflow-auto">
              {selectedSkill.steps.map((step, i) => (
                <li
                  key={step.id}
                  className={cn("grid grid-cols-[auto_auto_1fr] items-center gap-2.5 min-h-12 border rounded-lg px-2.5 py-2.5", STEP_CLASS.pending)}
                >
                  <span className="inline-flex items-center justify-center w-[22px] min-w-[22px] h-[22px] rounded-full text-[0.68rem] font-extrabold text-ink-faint bg-[rgba(74,80,106,0.2)]">
                    {i + 1}
                  </span>
                  <Route size={16} className="text-ink-faint" />
                  <div>
                    <strong className="block text-ink text-[0.82rem] overflow-wrap-anywhere">{step.label}</strong>
                    <span className="text-ink-muted text-[0.72rem] overflow-wrap-anywhere">
                      {step.agentName} · {step.agentRole} · {step.phase}
                    </span>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </>
      )}
    </section>
  );
}
