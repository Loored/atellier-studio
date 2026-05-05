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
    <section className="col-span-6 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3.5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Operations</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Agents</h2>
        </div>
        <span className="inline-flex items-center min-h-6 border border-[var(--border-card)] rounded-full px-2.5 text-ink-muted bg-white/[0.03] text-[0.72rem] font-bold whitespace-nowrap">
          {agentList.length} total
        </span>
      </div>

      {/* Create form */}
      <div className="grid grid-cols-[minmax(120px,1fr)_130px_auto] gap-2 mb-3.5">
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

      {isLoadingAgentsWithoutCache ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          Loading agents
        </p>
      ) : null}
      {!isLoadingAgentsWithoutCache && agentList.length === 0 ? (
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          No agents yet
        </p>
      ) : null}

      {/* List — max-height for compact panel */}
      <ul className="grid gap-2 list-none m-0 p-0 max-h-[340px] overflow-auto">
        {agentList.map((agent) => (
          <li
            key={agent.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 min-h-14 border border-[var(--border-card)] rounded-lg px-3 py-2.5 bg-white/[0.02] transition-[border-color,background] hover:bg-[var(--bg-card-hover)] hover:border-purple/[0.22]"
          >
            <UserRoundCog size={20} className="text-ink-faint" />
            <div>
              <strong className="block text-[0.88rem] font-semibold text-ink overflow-wrap-anywhere mb-0.5">
                {agent.name}
              </strong>
              <span className="text-ink-muted text-[0.78rem]">{agent.role}</span>
            </div>
            <small className={`status-badge status-badge-${agent.status}`}>{agent.status}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}
