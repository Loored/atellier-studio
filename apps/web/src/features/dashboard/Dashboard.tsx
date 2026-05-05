import {
  AlertTriangle,
  Bell,
  BookOpen,
  CheckCircle2,
  Clock,
  History,
  Loader2,
  ListTodo,
  Users,
} from "lucide-react";
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
    executorMode,
    executorModel,
    modelProfile,
    isRefreshingDashboard,
  } = useDashboard();

  return (
    <div className="p-6 px-7 max-w-[1200px] h-full overflow-y-auto">
      {/* Topbar */}
      <div className="flex items-center justify-between gap-4 pb-5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Dev</p>
          <h1 className="text-[clamp(1.8rem,2rem+1vw,2.8rem)] font-extrabold tracking-[-0.03em] text-ink leading-none">
            Atellier Studio
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`inline-flex items-center gap-1.5 min-h-8 border rounded-lg px-3 text-[0.8rem] ${
              executorMode === "openai"
                ? "border-orange/35 text-orange bg-orange/10"
                : "border-teal/35 text-teal bg-teal/10"
            }`}
            aria-label="Executor runtime"
          >
            <span className="font-bold uppercase tracking-[0.08em]">{executorMode}</span>
            <span className="text-ink-muted">({modelProfile})</span>
            <span className="text-ink">{executorModel}</span>
          </div>
          <div
            className="inline-flex items-center gap-1.5 min-h-8 border border-[var(--border-card)] rounded-lg px-3 text-ink-muted bg-[var(--bg-card)] text-[0.82rem]"
            aria-live="polite"
          >
            {isRefreshingDashboard ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <CheckCircle2 size={16} />
            )}
            <span>{isRefreshingDashboard ? "Syncing" : "Ready"}</span>
          </div>
        </div>
      </div>
      {executorMode === "openai" ? (
        <div className="mb-4 border border-orange/30 bg-orange/10 rounded-[var(--panel-radius)] px-3 py-2 text-[0.82rem] text-orange">
          OpenAI execution is active. Review goals, scope, and approval-sensitive actions before running.
        </div>
      ) : null}

      {/* Metrics */}
      <section
        className="grid grid-cols-7 gap-3 mb-4"
        aria-label="Workspace status"
      >
        {(
          [
            { icon: Users,         value: agentCount,            label: "Agents" },
            { icon: Bell,          value: needsHumanAgentCount,  label: "Needs human" },
            { icon: AlertTriangle, value: blockedAgentCount,     label: "Blocked" },
            { icon: ListTodo,      value: activeTaskCount,       label: "Active tasks" },
            { icon: History,       value: recentRunCount,        label: "Recent runs" },
            { icon: Clock,         value: pendingReviewRunCount, label: "Pending review" },
            { icon: BookOpen,      value: wikiLogReady ? "On" : "Off", label: "Wiki log" },
          ] as const
        ).map(({ icon: Icon, value, label }) => (
          <div
            key={label}
            className="grid grid-cols-[auto_1fr] [grid-template-areas:'icon_value''icon_label'] items-center gap-x-3 min-h-[72px] border border-[var(--border-card)] rounded-[var(--panel-radius)] px-4 py-3.5 bg-[var(--bg-card)] transition-[border-color,box-shadow] duration-200 hover:border-purple/28 hover:shadow-[0_0_16px_rgba(139,92,246,0.06)]"
          >
            <Icon size={18} className="[grid-area:icon] text-purple" />
            <span className="[grid-area:value] text-[1.4rem] font-extrabold text-ink">{value}</span>
            <small className="[grid-area:label] text-ink-muted text-[0.78rem]">{label}</small>
          </div>
        ))}
      </section>

      {/* Panel grid */}
      <div className="grid items-start grid-cols-12 gap-3.5">
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
