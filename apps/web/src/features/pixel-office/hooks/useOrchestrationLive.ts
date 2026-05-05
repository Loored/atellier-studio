import { useEffect, useRef } from "react";
import type { Agent, AgentRole } from "@atellier/shared";
// Use streaming so the agent visually stays in "executing" state during the OpenAI call,
// making sprites animate at their work zones while the run is in progress.
import { useRunAgentStreamApi } from "../../../api/hooks/agents/useAgentsApi";

// Natural team flow: after role X completes, trigger role Y next.
const FLOW_NEXT: Partial<Record<AgentRole, AgentRole>> = {
  intake:         "wiki-curator",
  pm:             "builder",
  designer:       "builder",
  builder:        "qa",
  qa:             "wiki-curator",
  "wiki-curator": "pm",
};

// Kickoff priority when no flow signal is present.
const KICKOFF_PRIORITY: AgentRole[] = ["pm", "intake", "builder", "qa", "designer", "wiki-curator"];

// Auto-trigger wiki-curator after this many team completions.
const WIKI_AUTO_TRIGGER_AFTER = 4;

// How often to check for the next action (ms). Short so the flow feels live.
const TICK_INTERVAL_MS = 3_000;

// Contextual instructions per role. prevRole is who handed off to them.
const FLOW_INSTRUCTIONS: Record<AgentRole, (prevRole?: AgentRole) => string> = {
  pm: (prev) =>
    prev
      ? `The ${prev} agent just completed their work. Review the session goals, inspect any open tasks, and produce the next execution plan with scope, acceptance criteria, and explicit handoff target.`
      : "Review pending tasks and session goals. Produce the next execution plan: scope the smallest valuable slice, define acceptance criteria, identify who executes next.",

  builder: (prev) =>
    prev === "pm"
      ? "The PM has completed planning. Implement the plan: identify target files, describe the implementation path, flag any blockers, and hand off to QA when ready."
      : prev === "designer"
      ? "The designer has completed a design brief. Implement the described UI changes following existing component patterns. Hand off to QA when done."
      : "Review the active plan and implement the next task. Identify the implementation path, report blockers explicitly, and hand off to QA when done.",

  qa: (_prev) =>
    "The builder has completed their work. Review the implementation output against the PM's acceptance criteria. Return APPROVED if criteria are met, or a numbered defect list if not.",

  designer: (prev) =>
    prev === "pm"
      ? "The PM has completed planning. Create a design brief for the builder: specify which component patterns to use, layout decisions, interaction model, and color/token choices."
      : "Review requirements and create a design brief. Specify component patterns, layout, interactions, and any risk notes for the builder.",

  "wiki-curator": (prev) =>
    prev
      ? `The ${prev} agent just completed their work. Update operational memory: summarize completed work, file decision records, update relevant wiki pages, and append a timestamped log entry.`
      : "Review recent completed runs and update operational memory. File decision records, update process notes and entity pages, and append a session summary to the wiki log.",

  intake: (_prev) =>
    "Process the latest incoming source or context. Extract key facts, identify implied tasks, and prepare a structured handoff summary for the wiki-curator.",
};

export function useOrchestrationLive(agents: Agent[], enabled: boolean) {
  // Keep mutable refs so the interval always reads fresh data.
  const agentsRef    = useRef(agents);
  const enabledRef   = useRef(enabled);
  useEffect(() => { agentsRef.current = agents; }, [agents]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  // Flow state — persists within a live session.
  const lastCompletedRoleRef    = useRef<AgentRole | null>(null);
  const completionCountRef      = useRef(0);
  const wikiLastTriggerCountRef = useRef(0);
  const timerRef                = useRef<ReturnType<typeof setInterval> | null>(null);

  // Use streaming so the agent stays in "executing" state during the OpenAI call —
  // this makes sprites visually animate at their work zones.
  // onSuccess fires when the stream closes (run complete). We look up the role from
  // agentsRef since the stream result is void, not RunAgentResult.
  const runAgent = useRunAgentStreamApi({
    onSuccess: (_result, variables) => {
      const agent = agentsRef.current.find((a) => a.id === variables.agentId);
      if (agent) {
        lastCompletedRoleRef.current = agent.role;
        completionCountRef.current  += 1;
      }
    },
  });
  const runAgentRef = useRef(runAgent);
  useEffect(() => { runAgentRef.current = runAgent; }, [runAgent]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      // Reset flow state for a clean next session.
      lastCompletedRoleRef.current    = null;
      completionCountRef.current      = 0;
      wikiLastTriggerCountRef.current = 0;
      return;
    }

    const tick = () => {
      const ra = runAgentRef.current;
      if (ra.isPending) return;
      if (!enabledRef.current) return;

      const allAgents = agentsRef.current;
      // In live mode, needs-human agents re-enter the cycle automatically —
      // the orchestration acts as the authorizing operator.
      // Only blocked agents are excluded (they need explicit human intervention).
      const available = allAgents.filter(
        (a) =>
          a.status === "idle" ||
          a.status === "done" ||
          a.status === "needs-human",
      );
      if (available.length === 0) return;

      const byRole = (role: AgentRole) => available.find((a) => a.role === role);

      // ── 1. Auto-trigger wiki-curator every WIKI_AUTO_TRIGGER_AFTER completions ──
      const completions = completionCountRef.current;
      if (
        completions > 0 &&
        completions - wikiLastTriggerCountRef.current >= WIKI_AUTO_TRIGGER_AFTER
      ) {
        const wiki = byRole("wiki-curator");
        if (wiki) {
          wikiLastTriggerCountRef.current = completions;
          lastCompletedRoleRef.current    = null;
          ra.mutate({
            agentId: wiki.id,
            input: {
              instruction: FLOW_INSTRUCTIONS["wiki-curator"](),
              context: `Auto-triggered after ${completions} team completions. Update operational memory.`,
              recordDeliverable: false,
            },
            onEvent: () => {},
          });
          return;
        }
      }

      // ── 2. Flow continuation — trigger the natural next role ─────────────
      const prevRole = lastCompletedRoleRef.current;
      if (prevRole) {
        const nextRole = FLOW_NEXT[prevRole];
        if (nextRole) {
          const nextAgent = byRole(nextRole);
          if (nextAgent) {
            lastCompletedRoleRef.current = null;
            ra.mutate({
              agentId: nextAgent.id,
              input: {
                instruction: FLOW_INSTRUCTIONS[nextRole](prevRole),
                context: `Handoff from ${prevRole}. Continue the team work cycle.`,
                recordDeliverable: false,
              },
              onEvent: () => {},
            });
            return;
          }
        }
        // Next role agent not available — clear so we don't block indefinitely.
        lastCompletedRoleRef.current = null;
      }

      // ── 3. Kickoff — no flow signal, pick highest-priority idle role ──────
      for (const role of KICKOFF_PRIORITY) {
        const agent = byRole(role);
        if (agent) {
          ra.mutate({
            agentId: agent.id,
            input: {
              instruction: FLOW_INSTRUCTIONS[role](),
              context: "Live orchestration cycle starting.",
              recordDeliverable: false,
            },
            onEvent: () => {},
          });
          return;
        }
      }
    };

    tick();
    timerRef.current = setInterval(tick, TICK_INTERVAL_MS);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  // Only re-run when the user toggles live mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
