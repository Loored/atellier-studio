import { Plus, UserRoundCog } from "lucide-react";
import { useAgentsPanel } from "../hooks/useAgentsPanel";

export function AgentsPanel() {
  const {
    agentList,
    isCreatingAgent,
    isLoadingAgentsWithoutCache,
    name,
    setName,
    role,
    setRole,
    roles,
    handleCreate,
  } = useAgentsPanel();

  return (
    <section className="panel panel-compact">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Operations</p>
          <h2>Agents</h2>
        </div>
        <span className="panel-chip">{agentList.length} total</span>
      </div>

      <div className="agent-form">
        <input
          type="text"
          placeholder="Agent name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          disabled={isCreatingAgent}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          disabled={isCreatingAgent}
        >
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <button type="button" onClick={handleCreate} disabled={isCreatingAgent || !name.trim()}>
          <Plus size={16} />
          Add
        </button>
      </div>

      {isLoadingAgentsWithoutCache ? <p className="empty-state">Loading agents</p> : null}
      {!isLoadingAgentsWithoutCache && agentList.length === 0 ? (
        <p className="empty-state">No agents yet</p>
      ) : null}

      <ul className="item-list">
        {agentList.map((agent) => (
          <li className="item-card" key={agent.id}>
            <UserRoundCog size={20} />
            <div>
              <strong>{agent.name}</strong>
              <span>{agent.role}</span>
            </div>
            <small className={`status-badge status-badge-${agent.status}`}>{agent.status}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
