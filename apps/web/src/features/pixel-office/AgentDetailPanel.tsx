import { useState } from "react";
import { X } from "lucide-react";
import type { Agent } from "@atellier/shared";
import { useUpdateAgentStatusApi } from "../../api/hooks/agents/useAgentsApi";

const ROLE_COLORS: Record<string, string> = {
  intake: "#2e6ea8",
  "wiki-curator": "#7a3e55",
  pm: "#e07c1a",
  builder: "#1f6f68",
  qa: "#9a3412",
  designer: "#6d28d9",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  intake: "Recibe y procesa solicitudes entrantes",
  "wiki-curator": "Mantiene y organiza el conocimiento",
  pm: "Coordina tareas y gestiona el proyecto",
  builder: "Construye y desarrolla funcionalidades",
  qa: "Verifica calidad y detecta errores",
  designer: "Conceptos & Dirección Visual",
};

const STATUS_LABELS: Record<string, string> = {
  idle: "Idle",
  reading: "Leyendo",
  thinking: "Pensando",
  planning: "Planificando",
  writing: "Escribiendo",
  executing: "Ejecutando",
  reviewing: "Revisando",
  blocked: "Bloqueado",
  "needs-human": "Esperando",
  done: "Hecho",
};

type Props = {
  agent: Agent;
  agentIndex: number;
  onClose: () => void;
  side?: "left" | "right";
};

export function AgentDetailPanel({ agent, agentIndex, onClose, side = "left" }: Props) {
  const [instruction, setInstruction] = useState("");
  const updateStatus = useUpdateAgentStatusApi();

  const isActive = agent.status !== "idle" && agent.status !== "done";
  const isBlocked = agent.status === "blocked" || agent.status === "needs-human";

  const pillClass = isBlocked ? "blocked" : isActive ? "active" : "idle";

  // Progress based on actual status
  const progressWidth =
    agent.status === "executing" || agent.status === "writing" || agent.status === "reviewing"
      ? "60%"
      : agent.status === "thinking" || agent.status === "planning"
        ? "30%"
        : "0%";

  // Live activity text
  const activityText =
    ({
      idle: "Esperando nueva actividad...",
      executing: "Ejecutando instrucción...",
      writing: "Redactando respuesta...",
      thinking: "Procesando...",
      planning: "Planificando tarea...",
      reviewing: "Revisando...",
      reading: "Leyendo contexto...",
      blocked: "Bloqueado — necesita atención",
      "needs-human": "Esperando input humano",
      done: "Tarea completada",
    } as Record<string, string>)[agent.status] ?? "En proceso...";

  const handleSend = () => {
    const trimmed = instruction.trim();
    if (!trimmed) return;

    // Update agent status to executing
    updateStatus.mutate(
      { agentId: agent.id, input: { status: "executing" } },
      {
        onSuccess: () => {
          // After 4 seconds, simulate work done → return to idle
          setTimeout(() => {
            updateStatus.mutate({ agentId: agent.id, input: { status: "idle" } });
          }, 4000);
        },
      },
    );

    setInstruction("");
  };

  return (
    <div className={`agent-float-panel agent-float-panel--${side}`}>
      {/* Header */}
      <div className="agent-float-header">
        <div
          className="agent-float-avatar"
          style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>
        <div className="agent-float-identity">
          <strong className="agent-float-name">{agent.name}</strong>
          <span className="agent-float-role-desc">{ROLE_DESCRIPTIONS[agent.role] ?? agent.role}</span>
        </div>
        <div className="agent-float-meta">
          <span className={`agent-status-pill agent-status-pill--${pillClass}`}>
            {STATUS_LABELS[agent.status] ?? agent.status}
          </span>
          <span className="agent-float-number">Agent #{agentIndex + 1}</span>
        </div>
        <button className="agent-float-close" onClick={onClose} aria-label="Close panel">
          <X size={14} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="agent-float-toolbar">
        <button className="agent-float-terminal-btn">Open Agent Terminal</button>
        <span className={`agent-float-status-dot agent-float-status-dot--${pillClass}`} />
        <span className="agent-float-status-label">{STATUS_LABELS[agent.status] ?? agent.status}</span>
        <span className="agent-float-msgs">0 messages</span>
      </div>

      {/* Live activity */}
      <div className="agent-float-section">
        <div className="agent-float-section-row">
          <span className="agent-float-section-label">LIVE ACTIVITY</span>
          {isActive && <span className="agent-float-ago">ahora</span>}
        </div>
        <div className="agent-float-progress-track">
          <div
            className="agent-float-progress-fill"
            style={{ width: progressWidth }}
          />
        </div>
        <p className="agent-float-activity-text">{activityText}</p>
      </div>

      {/* Agent instructions */}
      <div className="agent-float-body">
        <p className="agent-float-desc">
          {agent.currentTaskId
            ? `Tarea activa: ${agent.currentTaskId}`
            : `${ROLE_DESCRIPTIONS[agent.role] ?? agent.role}. Define las instrucciones para este agente.`}
        </p>
      </div>

      {/* Footer: chat */}
      <div className="agent-float-footer">
        <p className="agent-float-drop-hint">Drop xlsx, csv, pdf, images, video, markdown or json here.</p>
        <div className="agent-float-chat">
          <textarea
            className="agent-float-input"
            placeholder="Escribe un mensaje..."
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            rows={3}
          />
          <button
            className="agent-float-send"
            onClick={handleSend}
            disabled={!instruction.trim() || updateStatus.isPending}
          >
            {updateStatus.isPending ? "Enviando..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
