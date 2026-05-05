import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ORCHESTRATION_SKILL_IDS, type OrchestrationSkillId } from "@atellier/shared";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";
import {
  useOrchestrationSkillsApi,
  useOrchestrationStatusApi,
  useStartSkillOrchestrationApi,
} from "../../../api/hooks/orchestrations/useOrchestrationsApi";
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
  const [mode, setMode] = useState<Mode>("form");
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const invalidatedRef = useRef(false);
  const { data: healthStatus } = useHealthApi();

  const startSkillOrchestration = useStartSkillOrchestrationApi();
  const { data: liveStatus } = useOrchestrationStatusApi(activeRunId);
  const isOpenAiExecution = healthStatus?.executorMode === "openai";
  const executorModel = healthStatus?.executorModel ?? "unknown";
  const modelProfile = healthStatus?.modelProfile ?? "standard";

  const selectedSkill = useMemo(
    () => orchestrationSkillList.find((s) => s.id === selectedSkillId) ?? orchestrationSkillList[0],
    [orchestrationSkillList, selectedSkillId],
  );

  useEffect(() => {
    if (!liveStatus || invalidatedRef.current) return;
    if (liveStatus.status === "completed" || liveStatus.status === "failed") {
      invalidatedRef.current = true;
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.agents.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
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
      { skillId: selectedSkill.id, goal: trimmedGoal, context: context.trim() || undefined },
      {
        onSuccess: (result) => {
          invalidatedRef.current = false;
          setActiveRunId(result.runId);
          setMode("live");
          setGoal("");
          setContext("");
        },
      },
    );
  }

  function resetToForm() {
    setMode("form");
    setActiveRunId(null);
    invalidatedRef.current = false;
  }

  return {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    mode,
    liveStatus,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    isFetchingOrchestrationSkills,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration: startSkillOrchestration.isPending,
    orchestrationErrorMessage: startSkillOrchestration.error?.message,
    setSelectedSkillId,
    setGoal,
    setContext,
    handleStartOrchestration,
    resetToForm,
  };
}
