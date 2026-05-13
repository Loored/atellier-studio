import { useState, useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import type { View } from "./Sidebar";
import { MobileView } from "./MobileView";
import { Dashboard } from "../features/dashboard/Dashboard";
import { AgentsView } from "../features/agents/AgentsView";
import { RunsView } from "../features/runs/RunsView";
import { ReviewView } from "../features/review/ReviewView";
import { WikiView } from "../features/wiki/WikiView";
import { KnowledgeGraphView } from "../features/knowledge/KnowledgeGraphView";
import { OfficeView } from "../features/pixel-office/OfficeView";
import { SettingsView } from "../features/settings/SettingsView";
import { useAgentsApi } from "../api/hooks/agents/useAgentsApi";
import { useHealthApi } from "../api/hooks/system/useSystemApi";

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
  const { data: healthStatus } = useHealthApi();
  const isMobile = useIsMobile();
  const previousWaitingIds = useRef<Set<string>>(new Set());

  const executorMode  = healthStatus?.executorMode  ?? "mock";
  const executorModel = healthStatus?.executorModel ?? "–";
  const modelProfile  = healthStatus?.modelProfile  ?? "standard";

  useEffect(() => {
    const waitingAgents = agents.filter((agent) => agent.status === "needs-human");
    const nextWaitingIds = new Set(waitingAgents.map((agent) => agent.id));
    const newWaitingAgents = waitingAgents.filter(
      (agent) => !previousWaitingIds.current.has(agent.id),
    );

    if (
      newWaitingAgents.length > 0 &&
      typeof window !== "undefined" &&
      "Notification" in window
    ) {
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
    <div
      className="grid h-screen overflow-hidden"
      style={{
        gridTemplateColumns: "var(--sidebar-w) 1fr",
        gridTemplateRows: "var(--header-h) 1fr",
      }}
    >
      {/* Header — full width */}
      <header
        className="col-span-2 flex items-center justify-between gap-4 px-5 pl-4 z-10 border-b border-white/5"
        style={{ background: "rgba(5,7,16,0.95)", backdropFilter: "blur(20px)" }}
      >
        {/* Logo */}
        <div className="flex items-baseline gap-2 flex-shrink-0">
          <span className="text-[1.05rem] font-bold italic text-ink tracking-[-0.02em]">Atellier</span>
          <span className="text-[0.6rem] font-bold tracking-[0.12em] text-ink-faint">STUDIO</span>
        </div>

        {/* Session status */}
        <div className="flex items-center gap-1.5 text-[0.78rem] text-ink-muted">
          <span className="status-dot status-dot--live" />
          <span>Active session</span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Executor / environment badge */}
          <div
            className={`inline-flex items-center gap-1.5 h-7 border rounded-lg px-2.5 text-[0.75rem] ${
              executorMode === "openai"
                ? "border-orange/35 text-orange bg-orange/10"
                : "border-[var(--border-card)] text-ink-muted bg-[var(--bg-card)]"
            }`}
          >
            <span className="font-bold uppercase tracking-[0.06em]">{executorMode}</span>
            <span className="text-ink-faint">({modelProfile})</span>
            <span className="text-ink font-medium">{executorModel}</span>
          </div>

          {/* Agent count */}
          <span className="inline-flex items-center h-7 border border-[var(--border-card)] rounded-lg px-2.5 text-[0.75rem] font-semibold text-ink-muted bg-[var(--bg-card)] gap-1">
            <span className="text-ink font-bold">{agents.length}</span>
            <span>agents</span>
          </span>
        </div>
      </header>

      <Sidebar view={view} onViewChange={setView} agents={agents} />

      <main className="overflow-hidden bg-canvas relative">
        {view === "dashboard" && <Dashboard onNavigate={setView} />}
        {view === "agents"    && <AgentsView />}
        {view === "runs"      && <RunsView />}
        {view === "review"    && <ReviewView />}
        {view === "wiki"      && <WikiView />}
        {view === "knowledge" && <KnowledgeGraphView onNavigate={setView} />}
        {view === "office"    && <OfficeView />}
        {view === "settings"  && <SettingsView />}
      </main>
    </div>
  );
}
