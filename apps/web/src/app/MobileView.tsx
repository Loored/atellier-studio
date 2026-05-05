import { useState } from "react";
import { useAgentsApi } from "../api/hooks/agents/useAgentsApi";
import { useTasksApi } from "../api/hooks/tasks/useTasksApi";

const ROLE_EMOJI: Record<string, string> = {
  intake:         "🧙",
  "wiki-curator": "📚",
  pm:             "🔮",
  builder:        "💻",
  qa:             "🔍",
  designer:       "🎨",
};

const ROLE_DESC: Record<string, string> = {
  intake:         "Recibe y coordina el trabajo entrante",
  "wiki-curator": "Mantiene el conocimiento vivo",
  pm:             "Coordina el swarm y reparte trabajo",
  builder:        "Construye y desarrolla funciones",
  qa:             "Verifica calidad y detecta errores",
  designer:       "Diseña conceptos y dirección visual",
};

const STATUS_COLOR: Record<string, string> = {
  idle:          "#4b4f6b",
  executing:     "#1de5b5",
  working:       "#1de5b5",
  thinking:      "#7c5cfc",
  planning:      "#7c5cfc",
  writing:       "#7c5cfc",
  blocked:       "#f97316",
  "needs-human": "#f97316",
  done:          "#4ade80",
  reading:       "#7c5cfc",
  reviewing:     "#7c5cfc",
};

const STATUS_LABEL: Record<string, string> = {
  idle:          "Listo para operar",
  executing:     "Ejecutando",
  thinking:      "Pensando",
  planning:      "Planificando",
  writing:       "Escribiendo",
  reading:       "Leyendo",
  reviewing:     "Revisando",
  blocked:       "Bloqueado",
  "needs-human": "Esperando input",
  done:          "Completado",
};

type MobileTab = "agentes" | "actividad" | "config";

export function MobileView() {
  const [tab, setTab] = useState<MobileTab>("agentes");
  const { data: agents = [] } = useAgentsApi();
  const { data: tasks = [] } = useTasksApi();
  const waitingAgentsCount = agents.filter((agent) => agent.status === "needs-human").length;

  return (
    <div className="mobile-shell">
      {/* Header */}
      <header className="mobile-header">
        <div className="mobile-header-meta">ATELLIER STUDIO</div>
        <h1 className="mobile-header-title">
          Pixel <span className="mobile-header-accent">Office</span>
        </h1>
        <div className="mobile-status-pill">
          <span className="mobile-status-dot" />
          Oficina activa
        </div>
      </header>

      {/* Content */}
      <main className="mobile-main">
        {tab === "agentes" && (
          <>
            <div className="mobile-section-label">AGENTES DISPONIBLES</div>
            <p className="mobile-section-sub">Despacha tareas sin salir del teléfono</p>
            <div className="mobile-agents-grid">
              {agents.map((agent) => {
                const isActive = agent.status !== "idle" && agent.status !== "done";
                return (
                  <div
                    key={agent.id}
                    className={`mobile-agent-card ${isActive ? "mobile-agent-card--active" : ""}`}
                  >
                    <span
                      className="mobile-agent-dot"
                      style={{ background: STATUS_COLOR[agent.status] ?? "#4b4f6b" }}
                    />
                    <div className="mobile-agent-emoji">
                      {ROLE_EMOJI[agent.role] ?? "🤖"}
                    </div>
                    <strong className="mobile-agent-name">{agent.name}</strong>
                    <p className="mobile-agent-desc">{ROLE_DESC[agent.role] ?? agent.role}</p>
                    <span
                      className="mobile-agent-status"
                      style={{ color: STATUS_COLOR[agent.status] ?? "#4b4f6b" }}
                    >
                      {STATUS_LABEL[agent.status] ?? agent.status}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {tab === "actividad" && (
          <>
            <div className="mobile-section-label">ACTIVIDAD RECIENTE</div>
            <div className="mobile-activity-list">
              {agents.filter(a => a.status !== "idle").map((agent) => (
                <div key={agent.id} className="mobile-activity-card">
                  <div className="mobile-activity-avatar" style={{
                    background: `linear-gradient(135deg, #7c5cfc33, #1de5b533)`
                  }}>
                    {ROLE_EMOJI[agent.role] ?? "🤖"}
                  </div>
                  <div className="mobile-activity-info">
                    <div className="mobile-activity-header">
                      <strong>{agent.name}</strong>
                      <span className="mobile-activity-badge">
                        {(STATUS_LABEL[agent.status] ?? agent.status).toUpperCase()}
                      </span>
                    </div>
                    <p className="mobile-activity-desc">{ROLE_DESC[agent.role] ?? agent.role}</p>
                    <p className="mobile-activity-msg">Actividad en curso...</p>
                    <div className="mobile-activity-footer">
                      <span>claude · sonnet</span>
                    </div>
                  </div>
                </div>
              ))}
              {agents.filter(a => a.status !== "idle").length === 0 && (
                <p className="mobile-empty">Sin actividad activa. Crea una tarea para comenzar.</p>
              )}
            </div>
          </>
        )}

        {tab === "config" && (
          <>
            <div className="mobile-section-label">CONFIGURACIÓN</div>
            <div className="mobile-config-rows">
              <div className="mobile-config-row">
                <span>Agentes activos</span>
                <strong>{agents.length}</strong>
              </div>
              <div className="mobile-config-row">
                <span>Tareas en cola</span>
                <strong>{tasks.filter(t => t.status !== "done").length}</strong>
              </div>
              <div className="mobile-config-row">
                <span>Orquestación</span>
                <strong style={{ color: "#1de5b5" }}>Activa</strong>
              </div>
              <div className="mobile-config-row">
                <span>Modelo base</span>
                <strong>claude · sonnet</strong>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Bottom nav */}
      <nav className="mobile-nav">
        {(["agentes", "actividad", "config"] as MobileTab[]).map((t) => {
          const icons: Record<MobileTab, string> = { agentes: "🤖", actividad: "⚡", config: "⚙️" };
          const labels: Record<MobileTab, string> = { agentes: "Agentes", actividad: "Actividad", config: "Config" };
          return (
            <button
              key={t}
              className={`mobile-nav-item ${tab === t ? "mobile-nav-item--active" : ""}`}
              onClick={() => setTab(t)}
            >
              {t === "actividad" && waitingAgentsCount > 0 ? (
                <span className="mobile-nav-alert">{waitingAgentsCount}</span>
              ) : null}
              <span className="mobile-nav-icon">{icons[t]}</span>
              <span className="mobile-nav-label">{labels[t]}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
