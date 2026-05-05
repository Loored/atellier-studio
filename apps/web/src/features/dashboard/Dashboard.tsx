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
  Play,
} from "lucide-react";
import { AgentsPanel } from "../agents/components/AgentsPanel";
import { SkillOrchestrationPanel } from "../orchestrations/components/SkillOrchestrationPanel";
import { CodexWorkerPanel } from "../codex/components/CodexWorkerPanel";
import { DeliverablesPanel } from "../runs/components/DeliverablesPanel";
import { WikiPanel } from "../wiki/components/WikiPanel";
import { TasksPanel } from "../tasks/components/TasksPanel";
import { useDashboard } from "./hooks/useDashboard";
import type { View } from "../../app/Sidebar";

type DashboardProps = {
  onNavigate?: (view: View) => void;
};

type MetricDef = {
  icon: React.ElementType;
  value: string | number;
  label: string;
  emphasis?: "warning" | "danger";
  onClick?: () => void;
};

function MetricCard({ icon: Icon, value, label, emphasis, onClick }: MetricDef) {
  const colorClass =
    emphasis === "warning" ? "text-gold" :
    emphasis === "danger"  ? "text-orange" :
    "text-purple";

  const borderClass =
    emphasis === "warning" ? "border-gold/25 hover:border-gold/40" :
    emphasis === "danger"  ? "border-orange/25 hover:border-orange/40" :
    "border-[var(--border-card)] hover:border-purple/28";

  const bgClass =
    emphasis === "warning" ? "bg-gold/[0.04]" :
    emphasis === "danger"  ? "bg-orange/[0.04]" :
    "bg-[var(--bg-card)]";

  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? (e) => e.key === "Enter" && onClick() : undefined}
      className={[
        "grid grid-cols-[auto_1fr] [grid-template-areas:'icon_value''icon_label'] items-center gap-x-2.5",
        "min-h-[62px] border rounded-xl px-3.5 py-3 transition-all duration-200",
        borderClass, bgClass,
        onClick ? "cursor-pointer" : "",
      ].join(" ")}
    >
      <Icon size={16} className={`[grid-area:icon] ${colorClass}`} />
      <span className="[grid-area:value] text-[1.25rem] font-extrabold text-ink leading-none tabular-nums">
        {value}
      </span>
      <small className={`[grid-area:label] text-[0.7rem] ${emphasis ? colorClass + "/70" : "text-ink-muted"}`}>
        {label}
      </small>
    </div>
  );
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const {
    agentCount,
    blockedAgentCount,
    needsHumanAgentCount,
    activeTaskCount,
    recentRunCount,
    pendingReviewRunCount,
    wikiLogReady,
    attentionAgents,
    isRefreshingDashboard,
  } = useDashboard();

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-6">

      {/* Page header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">
          Dashboard
        </h1>
        <div
          className="inline-flex items-center gap-1.5 h-7 border border-[var(--border-card)] rounded-lg px-3 text-ink-muted bg-[var(--bg-card)] text-[0.78rem]"
          aria-live="polite"
        >
          {isRefreshingDashboard
            ? <><Loader2 size={13} className="spin" /><span>Syncing</span></>
            : <><CheckCircle2 size={13} /><span>Ready</span></>}
        </div>
      </div>

      {/* ── KPI row ─────────────────────────────────────────────────── */}
      <section aria-label="Workspace status" className="mb-5">
        {/* Group labels row */}
        <div
          className="grid mb-1.5"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr)) 1px repeat(3,minmax(0,1fr)) 1px repeat(2,minmax(0,1fr))" }}
        >
          <p className="eyebrow col-span-2 pb-1">Operation</p>
          <span />
          <p className="eyebrow col-span-3 pb-1 pl-3" style={{ color: "var(--color-gold)" }}>
            Attention Required
          </p>
          <span />
          <p className="eyebrow col-span-2 pb-1 pl-3">System</p>
        </div>

        {/* Cards + dividers */}
        <div
          className="grid gap-0 rounded-xl overflow-hidden border border-[var(--border-card)]"
          style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr)) 1px repeat(3,minmax(0,1fr)) 1px repeat(2,minmax(0,1fr))" }}
        >
          {/* Operation */}
          <MetricCard icon={Users}   value={agentCount}    label="Agents" />
          <MetricCard icon={History} value={recentRunCount} label="Recent runs" />

          {/* Divider */}
          <div className="bg-[var(--border-card)] self-stretch" />

          {/* Attention */}
          <MetricCard
            icon={Bell}
            value={needsHumanAgentCount}
            label="Needs human"
            emphasis={needsHumanAgentCount > 0 ? "warning" : undefined}
            onClick={needsHumanAgentCount > 0 ? () => onNavigate?.("agents") : undefined}
          />
          <MetricCard
            icon={AlertTriangle}
            value={blockedAgentCount}
            label="Blocked"
            emphasis={blockedAgentCount > 0 ? "danger" : undefined}
            onClick={blockedAgentCount > 0 ? () => onNavigate?.("agents") : undefined}
          />
          <MetricCard
            icon={Clock}
            value={pendingReviewRunCount}
            label="In review"
            emphasis={pendingReviewRunCount > 0 ? "warning" : undefined}
            onClick={pendingReviewRunCount > 0 ? () => onNavigate?.("review") : undefined}
          />

          {/* Divider */}
          <div className="bg-[var(--border-card)] self-stretch" />

          {/* System */}
          <MetricCard icon={ListTodo} value={activeTaskCount} label="Active tasks" />
          <MetricCard
            icon={BookOpen}
            value={wikiLogReady ? "Ready" : "–"}
            label="Wiki log"
          />
        </div>
      </section>

      {/* Attention banner */}
      {attentionAgents.length > 0 && (
        <div className="mb-5 flex items-center gap-3 border border-gold/20 rounded-xl px-4 py-2.5 bg-gold/[0.03] flex-wrap">
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-gold flex-shrink-0">
            Needs attention
          </p>
          <div className="flex flex-wrap gap-1.5">
            {attentionAgents.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onClick={() => onNavigate?.("agents")}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[0.75rem] ${
                  agent.status === "needs-human"
                    ? "border-gold/30 bg-gold/10 text-gold hover:bg-gold/20"
                    : "border-orange/30 bg-orange/10 text-orange hover:bg-orange/20"
                }`}
              >
                <span className="font-semibold">{agent.name}</span>
                <small className={`status-badge status-badge-${agent.status}`}>{agent.status}</small>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Main work surface ─────────────────────────────────────────── */}
      <div className="grid grid-cols-12 gap-4 items-start">
        {/* Left rail: agents + tasks */}
        <div className="col-span-3 grid gap-4 auto-rows-min">
          <AgentsPanel />
          <TasksPanel />
        </div>

        {/* Centre: orchestration */}
        <div className="col-span-6 grid gap-4 auto-rows-min">
          <SkillOrchestrationPanel />
        </div>

        {/* Right rail: deliverables */}
        <div className="col-span-3 grid gap-4 auto-rows-min">
          <DeliverablesPanel />
        </div>

        {/* Developer tools — full width */}
        <div className="col-span-12">
          <CodexWorkerPanel />
        </div>
      </div>

      {/* Wiki — full width at bottom */}
      <div className="mt-4">
        <WikiPanel />
      </div>
    </div>
  );
}
