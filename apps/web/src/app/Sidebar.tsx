import type { Agent } from "@atellier/shared";

const ROLE_COLORS: Record<string, string> = {
  intake: "#2e6ea8",
  "wiki-curator": "#7a3e55",
  pm: "#e07c1a",
  builder: "#1f6f68",
  qa: "#9a3412",
  designer: "#6d28d9",
};

type View = "office" | "dashboard";

type SidebarProps = {
  view: View;
  onViewChange: (v: View) => void;
  agents: Agent[];
};

export function Sidebar({ view, onViewChange, agents }: SidebarProps) {
  return (
    <aside className="app-sidebar">
      <nav className="sidebar-nav">
        <button
          className={`sidebar-nav-item ${view === "office" ? "sidebar-nav-item--active" : ""}`}
          onClick={() => onViewChange("office")}
          title="Oficina"
        >
          <span className="sidebar-nav-abbr">OF</span>
          <span className="sidebar-nav-label">OFICINA</span>
        </button>
        <button
          className={`sidebar-nav-item ${view === "dashboard" ? "sidebar-nav-item--active" : ""}`}
          onClick={() => onViewChange("dashboard")}
          title="Dashboard"
        >
          <span className="sidebar-nav-abbr">DB</span>
          <span className="sidebar-nav-label">PANEL</span>
        </button>
      </nav>

      <div className="sidebar-stats">
        <div className="sidebar-stat">
          <span className="sidebar-stat-value">{agents.length}</span>
          <span className="sidebar-stat-label">agentes</span>
        </div>
      </div>

      <div className="sidebar-roster">
        <span className="sidebar-section-label">ROSTER</span>
        <div className="roster-avatars">
          {agents.slice(0, 8).map((agent) => (
            <div
              key={agent.id}
              className="roster-avatar"
              style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
              title={`${agent.name} · ${agent.status}`}
            >
              <span>{agent.name.charAt(0).toUpperCase()}</span>
              <span
                className={`roster-avatar-dot roster-avatar-dot--${
                  agent.status === "idle"
                    ? "idle"
                    : agent.status === "blocked" || agent.status === "needs-human"
                      ? "blocked"
                      : "active"
                }`}
              />
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}
