import { useEffect, useState } from "react";
import { AGENT_STATUSES, type AgentRunStreamEvent } from "@atellier/shared";
import type { Agent, ExecutorMode, Run, RunAgentResult } from "@atellier/shared";
import {
  useAgentMessagesApi,
  useAgentsApi,
  useRunAgentStreamApi,
  useUpdateAgentInstructionsApi,
  useUpdateAgentStatusApi,
} from "../../../api/hooks/agents/useAgentsApi";
import { useRunsApi } from "../../../api/hooks/runs/useRunsApi";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";

type TerminalLineTone = "info" | "success" | "error" | "muted";

type TerminalLine = {
  id: number;
  tone: TerminalLineTone;
  text: string;
};

export function useAgentDetailPanel(agent: Agent) {
  const [instruction, setInstruction] = useState("");
  const [handoffAgentId, setHandoffAgentId] = useState("");
  const [handoffInstruction, setHandoffInstruction] = useState("");
  const [isTerminalOpen, setIsTerminalOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState("");
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([]);
  const [streamingResponse, setStreamingResponse] = useState("");
  const [streamingStatus, setStreamingStatus] = useState<"idle" | "queued" | "running" | "finalizing">("idle");
  const [executorModeOverride, setExecutorModeOverride] = useState<ExecutorMode | "">("");
  const [latestStreamResult, setLatestStreamResult] = useState<RunAgentResult | null>(null);
  const [instructionsDraft, setInstructionsDraft] = useState(agent.instructions ?? "");
  const runAgentStream = useRunAgentStreamApi();
  const updateAgentStatus = useUpdateAgentStatusApi();
  const updateAgentInstructions = useUpdateAgentInstructionsApi();
  const { data: agentList = [] } = useAgentsApi();
  const { data: runList = [] } = useRunsApi();
  const { data: healthStatus } = useHealthApi();
  const availableExecutorModes: ExecutorMode[] = healthStatus?.availableExecutorModes
    ?? [healthStatus?.executorMode ?? "mock"];
  const handoffCandidateList = agentList.filter((candidate) => candidate.id !== agent.id);
  const {
    data: messageList = [],
    isFetching: isFetchingMessages,
    isLoadingWithoutCache: isLoadingMessagesWithoutCache,
  } = useAgentMessagesApi(agent.id);
  const latestRun = latestStreamResult?.run ?? findLatestRun(runList, agent.lastRunId);
  const latestValidation = streamingStatus === "idle" ? readRunValidation(latestRun) : null;
  const latestResponse = latestStreamResult?.assistantMessage.content ?? "";
  const displayAgent = latestStreamResult?.agent ?? agent;

  useEffect(() => {
    setInstructionsDraft(agent.instructions ?? "");
  }, [agent.id, agent.instructions]);

  function pushTerminalLine(text: string, tone: TerminalLineTone = "info") {
    setTerminalLines((current) => [
      ...current,
      {
        id: Date.now() + current.length,
        tone,
        text,
      },
    ]);
  }

  function ensureTerminalBoot() {
    setTerminalLines((current) => {
      if (current.length > 0) {
        return current;
      }

      return [
        {
          id: Date.now(),
          tone: "muted",
          text: "agent-terminal ready. commands: help, status, unblock, clear, run <instruction>, set-status <status>, handoff <agent> :: <instruction>",
        },
      ];
    });
  }

  function handleToggleTerminal() {
    setIsTerminalOpen((current) => {
      const next = !current;
      if (next) {
        ensureTerminalBoot();
      }
      return next;
    });
  }

  function runInstruction(instructionText: string, options?: { handoffTo?: string; handoffNote?: string }) {
    const trimmedInstruction = instructionText.trim();
    if (!trimmedInstruction) {
      return;
    }

    runAgentStream.reset();
    setStreamingResponse("");
    setStreamingStatus("queued");
    setLatestStreamResult(null);

    runAgentStream.mutate(
      {
        agentId: agent.id,
        input: {
          instruction: trimmedInstruction,
          executorModeOverride: executorModeOverride || undefined,
          handoffAgentId: options?.handoffTo || handoffAgentId || undefined,
          handoffInstruction: options?.handoffNote || handoffInstruction.trim() || undefined,
        },
        onEvent: (event: AgentRunStreamEvent) => {
          if (event.type === "status") {
            setStreamingStatus(event.status);
            return;
          }
          if (event.type === "chunk") {
            setStreamingResponse((current) => current + event.content);
            return;
          }
          if (event.type === "result") {
            setLatestStreamResult(event.result);
            setStreamingStatus("idle");
            setStreamingResponse("");
            return;
          }
          if (event.type === "error") {
            setStreamingStatus("idle");
          }
        },
      },
      {
        onSuccess: () => {
          setInstruction("");
          setHandoffInstruction("");
          pushTerminalLine("run completed", "success");
          setStreamingStatus("idle");
          setStreamingResponse("");
        },
        onError: (error) => {
          pushTerminalLine(`run error: ${error.message}`, "error");
          setStreamingStatus("idle");
        },
      },
    );
  }

  function handleSendInstruction() {
    runInstruction(instruction);
  }

  function handleResumeAgent() {
    runAgentStream.reset();
    updateAgentStatus.mutate(
      {
        agentId: agent.id,
        input: {
          status: "idle",
        },
      },
      {
        onSuccess: () => {
          pushTerminalLine("agent status set to idle", "success");
        },
        onError: (error) => {
          pushTerminalLine(`status update error: ${error.message}`, "error");
        },
      },
    );
  }

  function handleSetAgentStatus(status: Agent["status"]) {
    runAgentStream.reset();
    updateAgentStatus.mutate(
      {
        agentId: agent.id,
        input: {
          status,
        },
      },
      {
        onSuccess: () => {
          pushTerminalLine(`agent status set to ${status}`, "success");
        },
        onError: (error) => {
          pushTerminalLine(`status update error: ${error.message}`, "error");
        },
      },
    );
  }

  function handleSaveInstructions() {
    updateAgentInstructions.mutate(
      {
        agentId: agent.id,
        input: { instructions: instructionsDraft.trim() },
      },
      {
        onSuccess: () => {
          pushTerminalLine("agent instructions updated", "success");
        },
        onError: (error) => {
          pushTerminalLine(`instructions update error: ${error.message}`, "error");
        },
      },
    );
  }

  function handleRunTerminalCommand() {
    const raw = terminalCommand.trim();
    if (!raw) {
      return;
    }

    setTerminalCommand("");
    pushTerminalLine(`> ${raw}`, "muted");

    const lower = raw.toLowerCase();
    if (lower === "help") {
      pushTerminalLine(
        "help | status | unblock | clear | run <instruction> | set-status <status> | handoff <agent> :: <instruction>",
        "info",
      );
      return;
    }

    if (lower === "status") {
      pushTerminalLine(`status=${agent.status} lastRunId=${agent.lastRunId ?? "none"}`, "info");
      return;
    }

    if (lower === "unblock" || lower === "resume") {
      handleResumeAgent();
      return;
    }

    if (lower === "clear") {
      setTerminalLines([]);
      return;
    }

    if (lower.startsWith("run ")) {
      const commandInstruction = raw.slice(4).trim();
      if (!commandInstruction) {
        pushTerminalLine("usage: run <instruction>", "error");
        return;
      }
      runInstruction(commandInstruction);
      return;
    }

    if (lower.startsWith("set-status ")) {
      const value = raw.slice("set-status ".length).trim();
      const status = AGENT_STATUSES.find((candidate) => candidate === value);
      if (!status) {
        pushTerminalLine(`invalid status: ${value}`, "error");
        return;
      }
      handleSetAgentStatus(status);
      return;
    }

    if (lower.startsWith("handoff ")) {
      const payload = raw.slice("handoff ".length);
      const separatorIndex = payload.indexOf("::");
      if (separatorIndex < 0) {
        pushTerminalLine("usage: handoff <agent-name-or-id> :: <instruction>", "error");
        return;
      }

      const targetText = payload.slice(0, separatorIndex).trim();
      const handoffText = payload.slice(separatorIndex + 2).trim();
      if (!targetText || !handoffText) {
        pushTerminalLine("usage: handoff <agent-name-or-id> :: <instruction>", "error");
        return;
      }

      const normalizedTarget = targetText.toLowerCase();
      const targetAgent = handoffCandidateList.find((candidate) => {
        if (candidate.id.toLowerCase() === normalizedTarget) {
          return true;
        }
        return candidate.name.toLowerCase().includes(normalizedTarget);
      });

      if (!targetAgent) {
        pushTerminalLine(`handoff target not found: ${targetText}`, "error");
        return;
      }

      runInstruction(instruction || "Continue with delegated handoff.", {
        handoffTo: targetAgent.id,
        handoffNote: handoffText,
      });
      pushTerminalLine(`handoff queued -> ${targetAgent.name}`, "success");
      return;
    }

    pushTerminalLine(`unknown command: ${raw}`, "error");
  }

  return {
    handoffAgentId,
    handoffInstruction,
    instruction,
    isTerminalOpen,
    terminalCommand,
    terminalLines,
    handoffCandidateList,
    messageList,
    streamingResponse,
    streamingStatus,
    isStreamingActive: streamingStatus !== "idle" || runAgentStream.isPending,
    instructionsDraft,
    isFetchingMessages,
    isLoadingMessagesWithoutCache,
    streamErrorMessage: runAgentStream.error?.message,
    isRunningInstruction: runAgentStream.isPending,
    isUpdatingAgentStatus: updateAgentStatus.isPending,
    isUpdatingInstructions: updateAgentInstructions.isPending,
    setHandoffAgentId,
    setHandoffInstruction,
    setInstruction,
    setExecutorModeOverride,
    setInstructionsDraft,
    setTerminalCommand,
    handleSaveInstructions,
    handleResumeAgent,
    handleRunTerminalCommand,
    handleSendInstruction,
    handleToggleTerminal,
    executorModeOverride,
    availableExecutorModes,
    latestRun,
    latestValidation,
    latestResponse,
    displayAgent,
  };
}

function findLatestRun(runList: Run[], lastRunId?: string): Run | null {
  if (!lastRunId) {
    return null;
  }
  return runList.find((run) => run.id === lastRunId) ?? null;
}

function readRunValidation(run: Run | null) {
  const output = run?.output as
    | {
        validation?: {
          role?: string;
          passed?: boolean;
          issues?: Array<{ code?: string; message?: string; severity?: string }>;
          verifiedRepoFiles?: string[];
          invalidReferencedFiles?: string[];
          referencedFiles?: string[];
          candidateFiles?: string[];
          changedFiles?: string[];
        };
      }
    | undefined;

  return output?.validation ?? null;
}
