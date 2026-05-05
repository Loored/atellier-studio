import { Building2, LayoutDashboard } from "lucide-react";
import type { Agent } from "@atellier/shared";
import { cn } from "../lib/cn";

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

const NAV_ITEM_BASE =
  "flex flex-col items-center justify-center gap-0.5 w-full min-h-[52px] border rounded-lg px-1 py-1.5 cursor-pointer transition-all duration-150";
const NAV_ITEM_IDLE =
  "bg-transparent border-transparent text-ink-faint hover:text-ink-muted hover:bg-[var(--bg-card)] hover:border-[var(--border-card)]";
const NAV_ITEM_ACTIVE =
  "text-purple bg-purple/[0.18] border-purple/50 shadow-[0_0_16px_rgba(139,92,246,0.1)]";

export function Sidebar({ view, onViewChange, agents }: SidebarProps) {
  const activeCount = agents.filter((a) =>
    ["reading", "thinking", "planning", "writing", "executing", "reviewing"].includes(a.status)
  ).length;

  return (
    <aside className="flex flex-col items-center py-2 pb-3 bg-sidebar border-r border-white/5 overflow-y-auto z-[5]">
      {/* Nav */}
      <nav className="flex flex-col items-center gap-1 w-full px-1.5 mb-4">
        <button
          className={cn(NAV_ITEM_BASE, view === "office" ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
          onClick={() => onViewChange("office")}
          title="Oficina"
        >
          <Building2 size={18} />
          <span className="text-[0.55rem] font-semibold tracking-[0.08em]">OFICINA</span>
        </button>
        <button
          className={cn(NAV_ITEM_BASE, view === "dashboard" ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
          onClick={() => onViewChange("dashboard")}
          title="Dashboard"
        >
          <LayoutDashboard size={18} />
          <span className="text-[0.55rem] font-semibold tracking-[0.08em]">PANEL</span>
        </button>
      </nav>

      {/* Stats */}
      <div className="flex flex-col items-center gap-3 py-3 px-1.5 border-y border-white/5 w-full mb-3">
        <div className="flex flex-col items-center gap-px">
          <span className="text-[1.1rem] font-extrabold text-ink leading-none">{agents.length}</span>
          <span className="text-[0.58rem] font-semibold tracking-[0.06em] text-ink-faint uppercase">agentes</span>
        </div>
        {activeCount > 0 && (
          <div className="flex flex-col items-center gap-px">
            <span className="text-[1.1rem] font-extrabold text-teal leading-none">{activeCount}</span>
            <span className="text-[0.58rem] font-semibold tracking-[0.06em] text-ink-faint uppercase">activos</span>
          </div>
        )}
      </div>

      {/* Roster */}
      <div className="flex flex-col items-center gap-2 w-full px-1.5 mt-auto">
        <span className="text-[0.55rem] font-bold tracking-[0.1em] text-ink-faint">ROSTER</span>
        <div className="flex flex-col items-center gap-1.5">
          {agents.slice(0, 8).map((agent) => {
            const isActive = ["reading", "thinking", "planning", "writing", "executing", "reviewing"].includes(agent.status);
            const isBlocked = agent.status === "blocked" || agent.status === "needs-human";

            return (
              <div
                key={agent.id}
                className="relative flex items-center justify-center w-[34px] h-[34px] rounded-full text-[0.78rem] font-extrabold text-white/90 border-2 border-black/30"
                style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
                title={`${agent.name} · ${agent.status}`}
              >
                <span>{agent.name.charAt(0).toUpperCase()}</span>
                <span
                  className={cn(
                    "absolute bottom-px right-px w-2 h-2 rounded-full border-[1.5px] border-sidebar",
                    isActive
                      ? "bg-teal shadow-[0_0_6px_var(--color-teal)]"
                      : isBlocked
                        ? "bg-orange"
                        : "bg-ink-faint"
                  )}
                />
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
