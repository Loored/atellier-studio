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
    <div className="grid grid-cols-[var(--sidebar-w)_1fr] grid-rows-[var(--header-h)_1fr] h-screen overflow-hidden">
      <header className="col-span-2 flex items-center justify-between gap-4 px-4 pl-3 bg-[rgba(5,7,16,0.95)] backdrop-blur-[20px] border-b border-white/5 z-10">
        <div className="flex items-baseline gap-2">
          <span className="text-[1.1rem] font-bold italic text-ink tracking-[-0.02em]">Atellier</span>
          <span className="text-[0.65rem] font-bold tracking-[0.1em] text-ink-faint">STUDIO</span>
        </div>
        <div className="flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
          <span className="status-dot status-dot--live" />
          <span>Sesión activa</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center h-6 border border-[var(--border-card)] rounded-full px-2.5 text-[0.72rem] font-semibold text-ink-muted bg-[var(--bg-card)]">
            {agents.length} agentes
          </span>
        </div>
      </header>
      <Sidebar view={view} onViewChange={setView} agents={agents} />
      <main className="overflow-hidden bg-canvas relative">
        {view === "office" ? <OfficeView /> : <Dashboard />}
      </main>
    </div>
  );
}
