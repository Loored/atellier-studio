import { useState } from "react";
import { Plus, Zap } from "lucide-react";
import { AGENT_ROLES } from "@atellier/shared";
import type { AgentRole, Agent } from "@atellier/shared";
import { useAgentsApi, useCreateAgentApi } from "../../api/hooks/agents/useAgentsApi";
import { agentsToPixelCharacters } from "./hooks/usePixelOffice";
import { useOrchestrationLive } from "./hooks/useOrchestrationLive";
import { PixelOfficeCanvas } from "./PixelOfficeCanvas";
import { AgentDetailPanel } from "./AgentDetailPanel";

export function OfficeView() {
  const { data: agents = [], isLoadingWithoutCache } = useAgentsApi({ livePolling: true });
  const createAgent = useCreateAgentApi();
  const characters = agentsToPixelCharacters(agents);

  const [name, setName] = useState("");
  const [role, setRole] = useState<AgentRole>("builder");
  const [selectedAgents, setSelectedAgents] = useState<Agent[]>([]);
  const [orchestrationEnabled, setOrchestrationEnabled] = useState(false);

  useOrchestrationLive(agents, orchestrationEnabled);

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createAgent.mutate(
      { name: trimmed, role, status: "idle" },
      { onSuccess: () => { setName(""); setRole("builder"); } },
    );
  };

  const handleCharacterClick = (charId: string) => {
    const agent = agents.find((a) => a.id === charId);
    if (!agent) return;
    setSelectedAgents((prev) => {
      if (prev.find((a) => a.id === charId)) {
        return prev.filter((a) => a.id !== charId); // toggle off
      }
      return [agent, ...prev].slice(0, 2); // max 2 panels
    });
  };

  const closePanel = (agentId: string) => {
    setSelectedAgents((prev) => prev.filter((a) => a.id !== agentId));
  };

  return (
    <div className="office-full">
      {/* Canvas area */}
      <div className="office-canvas-container">
        {isLoadingWithoutCache ? (
          <div className="office-loading">Cargando oficina…</div>
        ) : agents.length === 0 ? (
          <div className="office-loading">Sin agentes — añade uno para poblar la oficina.</div>
        ) : (
          <div className="office-canvas-scroll">
            <PixelOfficeCanvas characters={characters} onCharacterClick={handleCharacterClick} />
          </div>
        )}

        {/* Floating panels (max 2) */}
        {selectedAgents[0] && (
          <AgentDetailPanel
            agent={selectedAgents[0]}
            agentIndex={agents.findIndex((a) => a.id === selectedAgents[0].id)}
            onClose={() => closePanel(selectedAgents[0].id)}
            side="left"
          />
        )}
        {selectedAgents[1] && (
          <AgentDetailPanel
            agent={selectedAgents[1]}
            agentIndex={agents.findIndex((a) => a.id === selectedAgents[1].id)}
            onClose={() => closePanel(selectedAgents[1].id)}
            side="right"
          />
        )}
      </div>

      {/* Bottom bar */}
      <nav className="office-bottom-bar">
        <button
          className={`obb-item ${orchestrationEnabled ? "obb-item--gas" : ""}`}
          onClick={() => setOrchestrationEnabled((current) => !current)}
          title="Toggle real orchestration"
        >
          <Zap size={13} />
          {orchestrationEnabled ? "ORQUESTACIÓN" : "PAUSADO"}
        </button>
        <div className="obb-add-form">
          <input
            type="text"
            placeholder="Nombre agente"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="obb-input"
            disabled={createAgent.isPending}
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AgentRole)}
            className="obb-select"
            disabled={createAgent.isPending}
          >
            {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            className="obb-item obb-item--add"
            onClick={handleCreate}
            disabled={createAgent.isPending || !name.trim()}
          >
            <Plus size={13} />
            Agente
          </button>
        </div>
        <button className="obb-item">Layout</button>
        <button className="obb-item">Dashboard</button>
        <button className="obb-item">GRAFO</button>
        <button className="obb-item">Settings</button>
        <div className="obb-agent-count">
          <span>{agents.length}/13</span>
          <small>activos</small>
        </div>
      </nav>
    </div>
  );
}
