import {
  Activity,
  BookOpen,
  Building2,
  ClipboardCheck,
  LayoutDashboard,
  Network,
  Settings2,
  Users,
} from "lucide-react";
import type { Agent } from "@atellier/shared";
import { cn } from "../lib/cn";

const ROLE_COLORS: Record<string, string> = {
  intake:         "#2e6ea8",
  "wiki-curator": "#7a3e55",
  pm:             "#e07c1a",
  builder:        "#1f6f68",
  qa:             "#9a3412",
  designer:       "#6d28d9",
};

export type View = "dashboard" | "agents" | "runs" | "review" | "wiki" | "knowledge" | "office" | "settings";

type SidebarProps = {
  view: View;
  onViewChange: (v: View) => void;
  agents: Agent[];
};

const MAIN_NAV: { id: View; icon: React.ElementType; label: string }[] = [
  { id: "dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { id: "agents",    icon: Users,           label: "Agents" },
  { id: "runs",      icon: Activity,        label: "Runs" },
  { id: "review",    icon: ClipboardCheck,  label: "Review" },
  { id: "wiki",      icon: BookOpen,        label: "Wiki" },
  { id: "knowledge", icon: Network,         label: "Graph" },
  { id: "office",    icon: Building2,       label: "Office" },
];

export function Sidebar({ view, onViewChange, agents }: SidebarProps) {
  const activeCount = agents.filter((a) =>
    ["reading", "thinking", "planning", "writing", "executing", "reviewing"].includes(a.status)
  ).length;
  const needsHumanCount = agents.filter((a) => a.status === "needs-human").length;

  return (
    <aside className="flex flex-col py-3 pb-3 bg-[var(--bg-sidebar)] border-r border-white/5 overflow-y-auto z-[5]">
      {/* Main nav */}
      <nav className="flex flex-col gap-0.5 px-3 mb-4 flex-1">
        {MAIN_NAV.map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            aria-label={label}
            aria-current={view === id ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 w-full h-10 border rounded-lg px-3 text-left cursor-pointer transition-all duration-150",
              view === id
                ? "text-purple bg-purple/[0.18] border-purple/50 shadow-[0_0_16px_rgba(139,92,246,0.08)]"
                : "text-ink-faint border-transparent bg-transparent hover:text-ink-muted hover:bg-[var(--bg-card)] hover:border-[var(--border-card)]",
            )}
          >
            <Icon size={17} className="flex-shrink-0" />
            <span className="text-[0.84rem] font-medium tracking-[-0.01em]">{label}</span>
          </button>
        ))}
      </nav>

      {/* Stats strip */}
      <div className="flex flex-col gap-1 px-3 py-3 border-y border-white/5 mb-3">
        <div className="flex items-center justify-between">
          <span className="text-[0.7rem] text-ink-faint">Agents</span>
          <span className="text-[0.84rem] font-bold text-ink tabular-nums">{agents.length}</span>
        </div>
        {activeCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] text-ink-faint">Running</span>
            <span className="text-[0.84rem] font-bold text-teal tabular-nums">{activeCount}</span>
          </div>
        )}
        {needsHumanCount > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-[0.7rem] text-ink-faint">Waiting</span>
            <span className="text-[0.84rem] font-bold text-gold tabular-nums">{needsHumanCount}</span>
          </div>
        )}
      </div>

      {/* Roster */}
      {agents.length > 0 && (
        <div className="px-3 mb-3">
          <span className="block text-[0.62rem] font-bold tracking-[0.1em] text-ink-faint mb-2 uppercase">Roster</span>
          <div className="flex flex-wrap gap-1.5">
            {agents.slice(0, 10).map((agent) => {
              const isActive = ["reading", "thinking", "planning", "writing", "executing", "reviewing"].includes(agent.status);
              const isNeedsHuman = agent.status === "needs-human";
              const isBlocked = agent.status === "blocked";

              return (
                <div
                  key={agent.id}
                  className="relative flex items-center justify-center w-[30px] h-[30px] rounded-full text-[0.7rem] font-extrabold text-white/90 border-2 border-black/30 flex-shrink-0 cursor-default"
                  style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
                  title={`${agent.name} · ${agent.status}`}
                >
                  <span>{agent.name.charAt(0).toUpperCase()}</span>
                  <span
                    className={cn(
                      "absolute bottom-0 right-0 w-[7px] h-[7px] rounded-full border-[1.5px] border-[var(--bg-sidebar)]",
                      isNeedsHuman
                        ? "bg-gold shadow-[0_0_5px_rgba(251,191,36,0.5)]"
                        : isActive
                          ? "bg-teal shadow-[0_0_6px_var(--color-teal)]"
                          : isBlocked
                            ? "bg-orange"
                            : "bg-ink-faint",
                    )}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Settings — pinned at bottom */}
      <div className="px-3 mt-auto pt-3 border-t border-white/5">
        <button
          type="button"
          onClick={() => onViewChange("settings")}
          aria-label="Settings"
          className={cn(
            "flex items-center gap-3 w-full h-10 border rounded-lg px-3 text-left cursor-pointer transition-all duration-150",
            view === "settings"
              ? "text-purple bg-purple/[0.18] border-purple/50"
              : "text-ink-faint border-transparent bg-transparent hover:text-ink-muted hover:bg-[var(--bg-card)] hover:border-[var(--border-card)]",
          )}
        >
          <Settings2 size={17} className="flex-shrink-0" />
          <span className="text-[0.84rem] font-medium">Settings</span>
        </button>
      </div>
    </aside>
  );
}
