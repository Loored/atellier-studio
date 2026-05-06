import { useMemo, useState } from "react";
import {
  useAppendWikiLogApi,
  useWikiIndexApi,
  useWikiIngestApi,
  useWikiLintApi,
  useWikiLogApi,
  useWikiPageApi,
  useWikiQueryApi,
  useWikiWritePageApi,
} from "../../../api/hooks/wiki/useWikiApi";

export function useWikiPanel() {
  const [ingestTitle, setIngestTitle] = useState("");
  const [ingestContent, setIngestContent] = useState("");
  const [ingestSourceType, setIngestSourceType] = useState<"note" | "research" | "client" | "decision" | "other">("note");
  const [queryInput, setQueryInput] = useState("");
  const [querySourceType, setQuerySourceType] = useState<"all" | "note" | "research" | "client" | "decision" | "other">("all");
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [selectedSummaryPath, setSelectedSummaryPath] = useState<string | null>(null);
  const [queryDraftOriginPath, setQueryDraftOriginPath] = useState<string | null>(null);
  const [writePath, setWritePath] = useState("wiki/notes/my-note.md");
  const [writeContent, setWriteContent] = useState("");

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
  const {
    mutateAsync: writeWikiPage,
    isPending: isWritingWikiPage,
    data: writeResult,
  } = useWikiWritePageApi();
  const { mutateAsync: appendWikiLog } = useAppendWikiLogApi();

  const latestLog = wikiLog?.content
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .slice(-8)
    .join("\n");

  const queryMatches = queryResult?.matches ?? [];
  const relatedPages = queryResult?.relatedPages ?? [];
  const contradictions = queryResult?.contradictions ?? [];
  const proposedTasks = ingestResult?.proposedTasks ?? [];
  const canRunIngest = ingestTitle.trim().length > 0 && ingestContent.trim().length > 0 && !isIngesting;
  const canRunQuery = queryInput.trim().length > 0;
  const canWritePage =
    writePath.trim().endsWith(".md") &&
    writePath.trim().length > 0 &&
    writeContent.trim().length > 0 &&
    !isWritingWikiPage;
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

  async function runLint(): Promise<void> {
    await lintWiki();
  }

  async function submitWritePage(): Promise<void> {
    if (!canWritePage) return;
    const result = await writeWikiPage({
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
    relatedPages,
    contradictions,
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
    canWritePage,
    writePath,
    writeContent,
    setWritePath,
    setWriteContent,
    isWritingWikiPage,
    writeResult,
    submitIngest,
    selectIngestSummary,
    submitQuery,
    promoteQueryMatchToDraft,
    runLint,
    submitWritePage,
  };
}
