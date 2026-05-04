import { X } from "lucide-react";
import type { Agent } from "@atellier/shared";
import { useAgentDetailPanel } from "./hooks/useAgentDetailPanel";

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
  const {
    instruction,
    handoffAgentId,
    handoffInstruction,
    isTerminalOpen,
    terminalCommand,
    terminalLines,
    handoffCandidateList,
    messageList,
    streamingResponse,
    streamingStatus,
    streamErrorMessage,
    isLoadingMessagesWithoutCache,
    isRunningInstruction,
    isUpdatingAgentStatus,
    setHandoffAgentId,
    setHandoffInstruction,
    setInstruction,
    setTerminalCommand,
    handleResumeAgent,
    handleRunTerminalCommand,
    handleSendInstruction,
    handleToggleTerminal,
  } = useAgentDetailPanel(agent);

  const isActive = agent.status !== "idle" && agent.status !== "done" && agent.status !== "needs-human";
  const isHardBlocked = agent.status === "blocked";
  const isWaiting = agent.status === "needs-human";

  const pillClass = isHardBlocked ? "blocked" : isWaiting ? "waiting" : isActive ? "active" : "idle";

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
      "needs-human": "Esperando input humano para continuar",
      done: "Tarea completada",
    } as Record<string, string>)[agent.status] ?? "En proceso...";

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
        <button className="agent-float-terminal-btn" onClick={handleToggleTerminal}>
          {isTerminalOpen ? "Hide Agent Terminal" : "Open Agent Terminal"}
        </button>
        {(isHardBlocked || isWaiting) ? (
          <button
            className="agent-float-action-btn"
            onClick={handleResumeAgent}
            disabled={isUpdatingAgentStatus}
          >
            {isUpdatingAgentStatus ? "..." : "Resume"}
          </button>
        ) : null}
        <span className={`agent-float-status-dot agent-float-status-dot--${pillClass}`} />
        <span className="agent-float-status-label">{STATUS_LABELS[agent.status] ?? agent.status}</span>
        <span className="agent-float-msgs">{messageList.length} messages</span>
      </div>

      {isTerminalOpen ? (
        <div className="agent-terminal">
          <div className="agent-terminal-log">
            {terminalLines.length === 0 ? (
              <p className="agent-terminal-line agent-terminal-line--muted">terminal empty</p>
            ) : (
              terminalLines.slice(-14).map((line) => (
                <p
                  className={`agent-terminal-line agent-terminal-line--${line.tone}`}
                  key={line.id}
                >
                  {line.text}
                </p>
              ))
            )}
          </div>
          <div className="agent-terminal-input-row">
            <input
              className="agent-terminal-input"
              value={terminalCommand}
              onChange={(event) => setTerminalCommand(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  handleRunTerminalCommand();
                }
              }}
              placeholder="run crea propuesta visual"
            />
            <button className="agent-terminal-run" onClick={handleRunTerminalCommand}>Run</button>
          </div>
        </div>
      ) : null}

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
        {isRunningInstruction || streamingResponse ? (
          <p className="agent-float-streaming">
            {streamingStatus !== "idle" ? `[${streamingStatus}] ` : ""}
            {streamingResponse || "Esperando salida del agente..."}
          </p>
        ) : null}
        {streamErrorMessage ? (
          <p className="agent-float-stream-error">{streamErrorMessage}</p>
        ) : null}
      </div>

      {/* Agent instructions */}
      <div className="agent-float-body">
        <p className="agent-float-desc">
          {agent.currentTaskId
            ? `Tarea activa: ${agent.currentTaskId}`
            : `${ROLE_DESCRIPTIONS[agent.role] ?? agent.role}. Define las instrucciones para este agente.`}
        </p>
        <div className="agent-float-messages">
          {isLoadingMessagesWithoutCache ? (
            <p className="agent-float-msg-empty">Cargando mensajes…</p>
          ) : messageList.length === 0 ? (
            <p className="agent-float-msg-empty">Sin historial aún.</p>
          ) : (
            messageList.slice(-4).map((message) => (
              <p className="agent-float-msg-item" key={message.id}>
                <strong>{message.role}:</strong> {message.content}
              </p>
            ))
          )}
        </div>
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
          <div className="agent-float-handoff">
            <select
              className="agent-float-handoff-select"
              value={handoffAgentId}
              onChange={(event) => setHandoffAgentId(event.target.value)}
            >
              <option value="">Sin handoff</option>
              {handoffCandidateList.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name} ({candidate.role})
                </option>
              ))}
            </select>
            {handoffAgentId ? (
              <input
                className="agent-float-handoff-input"
                placeholder="Instrucción para el siguiente agente"
                value={handoffInstruction}
                onChange={(event) => setHandoffInstruction(event.target.value)}
              />
            ) : null}
          </div>
          <button
            className="agent-float-send"
            onClick={handleSendInstruction}
            disabled={!instruction.trim() || isRunningInstruction || isUpdatingAgentStatus}
          >
            {isRunningInstruction ? "Ejecutando..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
