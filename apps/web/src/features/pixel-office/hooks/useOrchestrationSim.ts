import { useEffect, useRef } from "react";
import type { Agent } from "@atellier/shared";
import { useUpdateAgentStatusApi } from "../../../api/hooks/agents/useAgentsApi";

const WORKING_STATUSES = ["executing", "thinking", "planning", "writing", "reviewing", "reading"] as const;

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function useOrchestrationSim(agents: Agent[], enabled: boolean) {
  const updateStatus = useUpdateAgentStatusApi();
  const activeTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  useEffect(() => {
    if (!enabled || agents.length === 0) return;

    // Clear all timers on cleanup
    return () => {
      activeTimers.current.forEach(clearTimeout);
      activeTimers.current.clear();
    };
  }, [enabled, agents.length]);

  useEffect(() => {
    if (!enabled || agents.length < 2) return;

    // Run an orchestration chain
    const runChain = () => {
      const idleAgents = agents.filter(a => a.status === "idle");
      if (idleAgents.length === 0) return;

      // Pick 2-3 agents to form a chain
      const shuffled = [...idleAgents].sort(() => Math.random() - 0.5);
      const chain = shuffled.slice(0, Math.min(3, shuffled.length));

      let delay = 0;
      chain.forEach((_agent, idx) => {
        const agent = chain[idx];
        const startT = setTimeout(() => {
          const status = pickRandom(WORKING_STATUSES);
          updateStatus.mutate({ agentId: agent.id, input: { status } });
        }, delay);
        activeTimers.current.add(startT);

        delay += 3000 + Math.random() * 5000; // each agent works 3-8s

        const endT = setTimeout(() => {
          updateStatus.mutate({ agentId: agent.id, input: { status: "idle" } });
          activeTimers.current.delete(endT);
        }, delay);
        activeTimers.current.add(endT);

        delay += 500; // small gap between agents in chain
      });
    };

    // Run after initial delay then on interval
    const immediateT = setTimeout(runChain, 3000);
    const interval = setInterval(runChain, 15000);

    return () => {
      clearTimeout(immediateT);
      clearInterval(interval);
      activeTimers.current.forEach(clearTimeout);
      activeTimers.current.clear();
    };
  }, [enabled, agents, updateStatus]);
}
