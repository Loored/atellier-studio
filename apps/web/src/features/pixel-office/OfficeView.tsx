import { useState } from "react";
import { Plus, Zap, Maximize2 } from "lucide-react";
import { AGENT_ROLES } from "@atellier/shared";
import type { AgentRole, Agent } from "@atellier/shared";
import { useAgentsApi, useCreateAgentApi } from "../../api/hooks/agents/useAgentsApi";
import { useHealthApi } from "../../api/hooks/system/useSystemApi";
import { agentsToPixelCharacters } from "./hooks/usePixelOffice";
import { useOrchestrationLive } from "./hooks/useOrchestrationLive";
import { PixelOfficeCanvas } from "./PixelOfficeCanvas";
import { AgentSidePanel } from "./AgentSidePanel";
import { LiveProcessesPanel } from "./LiveProcessesPanel";
import { cn } from "../../lib/cn";

type StatusFilter = "all" | "running" | "waiting" | "inactive";

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: "all",      label: "All" },
  { id: "running",  label: "Running" },
  { id: "waiting",  label: "Waiting" },
  { id: "inactive", label: "Inactive" },
];

const RUNNING_STATUSES = new Set([
  "reading", "thinking", "planning", "writing", "executing", "reviewing",
]);

const LEGEND_STATES = [
  { color: "bg-teal",      label: "Running" },
  { color: "bg-gold",      label: "Waiting" },
  { color: "bg-purple",    label: "In review" },
  { color: "bg-ink-faint", label: "Inactive" },
  { color: "bg-orange",    label: "Blocked" },
];

function getStatusFilter(agent: Agent): StatusFilter {
  if (RUNNING_STATUSES.has(agent.status)) return "running";
  if (agent.status === "needs-human" || agent.status === "blocked") return "waiting";
  return "inactive";
}

