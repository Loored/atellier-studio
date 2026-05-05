import { useState } from "react";
import type { CodexWorkerMode, CodexWorkerProfile } from "@atellier/shared";
import { useCodexWorkerApi } from "../../../api/hooks/codex/useCodexWorkerApi";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";
import { wikiService } from "../../../api/services/wiki.service";

type CodexWorkerPanelStep = {
  id: string;
  summary: string;
  status: string;
  needsApproval: boolean;
  riskLevel: "low" | "medium" | "high";
  command: string;
  startedAt?: string;
  finishedAt?: string;
  exitCode?: number;
  output?: string;
  stdoutPath?: string;
  stderrPath?: string;
};

export function useCodexWorkerPanel() {
  const [goal, setGoal] = useState("Implement a safe API change");
  const [mode, setMode] = useState<CodexWorkerMode>("approved_step");
  const [profile, setProfile] = useState<CodexWorkerProfile>("standard");
  const [runId, setRunId] = useState<string | null>(null);
  const { data: healthStatus } = useHealthApi();
  const api = useCodexWorkerApi(runId);
  const isOpenAiExecution = healthStatus?.executorMode === "openai";
  const executorModel = healthStatus?.executorModel ?? "unknown";
  const modelProfile = healthStatus?.modelProfile ?? "standard";

  const steps: CodexWorkerPanelStep[] = api.codexWorkerQuery.data?.steps ?? [];
  const runLogPath = api.codexWorkerQuery.data?.run?.output?.finalize?.runLog ?? null;
  const finalizedAt = api.codexWorkerQuery.data?.run?.output?.finalize?.finalizedAt ?? null;
  const runStatus = api.codexWorkerQuery.data?.run?.status ?? null;
  const [runLogContent, setRunLogContent] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const hasPlannedSteps = steps.length > 0;
  const hasPendingApproval = steps.some((step) => step.needsApproval && step.status === "pending");
  const hasExecutableStep = steps.some(
    (step) => step.status === "approved" || (!step.needsApproval && step.status === "pending"),
  );
  const hasUnresolvedSteps = steps.some((step) => step.status !== "completed");
  const isRunCancelled = runStatus === "blocked";
  const isRunCompleted = runStatus === "completed";

  const canPlan = Boolean(runId) && !isRunCancelled && !isRunCompleted;
  const canExecuteNext = Boolean(runId) && hasPlannedSteps && hasExecutableStep && !isRunCancelled && !isRunCompleted;
  const canCancel = Boolean(runId) && !isRunCancelled && !isRunCompleted;
  const canFinalize = Boolean(runId) && hasPlannedSteps && !hasUnresolvedSteps;

  const planBlockedReason = !runId
    ? "Create a run first."
    : isRunCancelled
      ? "Run is cancelled."
      : isRunCompleted
        ? "Run is already completed."
        : null;
  const executeBlockedReason = !runId
    ? "Create a run first."
    : !hasPlannedSteps
      ? "Plan the run before executing steps."
      : isRunCancelled
        ? "Run is cancelled."
        : isRunCompleted
          ? "Run is already completed."
          : hasPendingApproval
            ? "Approve pending protected steps first."
            : !hasExecutableStep
              ? "No executable step available."
              : null;
  const cancelBlockedReason = !runId
    ? "Create a run first."
    : isRunCancelled
      ? "Run is already cancelled."
      : isRunCompleted
        ? "Completed runs cannot be cancelled."
        : null;
  const finalizeBlockedReason = !runId
    ? "Create a run first."
    : !hasPlannedSteps
      ? "Plan the run before finalizing."
      : hasUnresolvedSteps
        ? "Complete all steps before finalizing."
        : null;

  async function createRun() {
    setActionError(null);
    if (isOpenAiExecution) {
      const confirmed = window.confirm(
        `OpenAI execution is active (${executorModel}, ${modelProfile}). Creating and running codex steps may consume tokens. Continue?`,
      );
      if (!confirmed) return;
    }
    try {
      const run = await api.createCodexWorkerMutation.mutateAsync({ goal, mode, profile });
      setRunId(run.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to create run.");
    }
  }

  async function plan() {
    if (!runId || !canPlan) return;
    setActionError(null);
    try {
      await api.planCodexWorkerMutation.mutateAsync(runId);
      await api.codexWorkerQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to plan run.");
    }
  }

  async function approve(stepId: string) {
    if (!runId) return;
    setActionError(null);
    try {
      await api.approveCodexWorkerStepMutation.mutateAsync({ id: runId, stepId });
      await api.codexWorkerQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to approve step.");
    }
  }

  async function executeNext() {
    if (!runId || !canExecuteNext) return;
    setActionError(null);
    try {
      await api.executeNextCodexWorkerMutation.mutateAsync(runId);
      await api.codexWorkerQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to execute next step.");
    }
  }

  async function cancel() {
    if (!runId || !canCancel) return;
    setActionError(null);
    try {
      await api.cancelCodexWorkerMutation.mutateAsync(runId);
      await api.codexWorkerQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to cancel run.");
    }
  }

  async function finalize() {
    if (!runId || !canFinalize) return;
    setActionError(null);
    try {
      await api.finalizeCodexWorkerMutation.mutateAsync({ id: runId, summary: "Finalized from dashboard codex worker panel." });
      await api.codexWorkerQuery.refetch();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to finalize run.");
    }
  }

  async function openRunLog() {
    if (!runLogPath) return;
    const page = await wikiService.readPage(runLogPath);
    setRunLogContent(page.content);
  }

  return {
    goal,
    setGoal,
    mode,
    setMode,
    profile,
    setProfile,
    runId,
    runStatus,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    runLogPath,
    finalizedAt,
    runLogContent,
    actionError,
    steps,
    canPlan,
    canExecuteNext,
    canCancel,
    canFinalize,
    planBlockedReason,
    executeBlockedReason,
    cancelBlockedReason,
    finalizeBlockedReason,
    createRun,
    plan,
    approve,
    executeNext,
    cancel,
    finalize,
    openRunLog,
  };
}
