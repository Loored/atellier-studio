import { Check, Loader2, Play, Route, RotateCcw, Workflow, X } from "lucide-react";
import type { OrchestrationSkillId, OrchestrationStepStatusEntry } from "@atellier/shared";
import { useSkillOrchestrationPanel } from "../hooks/useSkillOrchestrationPanel";

function StepIndicator({ step, index }: { step: OrchestrationStepStatusEntry; index: number }) {
  if (step.status === "completed") {
    return (
      <span className="orchestration-step-index orchestration-step-index--done">
        <Check size={11} strokeWidth={3} />
      </span>
    );
  }
  if (step.status === "running") {
    return (
      <span className="orchestration-step-index orchestration-step-index--running">
        <Loader2 size={11} className="spin" />
      </span>
    );
  }
  if (step.status === "failed") {
    return (
      <span className="orchestration-step-index orchestration-step-index--failed">
        <X size={11} strokeWidth={3} />
      </span>
    );
  }
  return (
    <span className="orchestration-step-index orchestration-step-index--pending">
      {index + 1}
    </span>
  );
}

export function SkillOrchestrationPanel() {
  const {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    mode,
    liveStatus,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration,
    orchestrationErrorMessage,
    setSelectedSkillId,
    setGoal,
    setContext,
    handleStartOrchestration,
    resetToForm,
  } = useSkillOrchestrationPanel();

  const orchStatus = liveStatus?.status;
  const isTerminal = orchStatus === "completed" || orchStatus === "failed";
  const doneCount = liveStatus?.steps.filter((s) => s.status === "completed").length ?? 0;
  const totalCount = liveStatus?.steps.length ?? selectedSkill?.steps.length ?? 0;

  return (
    <section className="panel panel-compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Skill</p>
          <h2>Orchestration</h2>
        </div>
        <div className="panel-actions">
          {mode === "live" ? (
            <>
              {orchStatus && (
                <span className={`status-badge status-badge-${orchStatus === "completed" ? "completed" : orchStatus === "failed" ? "failed" : "running"}`}>
                  {orchStatus}
                </span>
              )}
              <button
                type="button"
                className="icon-only-button"
                onClick={resetToForm}
                title="Nueva orquestación"
              >
                <RotateCcw size={14} />
              </button>
            </>
          ) : (
            <span className="panel-chip">{selectedSkill?.steps.length ?? 0} steps</span>
          )}
        </div>
      </div>

      {mode === "live" ? (
        <div className="orchestration-live">
          <div className="orchestration-live-meta">
            <span className="orchestration-live-goal">{liveStatus?.goal ?? "…"}</span>
            {!isTerminal && liveStatus && (
              <span className="orchestration-live-progress">{doneCount}/{totalCount}</span>
            )}
          </div>
          <ol className="orchestration-step-list">
            {liveStatus
              ? liveStatus.steps.map((step, i) => (
                  <li
                    key={step.stepId}
                    className={`orchestration-step orchestration-step--${step.status}`}
                  >
                    <StepIndicator step={step} index={i} />
                    <Route size={16} />
                    <div>
                      <strong>{step.label}</strong>
                      <span>{step.agentName} · {step.phase}</span>
                    </div>
                  </li>
                ))
              : selectedSkill?.steps.map((step, i) => (
                  <li key={step.id} className="orchestration-step orchestration-step--pending">
                    <span className="orchestration-step-index orchestration-step-index--pending">{i + 1}</span>
                    <Route size={16} />
                    <div>
                      <strong>{step.label}</strong>
                      <span>{step.agentName} · {step.phase}</span>
                    </div>
                  </li>
                ))}
          </ol>
        </div>
      ) : (
        <>
          <div className="orchestration-form">
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
            />
            <textarea
              aria-label="Orchestration context"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Context (optional)"
              rows={2}
              disabled={isStartingOrchestration}
            />
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
            <p className="orchestration-error">{orchestrationErrorMessage}</p>
          )}

          {isLoadingOrchestrationSkillsWithoutCache && (
            <p className="empty-state">Loading skills…</p>
          )}

          {selectedSkill && (
            <ol className="orchestration-step-list">
              {selectedSkill.steps.map((step, i) => (
                <li key={step.id} className="orchestration-step orchestration-step--pending">
                  <span className="orchestration-step-index orchestration-step-index--pending">{i + 1}</span>
                  <Route size={16} />
                  <div>
                    <strong>{step.label}</strong>
                    <span>{step.agentName} · {step.agentRole} · {step.phase}</span>
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
