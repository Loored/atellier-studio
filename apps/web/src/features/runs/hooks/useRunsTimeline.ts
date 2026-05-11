import { type FormEvent, useState } from "react";
import type { RunReviewStatus } from "@atellier/shared";
import { useAgentsApi } from "../../../api/hooks/agents/useAgentsApi";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";
import {
  useAppendRunLogApi,
  useCaptureRunMemoryApi,
  useCompleteRunApi,
  useCreateRunApi,
  usePromoteRunDeliverableApi,
  useRunsApi,
  useUnlinkRunDeliverableApi,
  useUpdateRunReviewApi,
} from "../../../api/hooks/runs/useRunsApi";

export function useRunsTimeline() {
  const {
    data: runList = [],
    isFetching: isFetchingRuns,
    isLoadingWithoutCache: isLoadingRunsWithoutCache,
  } = useRunsApi();
  const { data: agentList = [] } = useAgentsApi();
  const { data: healthStatus } = useHealthApi();
  const createRun = useCreateRunApi();
  const appendRunLog = useAppendRunLogApi();
  const completeRun = useCompleteRunApi();
  const updateRunReview = useUpdateRunReviewApi();
  const promoteRunDeliverable = usePromoteRunDeliverableApi();
  const unlinkRunDeliverable = useUnlinkRunDeliverableApi();
  const captureRunMemory = useCaptureRunMemoryApi();
  const [runLogMessages, setRunLogMessages] = useState<Record<string, string>>({});
  const [agentFilter, setAgentFilter] = useState<"all" | "needs-human" | "blocked">("all");
  const [reviewFilter, setReviewFilter] = useState<"all" | RunReviewStatus>("all");
  const isOpenAiExecution = healthStatus?.executorMode === "openai";
  const executorModel = healthStatus?.executorModel ?? "unknown";
  const modelProfile = healthStatus?.modelProfile ?? "standard";

  const filteredRunList = runList.filter((run) => {
    const relatedAgent = run.agentId ? agentList.find((agent) => agent.id === run.agentId) : undefined;
    const agentMatches =
      agentFilter === "all" ? true : relatedAgent?.status === agentFilter;
    const reviewMatches =
      reviewFilter === "all" ? true : run.reviewStatus === reviewFilter;
    return agentMatches && reviewMatches;
  });

  const deliverableRuns = runList.filter((run) => Boolean(run.deliverablePath));

  function setRunLogMessage(runId: string, message: string) {
    setRunLogMessages((current) => ({
      ...current,
      [runId]: message,
    }));
  }

  function handleAppendRunLog(event: FormEvent<HTMLFormElement>, runId: string) {
    event.preventDefault();

    const message = runLogMessages[runId]?.trim();
    if (!message) {
      return;
    }

    appendRunLog.mutate(
      {
        runId,
        input: {
          level: "info",
          message,
        },
      },
      {
        onSuccess: () =>
          setRunLogMessages((current) => ({
            ...current,
            [runId]: "",
          })),
      },
    );
  }

  function handleUnlinkRunDeliverable(runId: string) {
    const confirmed = window.confirm("Unlink this deliverable? The file will be removed from wiki/deliverables.");
    if (!confirmed) {
      return;
    }
    unlinkRunDeliverable.mutate({
      runId,
    });
  }

  return {
    runList,
    filteredRunList,
    deliverableRuns,
    runLogMessages,
    agentFilter,
    reviewFilter,
    isFetchingRuns,
    isLoadingRunsWithoutCache,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    isCreatingRun: createRun.isPending,
    isAppendingRunLog: appendRunLog.isPending,
    isCompletingRun: completeRun.isPending,
    isUpdatingRunReview: updateRunReview.isPending,
    isPromotingRunDeliverable: promoteRunDeliverable.isPending,
    isUnlinkingRunDeliverable: unlinkRunDeliverable.isPending,
    isCapturingRunMemory: captureRunMemory.isPending,
    capturedMemoryPath: captureRunMemory.data?.wikiPath ?? null,
    setRunLogMessage,
    setAgentFilter,
    setReviewFilter,
    handleAppendRunLog,
    startManualRun: () => {
      if (isOpenAiExecution) {
        const confirmed = window.confirm(
          `OpenAI execution is active (${executorModel}, ${modelProfile}). Starting this run may consume tokens. Continue?`,
        );
        if (!confirmed) return;
      }
      createRun.mutate({
        type: "manual",
        status: "running",
        input: {
          source: "dashboard",
        },
      });
    },
    completeRun: (runId: string) =>
      completeRun.mutate({
        runId,
        input: {
          summary: "Manual run completed from dashboard",
          reviewStatus: "pending",
          output: {
            completedFrom: "dashboard",
          },
        },
      }),
    setRunReview: (runId: string, reviewStatus: RunReviewStatus) =>
      updateRunReview.mutate({
        runId,
        input: {
          reviewStatus,
        },
      }),
    promoteRunDeliverable: (runId: string) =>
      promoteRunDeliverable.mutate({
        runId,
      }),
    unlinkRunDeliverable: handleUnlinkRunDeliverable,
    captureRunMemory: (runId: string) =>
      captureRunMemory.mutate({
        runId,
        input: {
          summary: "Review memory captured from dashboard.",
        },
      }),
  };
}
