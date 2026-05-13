import { useState } from "react";
import { ChevronRight, Copy, Send, Terminal, X, Zap } from "lucide-react";
import type { Agent } from "@atellier/shared";
import { cn } from "../../lib/cn";
import { ValidationSummary } from "../../components/ValidationSummary";
import { useAgentDetailPanel } from "./hooks/useAgentDetailPanel";

const ROLE_COLORS: Record<string, string> = {
  intake:         "#2e6ea8",
  "wiki-curator": "#7a3e55",
  pm:             "#e07c1a",
  builder:        "#1f6f68",
  qa:             "#9a3412",
  designer:       "#6d28d9",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  intake:         "Receives and processes requests",
  "wiki-curator": "Maintains and organizes knowledge",
  pm:             "Coordinates tasks and manages project",
  builder:        "Builds and develops features",
  qa:             "Verifies quality and detects bugs",
  designer:       "Concepts & Visual Direction",
};

const STATUS_LABELS: Record<string, string> = {
  idle:         "Idle",
  reading:      "Reading",
  thinking:     "Thinking",
  planning:     "Planning",
  writing:      "Writing",
  executing:    "Executing",
  reviewing:    "Reviewing",
  blocked:      "Blocked",
  "needs-human":"Waiting",
  done:         "Done",
};

const STATUS_COLOR: Record<string, string> = {
  idle:         "text-ink-faint bg-ink-faint/10 border-ink-faint/20",
  reading:      "text-teal bg-teal/10 border-teal/25",
  thinking:     "text-teal bg-teal/10 border-teal/25",
  planning:     "text-teal bg-teal/10 border-teal/25",
  writing:      "text-teal bg-teal/10 border-teal/25",
  executing:    "text-teal bg-teal/10 border-teal/25",
  reviewing:    "text-teal bg-teal/10 border-teal/25",
  blocked:      "text-orange bg-orange/10 border-orange/25",
  "needs-human":"text-gold bg-gold/10 border-gold/25",
  done:         "text-green bg-green/10 border-green/25",
};

const STATUS_DOT: Record<string, string> = {
  idle:         "bg-ink-faint",
  reading:      "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  thinking:     "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  planning:     "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  writing:      "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  executing:    "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  reviewing:    "bg-teal shadow-[0_0_5px_var(--color-teal)]",
  blocked:      "bg-orange",
  "needs-human":"bg-gold shadow-[0_0_5px_rgba(251,191,36,0.5)]",
  done:         "bg-green",
};

const PROGRESS_WIDTH: Record<string, string> = {
  idle:         "0%",
  reading:      "15%",
  thinking:     "30%",
  planning:     "40%",
  writing:      "60%",
  executing:    "65%",
  reviewing:    "80%",
  blocked:      "50%",
  "needs-human":"50%",
  done:         "100%",
};

const ACTIVITY_TEXT: Record<string, string> = {
  idle:         "Waiting for new activity…",
  executing:    "Executing instruction…",
  writing:      "Drafting response…",
  thinking:     "Processing…",
  planning:     "Planning task…",
  reviewing:    "Reviewing…",
  reading:      "Reading context…",
  blocked:      "Blocked — needs attention",
  "needs-human":"Waiting for human input to continue",
  done:         "Task completed",
};

type Tab = "handoffs" | "activity";

type Props = {
  agent: Agent;
  agentIndex: number;
  onClose: () => void;
};

