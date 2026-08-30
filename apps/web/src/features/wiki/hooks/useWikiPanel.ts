import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  TASK_TITLE_MAX_LENGTH,
  type Run,
  type Task,
  type WikiDreamDecisionValue,
} from "@atellier/shared";
import {
  useOrchestrationStatusApi,
  useStartSkillOrchestrationApi,
} from "../../../api/hooks/orchestrations/useOrchestrationsApi";
import { useRunsApi } from "../../../api/hooks/runs/useRunsApi";
import { useHealthApi } from "../../../api/hooks/system/useSystemApi";
import { useCreateTaskApi } from "../../../api/hooks/tasks/useTasksApi";
import {
  useAppendWikiLogApi,
  useWikiIndexApi,
  useWikiIngestApi,
  useWikiLintApi,
  useWikiLogApi,
  useWikiPageApi,
  useWikiQueryApi,
  useWikiWritePageApi,
  useWikiRecordDreamDecisionApi,
  useWikiReflectionsApi,
  useWikiReflectionDecisionApi,
  useWikiReflectionPromotionApi,
} from "../../../api/hooks/wiki/useWikiApi";
import { queryKeys } from "../../../api/query/queryKeys";

const DREAM_GOAL = "Periodic curator pass — propose wiki maintenance but apply nothing.";
const DREAM_CONTEXT = "Triggered from the Wiki view. Save only the report after explicit operator approval.";

