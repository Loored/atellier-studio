import { useMutation, useQuery } from "@tanstack/react-query";
import { codexWorkerService } from "../../services/codex-worker.service";

export function useActiveCodexRun() {
  return useQuery({
    queryKey: ["codex-worker", "active"],
    queryFn: () => codexWorkerService.getActive(),
    refetchInterval: 2_000,
  });
}

export function useCodexWorkerApi(runId: string | null) {
  const codexWorkerQuery = useQuery({
    queryKey: ["codex-worker", runId],
    queryFn: () => codexWorkerService.get(runId as string),
    enabled: Boolean(runId),
  });

  const createCodexWorkerMutation = useMutation({
    mutationFn: codexWorkerService.create,
  });

  const planCodexWorkerMutation = useMutation({
    mutationFn: (id: string) => codexWorkerService.plan(id),
  });

  const approveCodexWorkerStepMutation = useMutation({
    mutationFn: ({ id, stepId }: { id: string; stepId: string }) => codexWorkerService.approveStep(id, stepId),
  });

  const executeNextCodexWorkerMutation = useMutation({
    mutationFn: (id: string) => codexWorkerService.executeNext(id),
  });

  const cancelCodexWorkerMutation = useMutation({
    mutationFn: (id: string) => codexWorkerService.cancel(id),
  });
  const finalizeCodexWorkerMutation = useMutation({
    mutationFn: ({
      id,
      summary,
      changedFiles,
      testEvidence,
    }: {
      id: string;
      summary?: string;
      changedFiles?: string[];
      testEvidence?: string[];
    }) => codexWorkerService.finalize(id, { summary, changedFiles, testEvidence }),
  });

  return {
    codexWorkerQuery,
    createCodexWorkerMutation,
    planCodexWorkerMutation,
    approveCodexWorkerStepMutation,
    executeNextCodexWorkerMutation,
    cancelCodexWorkerMutation,
    finalizeCodexWorkerMutation,
  };
}
