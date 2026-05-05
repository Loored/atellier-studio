import { useMemo, useState } from "react";
import { ORCHESTRATION_SKILL_IDS, type OrchestrationSkillId } from "@atellier/shared";
import {
  useOrchestrationSkillsApi,
  useStartSkillOrchestrationApi,
} from "../../../api/hooks/orchestrations/useOrchestrationsApi";

export function useSkillOrchestrationPanel() {
  const {
    data: orchestrationSkillList = [],
    isFetching: isFetchingOrchestrationSkills,
    isLoadingWithoutCache: isLoadingOrchestrationSkillsWithoutCache,
  } = useOrchestrationSkillsApi();
  const startSkillOrchestration = useStartSkillOrchestrationApi();

  const [selectedSkillId, setSelectedSkillId] =
    useState<OrchestrationSkillId>(ORCHESTRATION_SKILL_IDS[0]);
  const [goal, setGoal] = useState("");
  const [context, setContext] = useState("");

  const selectedSkill = useMemo(
    () => orchestrationSkillList.find((skill) => skill.id === selectedSkillId) ?? orchestrationSkillList[0],
    [orchestrationSkillList, selectedSkillId],
  );

  function handleStartOrchestration() {
    const trimmedGoal = goal.trim();
    if (!selectedSkill || !trimmedGoal) {
      return;
    }

    startSkillOrchestration.mutate(
      {
        skillId: selectedSkill.id,
        goal: trimmedGoal,
        context: context.trim() || undefined,
      },
      {
        onSuccess: () => {
          setGoal("");
          setContext("");
        },
      },
    );
  }

  return {
    orchestrationSkillList,
    selectedSkill,
    selectedSkillId,
    goal,
    context,
    isFetchingOrchestrationSkills,
    isLoadingOrchestrationSkillsWithoutCache,
    isStartingOrchestration: startSkillOrchestration.isPending,
    orchestrationErrorMessage: startSkillOrchestration.error?.message,
    setSelectedSkillId,
    setGoal,
    setContext,
    handleStartOrchestration,
  };
}
