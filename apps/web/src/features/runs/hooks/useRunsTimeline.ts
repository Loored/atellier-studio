import { type FormEvent, useState } from "react";
import {
  useAppendRunLogApi,
  useCompleteRunApi,
  useCreateRunApi,
  useRunsApi,
} from "../../../api/hooks/runs/useRunsApi";

export function useRunsTimeline() {
  const {
    data: runList = [],
    isFetching: isFetchingRuns,
    isLoadingWithoutCache: isLoadingRunsWithoutCache,
  } = useRunsApi();
  const createRun = useCreateRunApi();
  const appendRunLog = useAppendRunLogApi();
  const completeRun = useCompleteRunApi();
  const [runLogMessages, setRunLogMessages] = useState<Record<string, string>>({});

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

  return {
    runList,
    runLogMessages,
    isFetchingRuns,
    isLoadingRunsWithoutCache,
    isCreatingRun: createRun.isPending,
    isAppendingRunLog: appendRunLog.isPending,
    isCompletingRun: completeRun.isPending,
    setRunLogMessage,
    handleAppendRunLog,
    startManualRun: () =>
      createRun.mutate({
        type: "manual",
        status: "running",
        input: {
          source: "dashboard",
        },
      }),
    completeRun: (runId: string) =>
      completeRun.mutate({
        runId,
        input: {
          summary: "Manual run completed from dashboard",
          output: {
            completedFrom: "dashboard",
          },
        },
      }),
  };
}
