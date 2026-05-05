import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { MobileView } from "./MobileView";
import { Dashboard } from "../features/dashboard/Dashboard";
import { OfficeView } from "../features/pixel-office/OfficeView";
import { useAgentsApi } from "../api/hooks/agents/useAgentsApi";

type View = "office" | "dashboard";

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return isMobile;
}

export function AppShell() {
  const [view, setView] = useState<View>("dashboard");
  const { data: agents = [] } = useAgentsApi();
  const isMobile = useIsMobile();
  const previousWaitingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    const waitingAgents = agents.filter((agent) => agent.status === "needs-human");
    const nextWaitingIds = new Set(waitingAgents.map((agent) => agent.id));
    const newWaitingAgents = waitingAgents.filter((agent) => !previousWaitingIds.current.has(agent.id));

    if (newWaitingAgents.length > 0 && typeof window !== "undefined" && "Notification" in window) {
      if (Notification.permission === "granted") {
        for (const agent of newWaitingAgents) {
          new Notification(`Agent waiting: ${agent.name}`, {
            body: "Needs human input to continue the run.",
            tag: `agent-needs-human-${agent.id}`,
          });
        }
      } else if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    }

    previousWaitingIds.current = nextWaitingIds;
  }, [agents]);

  if (isMobile) {
    return <MobileView />;
  }

  return (
    <div className="app-root">
      <header className="app-header">
        <div className="app-logo">
          <span className="app-logo-mark">Atellier</span>
          <span className="app-logo-workspace">STUDIO</span>
        </div>
        <div className="app-header-status">
          <span className="status-dot status-dot--live" />
          <span>Sesión activa</span>
        </div>
        <div className="app-header-right">
          <span className="app-header-pill">{agents.length} agentes</span>
        </div>
      </header>
      <Sidebar view={view} onViewChange={setView} agents={agents} />
      <main className="app-main">
        {view === "office" ? <OfficeView /> : <Dashboard />}
      </main>
    </div>
  );
}
