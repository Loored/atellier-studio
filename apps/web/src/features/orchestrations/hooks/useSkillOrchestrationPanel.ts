import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ORCHESTRATION_SKILL_IDS, type ExecutorMode, type OrchestrationSkillId } from "@atellier/shared";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";
import {
  useOrchestrationSkillsApi,
  useOrchestrationStatusApi,
  useStartSkillOrchestrationApi,
} from "../../../api/hooks/orchestrations/useOrchestrationsApi";
import {
  useActiveOrchestrationsApi,
  useCancelRunApi,
  useRetryRunApi,
  useRunEventsApi,
} from "../../../api/hooks/runs/useRunsApi";
import { queryKeys } from "../../../api/query/queryKeys";

type Mode = "form" | "live";

export function useSkillOrchestrationPanel() {
  const queryClient = useQueryClient();

  const {
    data: orchestrationSkillList = [],
    isFetching: isFetchingOrchestrationSkills,
    isLoadingWithoutCache: isLoadingOrchestrationSkillsWithoutCache,
  } = useOrchestrationSkillsApi();

  const [selectedSkillId, setSelectedSkillId] = useState<OrchestrationSkillId>(ORCHESTRATION_SKILL_IDS[0]);
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");
  const [executorModeOverride, setExecutorModeOverride] = useState<ExecutorMode | "">("");
  const [mode, setMode] = useState<Mode>("form");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const invalidatedRef = useRef(false);
  const dismissedRunIdRef = useRef<string | null>(null);
  const { data: healthStatus } = useHealthApi();

  const startSkillOrchestration = useStartSkillOrchestrationApi();
  const cancelRun = useCancelRunApi();
  const retryRun = useRetryRunApi();
  const { data: activeOrchestrationRuns = [] } = useActiveOrchestrationsApi();
  const { data: liveStatus } = useOrchestrationStatusApi(activeRunId);
  const isTerminal = liveStatus
    ? ["completed", "failed", "blocked", "cancelled"].includes(liveStatus.status)
    : false;
  const { data: runEventsResponse } = useRunEventsApi(activeRunId, !isTerminal);
  const isOpenAiExecution = healthStatus?.executorMode === "openai";
  const executorModel = healthStatus?.executorModel ?? "unknown";
  const modelProfile = healthStatus?.modelProfile ?? "standard";
  const availableExecutorModes: ExecutorMode[] = healthStatus?.availableExecutorModes
    ?? [healthStatus?.executorMode ?? "mock"];

  const selectedSkill = useMemo(
    () => orchestrationSkillList.find((s) => s.id === selectedSkillId) ?? orchestrationSkillList[0],
    [orchestrationSkillList, selectedSkillId],
  );

  useEffect(() => {
    if (activeRunId || activeOrchestrationRuns.length === 0) return;
    const recoverableRun = activeOrchestrationRuns.find((run) => run.id !== dismissedRunIdRef.current);
    if (!recoverableRun) return;
    invalidatedRef.current = false;
    setActiveRunId(recoverableRun.id);
    setMode("live");
  }, [activeOrchestrationRuns, activeRunId]);

  useEffect(() => {
    if (!liveStatus || invalidatedRef.current) return;
    if (["completed", "failed", "blocked", "cancelled"].includes(liveStatus.status)) {
      invalidatedRef.current = true;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.runs.activeOrchestrations }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
        queryClient.invalidateQueries({ queryKey: queryKeys.wiki.page("wiki/deliverables/index.md") }),
      ]);
    }
  }, [liveStatus?.status, queryClient]);

  function handleStartOrchestration() {
    const trimmedGoal = goal.trim();
    if (!selectedSkill || !trimmedGoal) return;
    if (isOpenAiExecution) {
      const confirmed = window.confirm(
        `OpenAI execution is active (${executorModel}, ${modelProfile}). Starting this orchestration may consume tokens. Continue?`,
      );
      if (!confirmed) return;
    }

    startSkillOrchestration.mutate(
      {
        skillId: selectedSkill.id,
        goal: trimmedGoal,
        context: context.trim() || undefined,
        executorModeOverride: executorModeOverride || undefined,
      },
      {
        onSuccess: (result) => {
          invalidatedRef.current = false;
          dismissedRunIdRef.current = null;
          setActiveRunId(result.runId);
          setMode("live");
          setGoal("");
          setContext("");
          setExecutorModeOverride("");
        },
      },
    );
  }

  function resetToForm() {
    dismissedRunIdRef.current = activeRunId;
    setMode("form");
    setActiveRunId(null);
    invalidatedRef.current = false;
  }

  function handleCancelRun() {
    if (!activeRunId) return;
    cancelRun.mutate({ runId: activeRunId });
  }

  function handleRetryRun() {
    if (!activeRunId) return;
    invalidatedRef.current = false;
    retryRun.mutate({ runId: activeRunId });
  }

  return {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    mode,
    liveStatus,
    runEvents: runEventsResponse?.events ?? [],
    isOpenAiExecution,
    executorModel,
    modelProfile,
    executorModeOverride,
    availableExecutorModes,
    isFetchingOrchestrationSkills,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration: startSkillOrchestration.isPending,
    isCancellingRun: cancelRun.isPending,
    isRetryingRun: retryRun.isPending,
    orchestrationErrorMessage: startSkillOrchestration.error?.message,
    setSelectedSkillId,
    setGoal,
    setContext,
    setExecutorModeOverride,
    handleStartOrchestration,
    handleCancelRun,
    handleRetryRun,
    resetToForm,
  };
}
