import { useEffect, useRef } from "react";
import type { Agent } from "@atellier/shared";
import { useRunAgentApi } from "../../../api/hooks/agents/useAgentsApi";

const ROLE_INSTRUCTIONS: Record<Agent["role"], string> = {
  intake: "Review inbox context and summarize the next required intake action.",
  "wiki-curator": "Update operational memory notes from latest completed runs.",
  pm: "Plan the next execution step and identify dependencies or blockers.",
  builder: "Execute the next build task and report concrete progress.",
  qa: "Review recent output and list quality risks and verification checks.",
  designer: "Draft a concise design direction for the active task.",
};

export function useOrchestrationLive(agents: Agent[], enabled: boolean) {
  const runAgent = useRunAgentApi();
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const tick = () => {
      if (runAgent.isPending) {
        return;
      }

      const eligibleAgents = agents.filter((agent) => agent.status === "idle" || agent.status === "done");
      if (eligibleAgents.length === 0) {
        return;
      }

      const nextAgent = eligibleAgents[Math.floor(Math.random() * eligibleAgents.length)];
      runAgent.mutate({
        agentId: nextAgent.id,
        input: {
          instruction: ROLE_INSTRUCTIONS[nextAgent.role],
          context: "Triggered by live orchestration mode in office view.",
        },
      });
    };

    tick();
    timerRef.current = setInterval(tick, 20_000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, agents, runAgent]);
}
