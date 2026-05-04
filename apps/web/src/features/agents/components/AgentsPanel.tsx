import { Plus, UserRoundCog } from "lucide-react";
import { useAgentsPanel } from "../hooks/useAgentsPanel";

export function AgentsPanel() {
  const { agentList, isCreatingAgent, isLoadingAgentsWithoutCache, createBuilderAgent } = useAgentsPanel();

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Agents</h2>
        </div>
        <button className="icon-button" type="button" onClick={createBuilderAgent} disabled={isCreatingAgent} title="Add agent">
          <Plus size={18} />
          <span>Add</span>
        </button>
      </div>

      {isLoadingAgentsWithoutCache ? <p className="empty-state">Loading agents</p> : null}

      {!isLoadingAgentsWithoutCache && agentList.length === 0 ? <p className="empty-state">No agents yet</p> : null}

      <ul className="item-list">
        {agentList.map((agent) => (
          <li className="item-card" key={agent.id}>
            <UserRoundCog size={20} />
            <div>
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
            </div>
            <small className="status-badge">{agent.status}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