export function useWikiPanel() {
  const queryClient = useQueryClient();
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [lastIngestTitle, setLastIngestTitle] = useState("");
  const [createdLinkedTask, setCreatedLinkedTask] = useState<Task | null>(null);
  const [ingestSourceType, setIngestSourceType] = useState<"note" | "research" | "client" | "decision" | "other">("note");
  const [queryInput, setQueryInput] = useState("");
  const [querySourceType, setQuerySourceType] = useState<"all" | "note" | "research" | "client" | "decision" | "other">("all");
  const [queryRetrievalPolicy, setQueryRetrievalPolicy] = useState<"balanced" | "evidence-first" | "trusted-only">("balanced");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [selectedSummaryPath, setSelectedSummaryPath] = useState<string | null>(null);
  const [queryDraftOriginPath, setQueryDraftOriginPath] = useState<string | null>(null);
  const [writePath, setWritePath] = useState("wiki/notes/my-note.md");
  const [writeContent, setWriteContent] = useState("");
  const [dreamRunId, setDreamRunId] = useState<string | null>(null);
  const [dreamActionError, setDreamActionError] = useState<string | null>(null);
  const [lastSavedDreamPath, setLastSavedDreamPath] = useState<string | null>(null);
  const [dreamDecisionFeedback, setDreamDecisionFeedback] = useState<string | null>(null);
  const [reflectionNotes, setReflectionNotes] = useState<Record<string, string>>({});
  const [reflectionDecisions, setReflectionDecisions] = useState<Record<string, { decision: "accepted" | "rejected"; path: string }>>({});

  const { data: healthStatus } = useHealthApi();
  const isMeteredDreamExecution =
    healthStatus?.executorMode === "openai" ||
    healthStatus?.executorMode === "anthropic" ||
    healthStatus?.executorMode === "groq";
  const dreamExecutorMode = healthStatus?.executorMode ?? "mock";
  const dreamExecutorModel = healthStatus?.executorModel ?? "unknown";
  const dreamModelProfile = healthStatus?.modelProfile ?? "standard";
  const { data: runList = [], isFetching: isFetchingRuns } = useRunsApi();
  const startDreamOrchestration = useStartSkillOrchestrationApi();
  const { data: dreamStatus } = useOrchestrationStatusApi(dreamRunId);
  const {
    data: wikiIndex,
    isFetching: isFetchingWikiIndex,
    isLoadingWithoutCache: isLoadingWikiIndexWithoutCache,
  } = useWikiIndexApi();
  const {
    data: wikiLog,
    isFetching: isFetchingWikiLog,
    isLoadingWithoutCache: isLoadingWikiLogWithoutCache,
  } = useWikiLogApi();
  const { data: queryResult, isFetching: isFetchingQuery } = useWikiQueryApi(
    activeQuery,
    5,
    querySourceType === "all" ? undefined : querySourceType,
    queryRetrievalPolicy,
  );
  const { data: selectedSummaryPage, isFetching: isFetchingSummaryPage } = useWikiPageApi(selectedSummaryPath);
  const {
    mutateAsync: ingestWiki,
    isPending: isIngesting,
    data: ingestResult,
  } = useWikiIngestApi();
  const createLinkedTaskMutation = useCreateTaskApi();
  const {
    mutateAsync: lintWiki,
    isPending: isLinting,
    data: lintResult,
  } = useWikiLintApi();
  const writePageMutation = useWikiWritePageApi();
  const reflectionMutation = useWikiReflectionsApi();
  const reflectionDecisionMutation = useWikiReflectionDecisionApi();
  const reflectionPromotionMutation = useWikiReflectionPromotionApi();
  const dreamWritePageMutation = useWikiWritePageApi();
  const { mutateAsync: appendWikiLog } = useAppendWikiLogApi();
  const dreamDecisionMutation = useWikiRecordDreamDecisionApi();

  const latestLog = wikiLog?.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-8)
    .join("\n");

  const queryMatches = queryResult?.matches ?? [];
  const relatedPages = queryResult?.relatedPages ?? [];
  const contradictions = queryResult?.contradictions ?? [];
  const proposedTasks = ingestResult?.proposedTasks ?? [];
  const canCreateLinkedTask = Boolean(
    ingestResult?.rawPath &&
    ingestResult.summaryPagePath &&
    !createdLinkedTask &&
    !createLinkedTaskMutation.isPending,
  );
  const canRunIngest = ingestTitle.trim().length > 0 && ingestContent.trim().length > 0 && !isIngesting;
  const canRunQuery = queryInput.trim().length > 0;
  const canWritePage =
    writePath.trim().endsWith(".md") &&
    writePath.trim().length > 0 &&
    writeContent.trim().length > 0 &&
    !writePageMutation.isPending;
  const lintIssues = lintResult?.issues ?? [];
  const lintCheckedAt = lintResult?.checkedAt ?? null;
  const dreamDraftRunId = dreamStatus?.steps.find((step) => step.stepId === "draft-report")?.runId ?? null;
  const dreamDraftRun = useMemo(
    () => runList.find((run) => run.id === dreamDraftRunId) ?? null,
    [dreamDraftRunId, runList],
  );
  const dreamReportContent = useMemo(() => extractRunResponse(dreamDraftRun), [dreamDraftRun]);
  const dreamSuggestedPath = useMemo(() => {
    return extractDreamPath(dreamReportContent) ?? `wiki/dreams/${new Date().toISOString().slice(0, 10)}-dream-report.md`;
  }, [dreamReportContent]);
  const isDreamRunning = Boolean(
    dreamRunId &&
    dreamStatus?.status !== "completed" &&
    dreamStatus?.status !== "failed",
  );
  const canRunDream = !startDreamOrchestration.isPending && !isDreamRunning;
  const canSaveDreamReport = Boolean(dreamReportContent && dreamSuggestedPath) && !dreamWritePageMutation.isPending;
  const dreamProposals = useMemo(() => extractDreamProposals(dreamReportContent), [dreamReportContent]);
  const lintSummary = useMemo(() => {
    if (!lintResult) {
      return "";
    }
    return lintResult.ok ? "No issues found." : `${lintIssues.length} issue(s) found.`;
  }, [lintIssues.length, lintResult]);

  useEffect(() => {
    if (dreamStatus?.status !== "completed" && dreamStatus?.status !== "failed") {
      return;
    }
    void Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.runs.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.wiki.log }),
    ]);
  }, [dreamStatus?.status, queryClient]);

  async function runDream(): Promise<void> {
    setDreamActionError(null);
    setLastSavedDreamPath(null);
    if (!canRunDream) {
      return;
    }
    if (isMeteredDreamExecution) {
      const confirmed = window.confirm(
        `${dreamExecutorMode.toUpperCase()} execution is active (${dreamExecutorModel}, ${dreamModelProfile}). Starting a wiki dream may consume API quota. Continue?`,
      );
      if (!confirmed) {
        return;
      }
    }

    try {
      const result = await startDreamOrchestration.mutateAsync({
        skillId: "wiki-dream-loop",
        goal: DREAM_GOAL,
        context: DREAM_CONTEXT,
      });
      setDreamRunId(result.runId);
    } catch (error) {
      setDreamActionError(error instanceof Error ? error.message : "Failed to start wiki dream.");
    }
  }

  async function saveDreamReport(): Promise<void> {
    if (!canSaveDreamReport) {
      return;
    }
    setDreamActionError(null);
    try {
      const result = await dreamWritePageMutation.mutateAsync({
        path: dreamSuggestedPath,
        content: dreamReportContent.trim(),
      });
      setLastSavedDreamPath(result.path);
      setSelectedSummaryPath(result.path);
    } catch (error) {
      setDreamActionError(error instanceof Error ? error.message : "Failed to save dream report.");
    }
  }

  async function submitIngest(): Promise<void> {
    if (!canRunIngest) {
      return;
    }
    const title = ingestTitle.trim();
    setCreatedLinkedTask(null);
    await ingestWiki({
      title,
      content: ingestContent.trim(),
      sourceType: ingestSourceType,
    });
    setLastIngestTitle(title);
    setSelectedSummaryPath(null);
    setIngestTitle("");
    setIngestContent("");
  }

  async function createLinkedTask(): Promise<void> {
    if (!canCreateLinkedTask || !ingestResult) {
      return;
    }

    const task = await createLinkedTaskMutation.mutateAsync({
      title: inferLinkedTaskTitle(proposedTasks, lastIngestTitle),
      description: `Grounded in ${ingestResult.summaryPagePath} (raw: ${ingestResult.rawPath}).`,
      status: "inbox",
      priority: "medium",
      sourceIds: [ingestResult.rawPath, ingestResult.summaryPagePath],
    });
    setCreatedLinkedTask(task);
  }

  function selectIngestSummary(): void {
    if (!ingestResult?.summaryPagePath) {
      return;
    }
    setSelectedSummaryPath(ingestResult.summaryPagePath);
  }

  function submitQuery(): void {
    if (!canRunQuery) {
      return;
    }
    setActiveQuery(queryInput.trim());
  }

  function promoteQueryMatchToDraft(matchPath: string, snippet: string): void {
    const slug = matchPath
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "query-note";
    const matchingRelated = relatedPages.filter((page) => page.path !== matchPath).slice(0, 3);
    const matchingContradiction = contradictions[0];
    const draftPageType = matchingContradiction
      ? "decision"
      : matchingRelated.length > 0
        ? "note"
        : "source";
    const draftOutline = matchingContradiction
      ? [
          "## Suggested Structure",
          "",
          "- Problem statement",
          "- Conflicting evidence",
          "- Recommended interpretation",
          "- Follow-up action",
          "",
        ]
      : matchingRelated.length > 0
        ? [
            "## Suggested Structure",
            "",
            "- Context",
            "- Related pages",
            "- Notes",
            "- Next steps",
            "",
        ]
      : [
          "## Suggested Structure",
          "",
          "- Context",
          "- Notes",
          "- Follow-up",
          "",
        ];
    const draftFollowUps = matchingContradiction
      ? [
          "## Suggested Follow-ups",
          "",
          "- Review both conflicting pages together.",
          "- Decide which page should be corrected or merged.",
          "",
        ]
      : matchingRelated.length > 0
        ? [
            "## Suggested Follow-ups",
            "",
            "- Review related pages for overlapping context.",
            "- Decide whether the draft should reference or merge with an existing note.",
            "",
          ]
        : [
            "## Suggested Follow-ups",
            "",
            "- Add one more source or note if the topic needs more context.",
            "- Confirm whether this draft should become a durable page.",
            "",
          ];
    const draftProvenance = [
      "## Draft Provenance",
      "",
      `- Query: ${queryResult?.query ?? queryInput.trim()}`,
      `- Source path: ${matchPath}`,
      `- Suggested page type: ${draftPageType}`,
      `- Related pages: ${matchingRelated.length}`,
      `- Contradictions: ${matchingContradiction ? 1 : 0}`,
      "",
    ];
    const draftContent = [
      `# Query Draft - ${matchPath}`,
      "",
      "## Source",
      "",
      `- path: ${matchPath}`,
      "",
      "## Notes",
      "",
      snippet,
      "",
      ...draftProvenance,
      ...draftOutline,
      ...draftFollowUps,
      "## Related Pages",
      "",
      ...(matchingRelated.length > 0
        ? matchingRelated.map((page) => `- ${page.path}: ${page.reason}`)
        : ["- none"]),
      "",
      "## Review Notes",
      "",
      matchingContradiction
        ? `- Possible contradiction: ${matchingContradiction.primaryPath} vs ${matchingContradiction.conflictingPath}`
        : "- none",
      "",
    ].join("\n");
    const draftSegment = draftPageType === "decision"
      ? "decisions"
      : draftPageType === "source"
        ? "sources"
        : "notes";
    setWritePath(`wiki/${draftSegment}/query-${slug}.md`);
    setWriteContent(draftContent);
    setQueryDraftOriginPath(matchPath);
  }

  async function generateReflectionCandidates(): Promise<void> {
    await reflectionMutation.mutateAsync({ minOccurrences: 2, limit: 5 });
  }

  function prepareReflectionDraft(candidateId: string): void {
    const candidate = reflectionMutation.data?.candidates.find((item) => item.id === candidateId);
    if (!candidate) return;
    setWritePath(candidate.suggestedPath);
    setWriteContent(candidate.draftMarkdown);
    setQueryDraftOriginPath(null);
  }

  async function decideReflection(candidateId: string, decision: "accepted" | "rejected"): Promise<void> {
    const note = reflectionNotes[candidateId]?.trim();
    if (!note) return;
    const result = await reflectionDecisionMutation.mutateAsync({ candidateId, decision, note });
    setReflectionDecisions((current) => ({ ...current, [candidateId]: { decision, path: result.path } }));
  }

  async function promoteAcceptedReflection(candidateId: string): Promise<void> {
    const record = reflectionDecisions[candidateId];
    if (!record || record.decision !== "accepted") return;
    await reflectionPromotionMutation.mutateAsync({ decisionPath: record.path });
  }

  async function runLint(): Promise<void> {
    await lintWiki();
  }

  async function submitWritePage(): Promise<void> {
    if (!canWritePage) return;
    const result = await writePageMutation.mutateAsync({
      path: writePath.trim(),
      content: writeContent.trim(),
    });
    if (queryDraftOriginPath) {
      await appendWikiLog({
        eventType: "wiki_write",
        title: "Promoted wiki query result to draft",
        summary: `Created draft from ${result.path}`,
        details: {
          sourcePath: queryDraftOriginPath,
          query: queryResult?.query ?? queryInput.trim(),
          relatedPages: relatedPages.length,
          contradictions: contradictions.length,
        },
      });
      setQueryDraftOriginPath(null);
    }
    setSelectedSummaryPath(result.path);
  }

  async function decideDreamProposal(proposal: string, decision: WikiDreamDecisionValue): Promise<void> {
    if (!dreamSuggestedPath || !proposal.trim() || dreamDecisionMutation.isPending) {
      return;
    }
    setDreamDecisionFeedback(null);
    try {
      const result = await dreamDecisionMutation.mutateAsync({
        reportPath: dreamSuggestedPath,
        proposal: proposal.trim(),
        decision,
      });
      setDreamDecisionFeedback(`Decision saved: ${decision} (${result.path})`);
    } catch (error) {
      setDreamDecisionFeedback(error instanceof Error ? error.message : "Failed to save dream decision.");
    }
  }

  return {
    wikiIndex,
    wikiLog,
    latestLog,
    isFetchingWikiIndex,
    isFetchingWikiLog,
    isLoadingWikiIndexWithoutCache,
    isLoadingWikiLogWithoutCache,
    ingestTitle,
    ingestContent,
    ingestSourceType,
    setIngestTitle,
    setIngestContent,
    setIngestSourceType,
    queryInput,
    querySourceType,
    queryRetrievalPolicy,
    setQueryInput,
    setQuerySourceType,
    setQueryRetrievalPolicy,
    queryMatches,
    relatedPages,
    contradictions,
    reflectionCandidates: reflectionMutation.data?.candidates ?? [],
    scannedReflectionEpisodes: reflectionMutation.data?.scannedEpisodes ?? null,
    isGeneratingReflections: reflectionMutation.isPending,
    reflectionNotes,
    setReflectionNotes,
    reflectionDecisions,
    isSavingReflectionDecision: reflectionDecisionMutation.isPending,
    isPromotingReflection: reflectionPromotionMutation.isPending,
    isFetchingQuery,
    isIngesting,
    ingestResult,
    proposedTasks,
    createdLinkedTask,
    canCreateLinkedTask,
    isCreatingLinkedTask: createLinkedTaskMutation.isPending,
    selectedSummaryPath,
    selectedSummaryPage,
    isFetchingSummaryPage,
    isLinting,
    lintResult,
    lintIssues,
    lintCheckedAt,
    lintSummary,
    dreamRunId,
    dreamStatus,
    dreamDraftRunId,
    dreamReportContent,
    dreamProposals,
    dreamSuggestedPath,
    dreamActionError,
    lastSavedDreamPath,
    isDreamRunning,
    isFetchingRuns,
    isStartingDream: startDreamOrchestration.isPending,
    isSavingDreamReport: dreamWritePageMutation.isPending,
    isSavingDreamDecision: dreamDecisionMutation.isPending,
    canRunDream,
    canSaveDreamReport,
    canRunIngest,
    canRunQuery,
    canWritePage,
    writePath,
    writeContent,
    setWritePath,
    setWriteContent,
    isWritingWikiPage: writePageMutation.isPending,
    writeResult: writePageMutation.data,
    submitIngest,
    createLinkedTask,
    selectIngestSummary,
    submitQuery,
    promoteQueryMatchToDraft,
    generateReflectionCandidates,
    prepareReflectionDraft,
    decideReflection,
    promoteAcceptedReflection,
    runLint,
    runDream,
    saveDreamReport,
    decideDreamProposal,
    dreamDecisionFeedback,
    submitWritePage,
  };
}

function inferLinkedTaskTitle(proposedTasks: string[], ingestTitle: string): string {
  const proposedTitle = proposedTasks
    .map((task) => task.replace(/^\s*-?\s*\[[ x]\]\s*/i, "").replace(/\s*\(source:.*\)\s*$/i, "").trim())
    .find(Boolean);
  return (proposedTitle || `Follow up: ${ingestTitle || "ingested source"}`).slice(0, TASK_TITLE_MAX_LENGTH);
}

function extractRunResponse(run: Run | null): string {
  if (!run?.output || typeof run.output !== "object") {
    return "";
  }
  const response = (run.output as { response?: unknown }).response;
  return typeof response === "string" ? response : "";
}

function extractDreamPath(content: string): string | null {
  const match = content.match(/wiki\/dreams\/[a-z0-9._/-]+\.md/i);
  return match?.[0] ?? null;
}

function extractDreamProposals(content: string): string[] {
  const sectionMatch = content.match(/## Proposed actions\s*\n([\s\S]*?)(?:\n## |\s*$)/i);
  if (!sectionMatch?.[1]) return [];
  return sectionMatch[1]
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d+\.\s+/, ""))
    .filter((line) => line.length > 0);
}
