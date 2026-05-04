import { Activity, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { AgentsPanel } from "../agents/components/AgentsPanel";
import { RunsTimeline } from "../runs/components/RunsTimeline";
import { TasksPanel } from "../tasks/components/TasksPanel";
import { WikiPanel } from "../wiki/components/WikiPanel";
import { useDashboard } from "./hooks/useDashboard";

export function Dashboard() {
  const { agentCount, activeTaskCount, recentRunCount, wikiLogReady, isRefreshingDashboard } = useDashboard();

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Milestone 0</p>
          <h1>Atellier Studio Dashboard</h1>
        </div>
        <div className="topbar-status" aria-live="polite">
          {isRefreshingDashboard ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}
          <span>{isRefreshingDashboard ? "Syncing" : "Ready"}</span>
        </div>
      </header>

      <section className="metric-row" aria-label="Workspace status">
        <div className="metric">
          <Activity size={18} />
          <span>{agentCount}</span>
          <small>Agents</small>
        </div>
        <div className="metric">
          <CheckCircle2 size={18} />
          <span>{activeTaskCount}</span>
          <small>Active tasks</small>
        </div>
        <div className="metric">
          <Activity size={18} />
          <span>{recentRunCount}</span>
          <small>Runs</small>
        </div>
        <div className="metric">
          <BookOpen size={18} />
          <span>{wikiLogReady ? "On" : "Off"}</span>
          <small>Wiki log</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <AgentsPanel />
        <TasksPanel />
        <RunsTimeline />
        <WikiPanel />
      </div>
    </main>
  );
}