export function OfficeView() {
  const { data: agents = [], isLoadingWithoutCache } = useAgentsApi({ livePolling: true });
  const { data: healthStatus } = useHealthApi();
  const createAgent = useCreateAgentApi();
  const characters = agentsToPixelCharacters(agents);
  const isOpenAiExecution = healthStatus?.executorMode === "openai";
  const executorModel = healthStatus?.executorModel ?? "unknown";
  const modelProfile = healthStatus?.modelProfile ?? "standard";

  const [name, setName]                   = useState("");
  const [role, setRole]                   = useState<AgentRole>("builder");
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [orchestrationEnabled, setOrchestrationEnabled] = useState(false);
  const [statusFilter, setStatusFilter]   = useState<StatusFilter>("all");
  const [showLegend, setShowLegend]       = useState(true);

  useOrchestrationLive(agents, orchestrationEnabled);

  const runningCount  = agents.filter((a) => RUNNING_STATUSES.has(a.status)).length;
  const waitingCount  = agents.filter((a) => a.status === "needs-human" || a.status === "blocked").length;
  const inactiveCount = agents.filter((a) => !RUNNING_STATUSES.has(a.status) && a.status !== "needs-human" && a.status !== "blocked").length;

  const filterCounts: Record<StatusFilter, number> = {
    all:      agents.length,
    running:  runningCount,
    waiting:  waitingCount,
    inactive: inactiveCount,
  };

  const handleCreate = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    createAgent.mutate(
      { name: trimmed, role, status: "idle" },
      { onSuccess: () => { setName(""); setRole("builder"); } },
    );
  };

  const handleCharacterClick = (charId: string) => {
    const agent = agents.find((a) => a.id === charId);
    if (!agent) return;
    if (statusFilter !== "all" && getStatusFilter(agent) !== statusFilter) return;
    setSelectedAgent((prev) => prev?.id === charId ? null : agent);
  };

  function toggleLiveOrchestration() {
    if (!orchestrationEnabled && isOpenAiExecution) {
      const confirmed = window.confirm(
        `OpenAI execution is active (${executorModel}, ${modelProfile}). Enabling Live mode will auto-run agents and may consume tokens. Continue?`,
      );
      if (!confirmed) return;
    }
    setOrchestrationEnabled((v) => !v);
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Page header ────────────────────────────────────── */}
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-(--border-subtle)">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="min-w-0">
            <h1 className="text-[1.8rem] font-extrabold tracking-[-0.03em] text-ink leading-none">
              Office
            </h1>
            <p className="text-[0.78rem] text-ink-muted mt-1">
              Monitor your agents in real time.
            </p>
          </div>

          <div className="grid justify-items-end gap-2">
            <div className="flex items-center gap-2">
              {runningCount > 0 && (
                <span className="inline-flex items-center gap-1.5 h-7 border border-teal/30 rounded-lg px-2.5 text-[0.75rem] text-teal bg-teal/10 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal" />
                  {runningCount} running
                </span>
              )}
              {waitingCount > 0 && (
                <span className="inline-flex items-center gap-1.5 h-7 border border-gold/30 rounded-lg px-2.5 text-[0.75rem] text-gold bg-gold/10 font-semibold">
                  {waitingCount} waiting
                </span>
              )}
            </div>
            {isOpenAiExecution ? (
              <div className="inline-flex max-w-[320px] items-start gap-2 rounded-lg border border-orange/25 bg-orange/10 px-2.5 py-1.5 text-[0.67rem] leading-snug text-orange">
                <span className="mt-[0.22rem] h-1.5 w-1.5 rounded-full bg-orange flex-shrink-0" />
                <span>
                  OpenAI execution active ({modelProfile} · {executorModel}). Live mode can auto-run agents and consume tokens.
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Filter chips + controls */}
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setStatusFilter(id)}
              className={cn("review-tab", statusFilter === id && "review-tab--active")}
            >
              {label}
              <span className="review-tab-count">{filterCounts[id]}</span>
            </button>
          ))}

          <div className="flex items-center gap-1.5 ml-auto">
            {/* Legend toggle */}
            <button
              type="button"
              onClick={() => setShowLegend((v) => !v)}
              className={cn(
                "h-8 px-3 text-[0.75rem] border rounded-lg transition-all",
                showLegend
                  ? "border-purple/40 text-purple bg-purple/[0.08]"
                  : "border-(--border-card) text-ink-faint bg-transparent hover:text-ink-muted hover:bg-(--bg-card)",
              )}
            >
              Legend
            </button>

            {/* Live toggle */}
            <button
              type="button"
              onClick={toggleLiveOrchestration}
              className={cn(
                "inline-flex items-center gap-1.5 h-8 border rounded-lg px-3 text-[0.78rem] font-semibold transition-all",
                orchestrationEnabled
                  ? "border-teal/30 text-teal bg-teal/[0.07]"
                  : "border-(--border-card) text-ink-faint bg-transparent hover:text-ink-muted hover:bg-(--bg-card)",
              )}
              title="Toggle live orchestration"
            >
              <Zap size={13} />
              {orchestrationEnabled ? "Live" : "Paused"}
            </button>
          </div>
        </div>
      </div>

      {/* ── Body: canvas + side panel ──────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* Canvas area */}
        <div className="flex-1 relative overflow-hidden bg-(--bg-base)">
          {isLoadingWithoutCache ? (
            <div className="office-loading">Loading office…</div>
          ) : agents.length === 0 ? (
            <div className="office-loading">No agents — add one to populate the office.</div>
          ) : (
            <div className="office-canvas-scroll">
              <PixelOfficeCanvas
                characters={characters}
                onCharacterClick={handleCharacterClick}
              />
            </div>
          )}

          {/* Live processes panel — bottom-left */}
          <LiveProcessesPanel agents={agents} />

          {/* Status legend overlay */}
          {showLegend && (
            <div className="absolute top-3 left-3 border border-[var(--border-card)] rounded-xl px-3 py-2.5 bg-[rgba(8,10,20,0.88)] backdrop-blur-sm text-[0.7rem] min-w-[130px]">
              <p className="font-bold tracking-[0.08em] uppercase text-ink-faint mb-2 text-[0.6rem]">
                States
              </p>
              <div className="grid gap-1.5">
                {LEGEND_STATES.map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className={cn("w-2 h-2 rounded-full flex-shrink-0", color)} />
                    <span className="text-ink-muted">{label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2.5 pt-2 border-t border-white/5">
                <p className="font-bold tracking-[0.08em] uppercase text-ink-faint mb-1.5 text-[0.6rem]">
                  Connections
                </p>
                <div className="grid gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-teal rounded-full flex-shrink-0" />
                    <span className="text-ink-muted">Active handoff</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-4 h-[2px] bg-purple/60 rounded-full flex-shrink-0 border-dashed" style={{ borderTop: "2px dashed rgba(139,92,246,0.6)", background: "none" }} />
                    <span className="text-ink-muted">Recent handoff</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Agent side panel */}
        {selectedAgent && (
          <div className="w-[420px] xl:w-[460px] shrink-0 overflow-y-auto border-l border-[var(--border-subtle)]">
            <AgentSidePanel
              agent={selectedAgent}
              agentIndex={agents.findIndex((a) => a.id === selectedAgent.id)}
              onClose={() => setSelectedAgent(null)}
            />
          </div>
        )}
      </div>

      {/* ── Bottom bar ─────────────────────────────────────── */}
      <nav className="office-bottom-bar">
        {/* Orchestration status chip */}
        <div className={cn(
          "inline-flex items-center gap-1.5 h-7 border rounded-lg px-2.5 text-[0.75rem] font-semibold",
          orchestrationEnabled
            ? "border-teal/30 text-teal bg-teal/[0.07]"
            : "border-(--border-card) text-ink-faint bg-transparent",
        )}>
          <span className={cn(
            "w-1.5 h-1.5 rounded-full",
            orchestrationEnabled ? "bg-teal" : "bg-ink-faint",
          )} />
          {orchestrationEnabled ? "Live" : "Paused"}
        </div>

        {/* Add agent form */}
        <div className="obb-add-form">
          <input
            type="text"
            placeholder="Agent name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="obb-input"
            disabled={createAgent.isPending}
            aria-label="New agent name"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as AgentRole)}
            className="obb-select"
            disabled={createAgent.isPending}
            aria-label="New agent role"
          >
            {AGENT_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <button
            className="obb-item obb-item--add"
            onClick={handleCreate}
            disabled={createAgent.isPending || !name.trim()}
            aria-label="Add agent"
          >
            <Plus size={13} />
            Add agent
          </button>
        </div>

        {/* Agent count + fullscreen */}
        <div className="ml-auto flex items-center gap-3">
          <div className="obb-agent-count">
            <span>{agents.length}</span>
            <small>agents</small>
          </div>
          <button
            className="obb-item"
            title="Fullscreen"
            onClick={() => document.documentElement.requestFullscreen?.()}
            aria-label="Fullscreen"
          >
            <Maximize2 size={13} />
          </button>
        </div>
      </nav>
    </div>
  );
}