export function AgentSidePanel({ agent, agentIndex, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("activity");
  const [terminalOpen, setTerminalOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);

  const {
    instruction,
    handoffAgentId,
    handoffInstruction,
    terminalCommand,
    terminalLines,
    handoffCandidateList,
    messageList,
    streamingResponse,
    streamingStatus,
    isStreamingActive,
    instructionsDraft,
    isLoadingMessagesWithoutCache,
    isRunningInstruction,
    isUpdatingAgentStatus,
    isUpdatingInstructions,
    streamErrorMessage,
    setHandoffAgentId,
    setHandoffInstruction,
    setInstruction,
    setInstructionsDraft,
    setTerminalCommand,
    handleSaveInstructions,
    handleResumeAgent,
    handleRunTerminalCommand,
    handleSendInstruction,
    latestValidation,
    latestResponse,
    displayAgent,
  } = useAgentDetailPanel(agent);

  const isActive    = ["reading","thinking","planning","writing","executing","reviewing"].includes(displayAgent.status);
  const isWaiting   = displayAgent.status === "needs-human";
  const isBlocked   = displayAgent.status === "blocked";

  const statusColor = STATUS_COLOR[displayAgent.status] ?? STATUS_COLOR.idle;
  const statusDot   = STATUS_DOT[displayAgent.status]   ?? STATUS_DOT.idle;
  const progress    = PROGRESS_WIDTH[displayAgent.status] ?? "0%";
  const activityTxt = ACTIVITY_TEXT[displayAgent.status] ?? "In progress…";

  return (
    <div className="flex flex-col h-full bg-[var(--bg-sidebar)] border-l border-[var(--border-subtle)]">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 pt-4 pb-2.5 border-b border-[var(--border-subtle)]">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink-faint">
            Selected Agent
          </p>
          <button
            className="icon-only-button w-6 h-6 min-h-0 flex-shrink-0"
            onClick={onClose}
            aria-label="Close panel"
          >
            <X size={13} />
          </button>
        </div>

        <div className="flex items-center gap-3">
          {/* Avatar */}
          <div
            className="flex items-center justify-center w-11 h-11 rounded-xl text-[1.1rem] font-extrabold text-white/90 flex-shrink-0"
            style={{ background: ROLE_COLORS[agent.role] ?? "#45556c" }}
          >
            {agent.name.charAt(0).toUpperCase()}
          </div>

          {/* Identity */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[0.95rem] font-bold text-ink truncate">{agent.name}</span>
              <button
                className="icon-only-button w-5 h-5 min-h-0 flex-shrink-0"
                onClick={() => void navigator.clipboard.writeText(agent.id)}
                title="Copy ID"
                aria-label="Copy agent ID"
              >
                <Copy size={11} />
              </button>
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent("knowledge:navigate", { detail: `agent:${agent.id}` }),
                  );
                }}
                className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-wider text-ink-muted hover:bg-white/10"
                title="Abrir en Knowledge Graph"
              >
                Ver en grafo
              </button>
            </div>
            <span className="text-[0.72rem] text-ink-muted">{ROLE_DESCRIPTIONS[agent.role] ?? agent.role}</span>
          </div>
        </div>

        {/* Status row */}
        <div className="flex items-center gap-2 mt-2.5">
          <span className={cn("inline-flex items-center gap-1.5 h-6 border rounded-md px-2 text-[0.7rem] font-semibold", statusColor)}>
            <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", statusDot)} />
            {STATUS_LABELS[displayAgent.status] ?? displayAgent.status}
          </span>
          <span className="text-[0.68rem] text-ink-faint">ID: {agentIndex + 1}</span>

          {(isWaiting || isBlocked) && (
            <button
              className="ml-auto h-6 px-2.5 text-[0.7rem] border-gold/35 text-gold bg-gold/10 hover:bg-gold/20"
              onClick={handleResumeAgent}
              disabled={isUpdatingAgentStatus}
            >
              {isUpdatingAgentStatus ? "…" : "Resume"}
            </button>
          )}
        </div>
      </div>

      {/* ── Current task ───────────────────────────────────── */}
      <div className="flex-shrink-0 px-4 py-2.5 border-b border-[var(--border-subtle)]">
        <p className="text-[0.6rem] font-bold tracking-[0.12em] uppercase text-ink-faint mb-2">
          Current Task
        </p>
        {agent.currentTaskId ? (
          <>
            <div className="flex items-start justify-between gap-2 mb-1">
              <span className="text-[0.82rem] font-semibold text-ink leading-snug">
                Task: {agent.currentTaskId}
              </span>
            </div>
          </>
        ) : (
          <span className="text-[0.78rem] text-ink-faint">{activityTxt}</span>
        )}

        {/* Progress bar */}
        <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: progress,
              background: isBlocked
                ? "var(--color-orange)"
                : isWaiting
                  ? "var(--color-gold)"
                  : "linear-gradient(90deg, var(--color-teal), #06c98e)",
              boxShadow: isActive ? "0 0 8px rgba(16,242,170,0.4)" : "none",
            }}
          />
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex border-b border-[var(--border-subtle)]">
        {(["handoffs", "activity"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 h-9 text-[0.72rem] font-semibold tracking-[0.04em] uppercase border-b-2 transition-colors",
              activeTab === tab
                ? "text-purple border-purple bg-purple/[0.05]"
                : "text-ink-faint border-transparent hover:text-ink-muted bg-transparent",
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* ── Tab content ────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto min-h-[240px]">
        {latestValidation ? (
          <div className="px-4 pt-3">
            <ValidationSummary validation={latestValidation} />
          </div>
        ) : null}
        {activeTab === "handoffs" && (
          <div className="px-4 py-2.5 grid gap-2.5">
            {isLoadingMessagesWithoutCache ? (
              <p className="text-[0.75rem] text-ink-faint">Loading messages…</p>
            ) : messageList.length === 0 ? (
              <p className="text-[0.75rem] text-ink-faint">No handoffs yet.</p>
            ) : (
              messageList.slice(-12).map((msg) => (
                <div key={msg.id} className="grid gap-1">
                  <div className="flex items-center gap-2 text-[0.68rem] text-ink-muted">
                    <span className="font-semibold text-ink-accent capitalize">{msg.role}</span>
                    <ChevronRight size={11} className="text-ink-faint flex-shrink-0" />
                    <span className="text-ink truncate">{agent.name}</span>
                  </div>
                  <p className="text-[0.75rem] text-ink-muted leading-snug overflow-wrap-anywhere">
                    {msg.content}
                  </p>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "activity" && (
          <div className="px-4 py-2.5 grid gap-2">
            {/* Live status */}
            <div className="flex items-start gap-2">
              <span className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1", statusDot)} />
              <p className="text-[0.75rem] text-ink-muted leading-snug">{activityTxt}</p>
            </div>

            {/* Streaming output */}
            {isStreamingActive && (
              <div className="border border-teal/20 rounded-lg px-3 py-2 bg-teal/[0.03] mt-1">
                {streamingStatus !== "idle" && (
                  <p className="text-[0.65rem] font-bold tracking-[0.08em] uppercase text-teal mb-1">
                    {streamingStatus}
                  </p>
                )}
                <p className="text-[0.72rem] text-teal/80 whitespace-pre-wrap overflow-wrap-anywhere leading-relaxed">
                  {streamingResponse || "Waiting for agent output…"}
                </p>
              </div>
            )}

            {!isStreamingActive && latestResponse ? (
              <div className="border border-[var(--border-card)] rounded-lg px-3 py-2 bg-black/15 mt-1">
                <p className="text-[0.65rem] font-bold tracking-[0.08em] uppercase text-ink-faint mb-1">
                  Latest response
                </p>
                <p className="text-[0.72rem] text-ink-muted whitespace-pre-wrap overflow-wrap-anywhere leading-relaxed">
                  {latestResponse}
                </p>
              </div>
            ) : null}

            {streamErrorMessage && (
              <p className="text-[0.72rem] text-[#fca5a5] overflow-wrap-anywhere">{streamErrorMessage}</p>
            )}

            {/* Message history as activity feed */}
            {messageList.length > 0 && (
              <>
                <p className="text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink-faint mt-1">
                  Activity log
                </p>
                {messageList.slice(-8).reverse().map((msg) => (
                  <div key={msg.id} className="flex items-start gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-ink-faint flex-shrink-0 mt-1" />
                    <p className="text-[0.72rem] text-ink-muted leading-snug overflow-wrap-anywhere">
                      <span className="font-semibold text-ink-accent capitalize">{msg.role}:</span>{" "}
                      {msg.content.length > 120 ? msg.content.slice(0, 120) + "…" : msg.content}
                    </p>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Terminal (collapsible) ──────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)]">
        <button
          type="button"
          onClick={() => setTerminalOpen((v) => !v)}
          className="flex items-center gap-2 w-full px-4 py-2 text-[0.72rem] text-ink-faint bg-transparent border-transparent hover:text-ink-muted hover:bg-white/[0.02]"
        >
          <Terminal size={12} />
          <span>Agent Terminal</span>
          <ChevronRight
            size={12}
            className={cn("ml-auto transition-transform", terminalOpen && "rotate-90")}
          />
        </button>
        {terminalOpen && (
          <div className="px-3 pb-3 grid gap-1.5">
            <div className="min-h-[80px] max-h-[120px] overflow-y-auto border border-[var(--border-card)] rounded-lg p-2 bg-black/30 text-[0.68rem] font-mono">
              {terminalLines.length === 0 ? (
                <p className="text-ink-faint">terminal empty</p>
              ) : (
                terminalLines.slice(-12).map((line) => (
                  <p
                    key={line.id}
                    className={cn(
                      "leading-relaxed whitespace-pre-wrap overflow-wrap-anywhere",
                      line.tone === "error"   && "text-[#fca5a5]",
                      line.tone === "success" && "text-green",
                      line.tone === "info"    && "text-ink-muted",
                      line.tone === "muted"   && "text-ink-faint",
                    )}
                  >
                    {line.text}
                  </p>
                ))
              )}
            </div>
            <div className="grid grid-cols-[1fr_auto] gap-1.5">
              <input
                className="h-7 text-[0.72rem] font-mono"
                value={terminalCommand}
                onChange={(e) => setTerminalCommand(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleRunTerminalCommand()}
                placeholder="run <instruction>"
              />
              <button
                className="h-7 px-2.5 text-[0.72rem]"
                onClick={handleRunTerminalCommand}
              >
                Run
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Instructions ───────────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-2.5">
        <button
          type="button"
          onClick={() => setInstructionsOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink-faint hover:text-ink-muted"
        >
          <span>Instructions</span>
          <ChevronRight size={11} className={cn("ml-auto transition-transform", instructionsOpen && "rotate-90")} />
        </button>
        {instructionsOpen && (
          <div className="mt-2 grid gap-1.5">
            <textarea
              className="w-full h-14 border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-[0.74rem] bg-black/20 text-ink resize-none outline-none focus:border-purple leading-relaxed"
              placeholder="Persistent agent instructions…"
              value={instructionsDraft}
              onChange={(e) => setInstructionsDraft(e.target.value)}
            />
            <button
              type="button"
              className="w-full h-7 text-[0.72rem] border-teal/30 text-teal bg-teal/[0.07] hover:bg-teal/[0.12]"
              onClick={handleSaveInstructions}
              disabled={isUpdatingInstructions}
            >
              {isUpdatingInstructions ? "Saving…" : "Save instructions"}
            </button>
          </div>
        )}
      </div>

      {/* ── Message composer ───────────────────────────────── */}
      <div className="flex-shrink-0 border-t border-[var(--border-subtle)] px-4 py-2.5">
        <button
          type="button"
          onClick={() => setComposerOpen((v) => !v)}
          className="flex items-center gap-2 w-full text-[0.6rem] font-bold tracking-[0.1em] uppercase text-ink-faint hover:text-ink-muted"
        >
          <span>Send message to {agent.name}</span>
          <ChevronRight size={11} className={cn("ml-auto transition-transform", composerOpen && "rotate-90")} />
        </button>
        {composerOpen && (
          <div className="mt-2">
            <textarea
              className="w-full h-[64px] border border-[var(--border-card)] rounded-lg px-2.5 py-2 text-[0.78rem] bg-[var(--bg-input)] text-ink resize-none outline-none focus:border-purple placeholder:text-ink-faint leading-relaxed"
              placeholder="Write a message or instruction…"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSendInstruction();
              }}
            />
            <div className="grid grid-cols-[1fr_auto] gap-2 mt-2">
              <select
                className="h-8 text-[0.78rem]"
                value={handoffAgentId}
                onChange={(e) => setHandoffAgentId(e.target.value)}
                aria-label="Handoff target"
              >
                <option value="">No handoff</option>
                {handoffCandidateList.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.role})</option>
                ))}
              </select>
              <button
                type="button"
                className="btn-primary h-8 px-4 text-[0.8rem]"
                onClick={handleSendInstruction}
                disabled={!instruction.trim() || isRunningInstruction || isUpdatingAgentStatus}
                aria-label="Send message"
              >
                <Send size={13} />
                Send
              </button>
            </div>
            {handoffAgentId && (
              <input
                className="w-full h-8 mt-1.5 text-[0.78rem]"
                placeholder="Handoff instruction for next agent…"
                value={handoffInstruction}
                onChange={(e) => setHandoffInstruction(e.target.value)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
