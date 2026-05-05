import { Activity, BookOpen, CheckCircle2, Loader2 } from "lucide-react";
import { AgentsPanel } from "../agents/components/AgentsPanel";
import { SkillOrchestrationPanel } from "../orchestrations/components/SkillOrchestrationPanel";
import { DeliverablesPanel } from "../runs/components/DeliverablesPanel";
import { RunsTimeline } from "../runs/components/RunsTimeline";
import { TasksPanel } from "../tasks/components/TasksPanel";
import { WikiPanel } from "../wiki/components/WikiPanel";
import { useDashboard } from "./hooks/useDashboard";

export function Dashboard() {
  const {
    agentCount,
    blockedAgentCount,
    needsHumanAgentCount,
    activeTaskCount,
    recentRunCount,
    pendingReviewRunCount,
    wikiLogReady,
    isRefreshingDashboard,
  } =
    useDashboard();

  return (
    <div className="dashboard-content">
      <div className="dashboard-topbar">
        <div>
          <p className="eyebrow">Milestone 0</p>
          <h1 className="dashboard-title">Atellier Studio</h1>
        </div>
        <div className="topbar-status" aria-live="polite">
          {isRefreshingDashboard ? (
            <Loader2 size={16} className="spin" />
          ) : (
            <CheckCircle2 size={16} />
          )}
          <span>{isRefreshingDashboard ? "Syncing" : "Ready"}</span>
        </div>
      </div>

      <section className="metric-row" aria-label="Workspace status">
        <div className="metric">
          <Activity size={18} />
          <span>{agentCount}</span>
          <small>Agents</small>
        </div>
        <div className="metric">
          <Activity size={18} />
          <span>{needsHumanAgentCount}</span>
          <small>Needs human</small>
        </div>
        <div className="metric">
          <Activity size={18} />
          <span>{blockedAgentCount}</span>
          <small>Blocked agents</small>
        </div>
        <div className="metric">
          <CheckCircle2 size={18} />
          <span>{activeTaskCount}</span>
          <small>Active tasks</small>
        </div>
        <div className="metric">
          <Activity size={18} />
          <span>{recentRunCount}</span>
          <small>Recent runs</small>
        </div>
        <div className="metric">
          <CheckCircle2 size={18} />
          <span>{pendingReviewRunCount}</span>
          <small>Pending review</small>
        </div>
        <div className="metric">
          <BookOpen size={18} />
          <span>{wikiLogReady ? "On" : "Off"}</span>
          <small>Wiki log</small>
        </div>
      </section>

      <div className="dashboard-grid">
        <AgentsPanel />
        <SkillOrchestrationPanel />
        <RunsTimeline />
        <DeliverablesPanel />
        <TasksPanel />
        <WikiPanel />
      </div>
    </div>
  );
}
