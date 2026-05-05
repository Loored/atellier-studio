import { useState } from "react";
import type { CodexWorkerMode, CodexWorkerProfile } from "@atellier/shared";
import { useCodexWorkerApi } from "../../../api/hooks/codex/useCodexWorkerApi";
import { wikiService } from "../../../api/services/wiki.service";

type CodexWorkerPanelStep = {
  id: string;
  summary: string;
  status: string;
  needsApproval: boolean;
};

export function useCodexWorkerPanel() {
  const [goal, setGoal] = useState("Implement a safe API change");
  const [mode, setMode] = useState<CodexWorkerMode>("approved_step");
  const [profile, setProfile] = useState<CodexWorkerProfile>("standard");
  const [runId, setRunId] = useState<string | null>(null);
  const api = useCodexWorkerApi(runId);

  const steps: CodexWorkerPanelStep[] = api.codexWorkerQuery.data?.steps ?? [];
  const runLogPath = api.codexWorkerQuery.data?.run?.output?.finalize?.runLog ?? null;
  const finalizedAt = api.codexWorkerQuery.data?.run?.output?.finalize?.finalizedAt ?? null;
  const runStatus = api.codexWorkerQuery.data?.run?.status ?? null;
  const [runLogContent, setRunLogContent] = useState<string | null>(null);

  async function createRun() {
    const run = await api.createCodexWorkerMutation.mutateAsync({ goal, mode, profile });
    setRunId(run.id);
  }

  async function plan() {
    if (!runId) return;
    await api.planCodexWorkerMutation.mutateAsync(runId);
    await api.codexWorkerQuery.refetch();
  }

  async function approve(stepId: string) {
    if (!runId) return;
    await api.approveCodexWorkerStepMutation.mutateAsync({ id: runId, stepId });
    await api.codexWorkerQuery.refetch();
  }

  async function executeNext() {
    if (!runId) return;
    await api.executeNextCodexWorkerMutation.mutateAsync(runId);
    await api.codexWorkerQuery.refetch();
  }

  async function cancel() {
    if (!runId) return;
    await api.cancelCodexWorkerMutation.mutateAsync(runId);
    await api.codexWorkerQuery.refetch();
  }

  async function finalize() {
    if (!runId) return;
    await api.finalizeCodexWorkerMutation.mutateAsync({ id: runId, summary: "Finalized from dashboard codex worker panel." });
    await api.codexWorkerQuery.refetch();
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
    runLogPath,
    finalizedAt,
    runLogContent,
    steps,
    createRun,
    plan,
    approve,
    executeNext,
    cancel,
    finalize,
    openRunLog,
  };
}
