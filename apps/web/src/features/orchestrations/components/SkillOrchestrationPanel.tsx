import { Play, Route, Workflow } from "lucide-react";
import type { OrchestrationSkillId } from "@atellier/shared";
import { useSkillOrchestrationPanel } from "../hooks/useSkillOrchestrationPanel";

export function SkillOrchestrationPanel() {
  const {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration,
    orchestrationErrorMessage,
    setSelectedSkillId,
    setGoal,
    setContext,
    handleStartOrchestration,
  } = useSkillOrchestrationPanel();

  return (
    <section className="panel panel-compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Skill</p>
          <h2>Orchestration</h2>
        </div>
        <span className="panel-chip">{selectedSkill?.steps.length ?? 0} steps</span>
      </div>

      <div className="orchestration-form">
        <select
          aria-label="Orchestration skill"
          value={selectedSkillId}
          onChange={(event) => setSelectedSkillId(event.target.value as OrchestrationSkillId)}
          disabled={isStartingOrchestration || orchestrationSkillList.length === 0}
        >
          {orchestrationSkillList.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
        <textarea
          aria-label="Orchestration goal"
          value={goal}
          onChange={(event) => setGoal(event.target.value)}
          placeholder="Goal"
          rows={3}
          disabled={isStartingOrchestration}
        />
        <textarea
          aria-label="Orchestration context"
          value={context}
          onChange={(event) => setContext(event.target.value)}
          placeholder="Context"
          rows={2}
          disabled={isStartingOrchestration}
        />
        <button
          type="button"
          onClick={handleStartOrchestration}
          disabled={!goal.trim() || !selectedSkill || isStartingOrchestration}
        >
          {isStartingOrchestration ? <Workflow size={16} /> : <Play size={16} />}
          {isStartingOrchestration ? "Running" : "Start"}
        </button>
      </div>

      {orchestrationErrorMessage ? (
        <p className="orchestration-error">{orchestrationErrorMessage}</p>
      ) : null}

      {isLoadingOrchestrationSkillsWithoutCache ? <p className="empty-state">Loading skills</p> : null}

      {selectedSkill ? (
        <ol className="orchestration-step-list">
          {selectedSkill.steps.map((step, index) => (
            <li className="orchestration-step" key={step.id}>
              <span className="orchestration-step-index">{index + 1}</span>
              <Route size={16} />
              <div>
                <strong>{step.label}</strong>
                <span>{step.agentName} · {step.agentRole} · {step.phase}</span>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
