import { useMemo, useState } from "react";
import { useWikiIndexApi, useWikiIngestApi, useWikiLintApi, useWikiLogApi, useWikiPageApi, useWikiQueryApi } from "../../../api/hooks/wiki/useWikiApi";

export function useWikiPanel() {
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestSourceType, setIngestSourceType] = useState<"note" | "research" | "client" | "decision" | "other">("note");
  const [queryInput, setQueryInput] = useState("");
  const [querySourceType, setQuerySourceType] = useState<"all" | "note" | "research" | "client" | "decision" | "other">("all");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [selectedSummaryPath, setSelectedSummaryPath] = useState<string | null>(null);

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
  );
  const { data: selectedSummaryPage, isFetching: isFetchingSummaryPage } = useWikiPageApi(selectedSummaryPath);
  const {
    mutateAsync: ingestWiki,
    isPending: isIngesting,
    data: ingestResult,
  } = useWikiIngestApi();
  const {
    mutateAsync: lintWiki,
    isPending: isLinting,
    data: lintResult,
  } = useWikiLintApi();

  const latestLog = wikiLog?.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-8)
    .join("\n");

  const queryMatches = queryResult?.matches ?? [];
  const proposedTasks = ingestResult?.proposedTasks ?? [];
  const canRunIngest = ingestTitle.trim().length > 0 && ingestContent.trim().length > 0 && !isIngesting;
  const canRunQuery = queryInput.trim().length > 0;
  const lintIssues = lintResult?.issues ?? [];
  const lintCheckedAt = lintResult?.checkedAt ?? null;
  const lintSummary = useMemo(() => {
    if (!lintResult) {
      return "";
    }
    return lintResult.ok ? "No issues found." : `${lintIssues.length} issue(s) found.`;
  }, [lintIssues.length, lintResult]);

  async function submitIngest(): Promise<void> {
    if (!canRunIngest) {
      return;
    }
    await ingestWiki({
      title: ingestTitle.trim(),
      content: ingestContent.trim(),
      sourceType: ingestSourceType,
    });
    setSelectedSummaryPath(null);
    setIngestTitle("");
    setIngestContent("");
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

  async function runLint(): Promise<void> {
    await lintWiki();
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
    setQueryInput,
    setQuerySourceType,
    queryMatches,
    isFetchingQuery,
    isIngesting,
    ingestResult,
    proposedTasks,
    selectedSummaryPath,
    selectedSummaryPage,
    isFetchingSummaryPage,
    isLinting,
    lintResult,
    lintIssues,
    lintCheckedAt,
    lintSummary,
    canRunIngest,
    canRunQuery,
    submitIngest,
    selectIngestSummary,
    submitQuery,
    runLint,
  };
}
