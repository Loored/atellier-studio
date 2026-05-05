import { useState } from "react";
import {
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  Loader2,
  TimerReset,
} from "lucide-react";
import type { Agent } from "@atellier/shared";
import { useRunsApi } from "../../api/hooks/runs/useRunsApi";
import { cn } from "../../lib/cn";

const ACTIVE_STATUSES = new Set([
  "reading", "thinking", "planning", "writing", "executing", "reviewing",
]);

const ROLE_COLORS: Record<string, string> = {
  intake:         "#2e6ea8",
  "wiki-curator": "#7a3e55",
  pm:             "#e07c1a",
  builder:        "#1f6f68",
  qa:             "#9a3412",
  designer:       "#6d28d9",
};

function elapsed(isoDate: string): string {
  const ms = Date.now() - new Date(isoDate).getTime();
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${s % 60}s`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

type Props = {
  agents: Agent[];
};

export function LiveProcessesPanel({ agents }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { data: runs = [] } = useRunsApi();

  const activeAgents  = agents.filter((a) => ACTIVE_STATUSES.has(a.status));
  const waitingAgents = agents.filter((a) => a.status === "needs-human");
  const blockedAgents = agents.filter((a) => a.status === "blocked");
  const activeRuns    = runs.filter((r) => r.status === "running");
  const pendingRuns   = runs.filter((r) => r.reviewStatus === "pending" && r.status === "completed");

  const totalProcesses = activeAgents.length + activeRuns.length;
  const totalAttention = waitingAgents.length + blockedAgents.length + pendingRuns.length;

  const hasAnything = totalProcesses > 0 || totalAttention > 0;

  return (
    <div
      className={cn(
        "absolute bottom-3 left-3 z-20 w-[280px] transition-all duration-200",
      )}
      role="region"
      aria-label="Live processes"
    >
      <div className="border border-[var(--border-card)] rounded-xl overflow-hidden bg-[rgba(8,10,20,0.93)] backdrop-blur-sm shadow-[0_8px_32px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.03)]">

        {/* ── Header ──────────────────────────────────────── */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center justify-between gap-2 w-full px-3 py-2 border-b border-white/[0.05] hover:bg-white/[0.02] transition-colors"
          aria-expanded={!collapsed}
        >
          <div className="flex items-center gap-2">
            <Activity size={13} className={totalProcesses > 0 ? "text-teal" : "text-ink-faint"} />
            <span className="text-[0.7rem] font-bold tracking-[0.07em] uppercase text-ink">
              Live Processes
            </span>
            {totalProcesses > 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-teal/20 text-teal text-[0.6rem] font-extrabold tabular-nums">
                {totalProcesses}
              </span>
            )}
            {totalAttention > 0 && totalProcesses === 0 && (
              <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-gold/20 text-gold text-[0.6rem] font-extrabold tabular-nums">
                {totalAttention}
              </span>
            )}
          </div>
          {collapsed
            ? <ChevronUp size={12} className="text-ink-faint flex-shrink-0" />
            : <ChevronDown size={12} className="text-ink-faint flex-shrink-0" />
          }
        </button>

        {/* ── Body ────────────────────────────────────────── */}
        {!collapsed && (
          <div className="max-h-[320px] overflow-y-auto p-2.5 grid gap-2">

            {/* Empty state */}
            {!hasAnything && (
              <p className="text-[0.72rem] text-ink-faint py-2 text-center">
                No active processes
              </p>
            )}

            {/* ── Executing agents ── */}
            {activeAgents.length > 0 && (
              <section>
                <p className="text-[0.57rem] font-bold tracking-[0.1em] uppercase text-ink-faint mb-1.5 px-1">
                  Agents running
                </p>
                <div className="grid gap-1">
                  {activeAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-teal/[0.05] border border-teal/[0.12]"
                    >
                      <Loader2 size={12} className="spin text-teal mt-[1px] flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="w-[6px] h-[6px] rounded-full flex-shrink-0"
                            style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
                          />
                          <span className="text-[0.78rem] font-semibold text-ink truncate">
                            {agent.name}
                          </span>
                          <span className="text-[0.65rem] text-ink-muted ml-auto flex-shrink-0">
                            {agent.role}
                          </span>
                        </div>
                        <span className="block text-[0.68rem] text-teal/70 mt-0.5">
                          {agent.currentStep?.label ?? agent.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Active runs ── */}
            {activeRuns.length > 0 && (
              <section>
                <p className="text-[0.57rem] font-bold tracking-[0.1em] uppercase text-ink-faint mb-1.5 px-1">
                  Runs in progress
                </p>
                <div className="grid gap-1">
                  {activeRuns.map((run) => {
                    const agent   = agents.find((a) => a.id === run.agentId);
                    const lastLog = run.logs.at(-1);
                    const runInput = run.input as Record<string, unknown> | undefined;
                    const stepLabel = runInput?.orchestrationStepLabel as string | undefined;
                    return (
                      <div
                        key={run.id}
                        className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-purple/[0.05] border border-purple/[0.12]"
                      >
                        <TimerReset size={12} className="text-purple/70 mt-[1px] flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[0.78rem] font-semibold text-ink capitalize">
                              {stepLabel ?? run.type}
                            </span>
                            <span className="flex items-center gap-0.5 text-[0.63rem] text-ink-faint ml-auto flex-shrink-0">
                              <Clock size={9} />
                              {elapsed(run.createdAt)}
                            </span>
                          </div>
                          {agent && (
                            <span className="block text-[0.68rem] text-ink-muted">
                              {agent.name} · {agent.role}
                            </span>
                          )}
                          {lastLog && (
                            <span className="block text-[0.63rem] text-ink-faint truncate mt-0.5">
                              {lastLog.message}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Waiting / needs-human ── */}
            {waitingAgents.length > 0 && (
              <section>
                <p className="text-[0.57rem] font-bold tracking-[0.1em] uppercase text-ink-faint mb-1.5 px-1">
                  Waiting for input
                </p>
                <div className="grid gap-1">
                  {waitingAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gold/[0.05] border border-gold/[0.12]"
                    >
                      <span className="w-[6px] h-[6px] rounded-full bg-gold flex-shrink-0 shadow-[0_0_4px_rgba(251,191,36,0.5)]" />
                      <div className="min-w-0 flex-1">
                        <span className="text-[0.75rem] font-semibold text-ink">{agent.name}</span>
                        <span className="text-[0.65rem] text-ink-muted ml-1.5">{agent.role}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Blocked ── */}
            {blockedAgents.length > 0 && (
              <section>
                <p className="text-[0.57rem] font-bold tracking-[0.1em] uppercase text-orange mb-1.5 px-1">
                  Blocked
                </p>
                <div className="grid gap-1">
                  {blockedAgents.map((agent) => (
                    <div
                      key={agent.id}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-orange/[0.05] border border-orange/[0.18]"
                    >
                      <span className="w-[6px] h-[6px] rounded-full bg-orange flex-shrink-0" />
                      <span className="text-[0.75rem] font-semibold text-ink">{agent.name}</span>
                      <span className="text-[0.65rem] text-ink-muted ml-auto">{agent.role}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Pending review ── */}
            {pendingRuns.length > 0 && (
              <div className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-purple/[0.05] border border-purple/[0.15]">
                <span className="text-[0.72rem] text-ink-accent font-semibold">
                  {pendingRuns.length} pending review
                </span>
                <span className="text-[0.62rem] text-ink-faint">→ Review</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
