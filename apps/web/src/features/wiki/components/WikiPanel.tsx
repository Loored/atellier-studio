import { BookOpenText, Loader2, Save, Sparkles } from "lucide-react";
import type { MemoryTrustMetadata } from "@atellier/shared";
import { useWikiPanel } from "../hooks/useWikiPanel";

function MemoryTrustBadge({ memory }: { memory: MemoryTrustMetadata }) {
  const color = memory.authority === "trusted"
    ? "border-teal/35 text-teal bg-teal/10"
    : memory.authority === "evidence-only"
      ? "border-purple/35 text-purple bg-purple/10"
      : "border-orange/35 text-orange bg-orange/10";
  return (
    <span
      className={`inline-flex items-center min-h-5 rounded px-1.5 text-[0.64rem] font-bold tracking-wide uppercase border ${color}`}
      title={memory.reason}
      aria-label={`Memory trust: ${memory.layer}, ${memory.state}, ${memory.authority}`}
    >
      {memory.layer} · {memory.state} · {memory.authority}
    </span>
  );
}

export function WikiPanel() {
  const {
    wikiIndex,
    wikiLog,
    latestLog,
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
    reflectionCandidates,
    scannedReflectionEpisodes,
    isGeneratingReflections,
    isFetchingReflectionReview,
    reflectionNotes,
    setReflectionNotes,
    activeReflectionDecisionId,
    activeReflectionPromotionId,
    isFetchingQuery,
    isIngesting,
    ingestResult,
    proposedTasks,
    createdLinkedTask,
    canCreateLinkedTask,
    isCreatingLinkedTask,
    selectedSummaryPage,
    isFetchingSummaryPage,
    isLinting,
    lintIssues,
    lintSummary,
    lintCheckedAt,
    dreamRunId,
    dreamStatus,
    dreamDraftRunId,
    dreamReportContent,
    dreamSuggestedPath,
    dreamProposals,
    dreamActionError,
    dreamDecisionFeedback,
    lastSavedDreamPath,
    isDreamRunning,
    isFetchingRuns,
    isStartingDream,
    isSavingDreamReport,
    isSavingDreamDecision,
    canRunDream,
    canSaveDreamReport,
    canRunIngest,
    canRunQuery,
    canWritePage,
    writePath,
    writeContent,
    setWritePath,
    setWriteContent,
    isGeneratedWriteDraft,
    isDraftProvenanceDetached,
    isWritingWikiPage,
    writeResult,
    submitIngest,
    createLinkedTask,
    selectIngestSummary,
    submitQuery,
    promoteQueryMatchToDraft,
    generateReflectionCandidates,
    decideReflection,
    promoteAcceptedReflection,
    runLint,
    runDream,
    saveDreamReport,
    decideDreamProposal,
    submitWritePage,
  } = useWikiPanel();

  const isLoadingWiki = isLoadingWikiIndexWithoutCache || isLoadingWikiLogWithoutCache;
  const isReady = wikiIndex?.ready && wikiLog?.ready;

  return (
    <section className="col-span-12 min-w-0 border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-3.5">
        <div>
          <p className="text-[0.65rem] font-bold tracking-[0.12em] uppercase text-purple mb-1">Memory</p>
          <h2 className="text-[1.1rem] font-bold text-ink tracking-tight m-0">Wiki Log</h2>
        </div>

        <div className="inline-flex items-center gap-1.5 min-h-7 border border-[var(--border-card)] rounded-lg px-2.5 text-ink-muted bg-[var(--bg-card)] text-[0.78rem]">
          <BookOpenText size={18} />
          <span>{isReady ? "Ready" : "Checking"}</span>
        </div>
      </div>

      {isLoadingWiki ? (
        <p className="m-0 flex items-center gap-2 border border-[var(--border-card)] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          <Loader2 size={14} className="spin text-purple flex-shrink-0" />
          Loading wiki
        </p>
      ) : null}

      <pre
        className="min-h-[100px] max-h-[180px] overflow-auto border border-[var(--border-card)] rounded-lg p-3 text-ink-muted bg-black/25 whitespace-pre-wrap text-[0.78rem] font-mono leading-relaxed m-0"
        aria-label="Latest wiki log entries"
      >
        {latestLog || "No wiki log entries yet"}
      </pre>

      <div className="mt-3.5 grid gap-2.5">
        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-1.5">Dream</p>
              <p className="m-0 text-[0.78rem] text-ink-muted">
                {dreamStatus?.status
                  ? `Run ${dreamStatus.status}${dreamDraftRunId ? ` · report ${dreamDraftRunId}` : ""}`
                  : "No active dream"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void runDream()}
              disabled={!canRunDream}
              className="inline-flex items-center gap-1.5 border-purple/35 text-purple bg-purple/10 hover:bg-purple/20"
            >
              {isStartingDream || isDreamRunning ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
              <span>{isStartingDream || isDreamRunning ? "Dreaming..." : "Dream now"}</span>
            </button>
          </div>

          {dreamRunId ? (
            <div className="mt-2 grid grid-cols-2 gap-2 text-[0.74rem] text-ink-muted">
              <p className="m-0">Parent: {dreamRunId}</p>
              <p className="m-0">Runs: {isFetchingRuns ? "refreshing" : "current"}</p>
            </div>
          ) : null}

          {dreamReportContent ? (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-3 mb-1.5">
                <p className="m-0 text-[0.74rem] text-ink-muted">Report path: {dreamSuggestedPath}</p>
                <button
                  type="button"
                  onClick={() => void saveDreamReport()}
                  disabled={!canSaveDreamReport}
                  className="inline-flex items-center gap-1.5 min-h-7 px-2.5 border-teal/35 text-teal bg-teal/10 hover:bg-teal/20 text-[0.74rem]"
                >
                  <Save size={13} />
                  <span>{isSavingDreamReport ? "Saving..." : "Save report"}</span>
                </button>
              </div>
              <pre
                className="max-h-40 overflow-auto border border-[var(--border-card)] rounded-md p-2 text-[0.72rem] text-ink-muted bg-black/25 whitespace-pre-wrap"
                aria-label="Wiki dream report preview"
              >
                {dreamReportContent}
              </pre>
              {dreamProposals.length > 0 ? (
                <div className="mt-2 space-y-1.5" aria-label="Dream proposals">
                  {dreamProposals.map((proposal) => (
                    <div key={proposal} className="border border-[var(--border-card)] rounded-md p-2 text-[0.72rem] text-ink-muted">
                      <p className="m-0">{proposal}</p>
                      <div className="mt-1.5 flex gap-1.5">
                        <button type="button" disabled={isSavingDreamDecision} onClick={() => void decideDreamProposal(proposal, "accepted")} className="min-h-7 px-2 border-teal/35 text-teal bg-teal/10 hover:bg-teal/20 text-[0.7rem]">Accept</button>
                        <button type="button" disabled={isSavingDreamDecision} onClick={() => void decideDreamProposal(proposal, "rejected")} className="min-h-7 px-2 border-orange/35 text-orange bg-orange/10 hover:bg-orange/20 text-[0.7rem]">Reject</button>
                        <button type="button" disabled={isSavingDreamDecision} onClick={() => void decideDreamProposal(proposal, "deferred")} className="min-h-7 px-2 border-[var(--border-card)] text-ink-muted bg-white/[0.04] hover:bg-white/[0.08] text-[0.7rem]">Defer</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : dreamStatus?.status === "completed" ? (
            <p className="mt-2 text-[0.74rem] text-ink-faint">Report is still loading.</p>
          ) : null}

          {lastSavedDreamPath ? (
            <p className="mt-2 text-[0.74rem] text-ink-muted">Saved: {lastSavedDreamPath}</p>
          ) : null}
          {dreamActionError ? (
            <p className="mt-2 text-[0.74rem] text-orange" role="alert">{dreamActionError}</p>
          ) : null}
          {dreamDecisionFeedback ? (
            <p className="mt-2 text-[0.74rem] text-ink-muted">{dreamDecisionFeedback}</p>
          ) : null}
        </section>

        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Ingest</p>
          <label className="block text-[0.74rem] text-ink-muted mb-1" htmlFor="wiki-ingest-title">Title</label>
          <input
            id="wiki-ingest-title"
            value={ingestTitle}
            onChange={(event) => setIngestTitle(event.target.value)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          />
          <label className="block text-[0.74rem] text-ink-muted mb-1 mt-2" htmlFor="wiki-ingest-content">Content</label>
          <textarea
            id="wiki-ingest-content"
            value={ingestContent}
            onChange={(event) => setIngestContent(event.target.value)}
            className="w-full min-h-20 border border-[var(--border-card)] rounded-md p-2 text-[0.8rem] bg-black/25 text-ink"
          />
          <label className="block text-[0.74rem] text-ink-muted mb-1 mt-2" htmlFor="wiki-ingest-source-type">Source type</label>
          <select
            id="wiki-ingest-source-type"
            value={ingestSourceType}
            onChange={(event) => setIngestSourceType(event.target.value as typeof ingestSourceType)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          >
            <option value="note">note</option>
            <option value="research">research</option>
            <option value="client">client</option>
            <option value="decision">decision</option>
            <option value="other">other</option>
          </select>
          <button
            type="button"
            onClick={() => void submitIngest()}
            disabled={!canRunIngest}
            className="mt-2 border-purple/35 text-purple bg-purple/10 hover:bg-purple/20"
          >
            {isIngesting ? "Ingesting..." : "Ingest Source"}
          </button>
          {ingestResult ? (
            <div className="mt-2" aria-live="polite">
              <p className="text-[0.74rem] text-ink-muted">Saved: {ingestResult.summaryPagePath}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <MemoryTrustBadge memory={ingestResult.rawMemory} />
                <MemoryTrustBadge memory={ingestResult.summaryMemory} />
              </div>
              <div className="mt-1 flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={selectIngestSummary}
                  className="min-h-7 px-2.5 border border-[var(--border-card)] rounded-md text-[0.74rem] text-ink-muted"
                >
                  Preview summary
                </button>
                <button
                  type="button"
                  onClick={() => void createLinkedTask()}
                  disabled={!canCreateLinkedTask}
                  className="min-h-7 px-2.5 border border-teal/35 rounded-md text-[0.74rem] text-teal bg-teal/10 hover:bg-teal/20"
                >
                  {isCreatingLinkedTask ? "Creating task..." : "Create linked task"}
                </button>
              </div>
              {createdLinkedTask ? (
                <p className="mt-1.5 text-[0.74rem] text-teal">
                  Linked task created: {createdLinkedTask.title} · {createdLinkedTask.status}
                </p>
              ) : null}
            </div>
          ) : null}
          {proposedTasks.length > 0 ? (
            <div className="mt-2">
              <p className="text-[0.74rem] text-ink-muted">Proposed tasks:</p>
              {proposedTasks.map((task) => (
                <p key={task} className="text-[0.72rem] text-ink-faint">{task}</p>
              ))}
            </div>
          ) : null}
          {selectedSummaryPage ? (
            <div className="mt-2">
              <MemoryTrustBadge memory={selectedSummaryPage.memory} />
              <pre className="mt-1.5 max-h-24 overflow-auto border border-[var(--border-card)] rounded-md p-2 text-[0.72rem] text-ink-muted bg-black/25 whitespace-pre-wrap">
                {selectedSummaryPage.content}
              </pre>
            </div>
          ) : null}
          {isFetchingSummaryPage ? (
            <p className="mt-2 text-[0.74rem] text-ink-faint">Loading summary preview...</p>
          ) : null}
        </section>

        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Write Page</p>
          {isGeneratedWriteDraft ? (
            <div className="mb-2" aria-live="polite">
              <MemoryTrustBadge memory={{
                layer: "semantic",
                state: "generated",
                authority: "context-only",
                provenancePaths: [],
                reason: isDraftProvenanceDetached
                  ? "Generated draft edited by the operator; automatic source provenance was detached."
                  : "Generated draft; review before saving as durable memory.",
              }} />
              {isDraftProvenanceDetached ? (
                <p className="mt-1 mb-0 text-[0.68rem] text-orange">
                  Draft edited · automatic provenance detached
                </p>
              ) : null}
              {!isDraftProvenanceDetached ? (
                <p className="mt-1 mb-0 text-[0.68rem] text-ink-faint">
                  Saveable review draft · semantic intent stays in the Markdown until explicit curation
                </p>
              ) : null}
            </div>
          ) : null}
          <label className="block text-[0.74rem] text-ink-muted mb-1" htmlFor="wiki-write-path">Wiki path</label>
          <input
            id="wiki-write-path"
            value={writePath}
            onChange={(event) => setWritePath(event.target.value)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          />
          <label className="block text-[0.74rem] text-ink-muted mb-1 mt-2" htmlFor="wiki-write-content">Markdown content</label>
          <textarea
            id="wiki-write-content"
            value={writeContent}
            onChange={(event) => setWriteContent(event.target.value)}
            className="w-full min-h-20 border border-[var(--border-card)] rounded-md p-2 text-[0.8rem] bg-black/25 text-ink"
          />
          <button
            type="button"
            onClick={() => void submitWritePage()}
            disabled={!canWritePage}
            className="mt-2 border-teal/35 text-teal bg-teal/10 hover:bg-teal/20"
          >
            {isWritingWikiPage ? "Saving..." : "Save Wiki Page"}
          </button>
          {writeResult ? (
            <p className="mt-2 text-[0.74rem] text-ink-muted">Saved: {writeResult.path}</p>
          ) : null}
        </section>

        <div className="grid grid-cols-2 gap-2.5">
        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Query</p>
          <label className="block text-[0.74rem] text-ink-muted mb-1" htmlFor="wiki-query-input">Search term</label>
          <input
            id="wiki-query-input"
            value={queryInput}
            onChange={(event) => setQueryInput(event.target.value)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          />
          <label className="block text-[0.74rem] text-ink-muted mb-1 mt-2" htmlFor="wiki-query-source-type">Source type</label>
          <select
            id="wiki-query-source-type"
            value={querySourceType}
            onChange={(event) => setQuerySourceType(event.target.value as typeof querySourceType)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          >
            <option value="all">all</option>
            <option value="note">note</option>
            <option value="research">research</option>
            <option value="client">client</option>
            <option value="decision">decision</option>
            <option value="other">other</option>
          </select>
          <label className="block text-[0.74rem] text-ink-muted mb-1 mt-2" htmlFor="wiki-query-retrieval-policy">Retrieval policy</label>
          <select
            id="wiki-query-retrieval-policy"
            value={queryRetrievalPolicy}
            onChange={(event) => setQueryRetrievalPolicy(event.target.value as typeof queryRetrievalPolicy)}
            className="w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.8rem] bg-black/25 text-ink"
          >
            <option value="balanced">balanced</option>
            <option value="evidence-first">evidence first</option>
            <option value="trusted-only">trusted only</option>
          </select>
          <button
            type="button"
            onClick={submitQuery}
            disabled={!canRunQuery}
            className="mt-2 border-teal/35 text-teal bg-teal/10 hover:bg-teal/20"
          >
            {isFetchingQuery ? "Searching..." : "Query Wiki"}
          </button>
          <div className="mt-2 max-h-24 overflow-auto" aria-live="polite" aria-label="Query results">
            {queryMatches.map((match) => (
              <div key={`${match.path}-${match.snippet}`} className="mb-1">
                <p className="text-[0.74rem] text-ink-muted m-0">
                  {match.path}: {match.snippet}
                </p>
                <MemoryTrustBadge memory={match.memory} />
                <p className="mt-1 mb-0 text-[0.68rem] text-ink-faint" title={`Lexical ${match.retrieval.lexical} + trust ${match.retrieval.trustAdjustment}`}>
                  Score {match.retrieval.total} · {match.retrieval.reason}
                </p>
                <button
                  type="button"
                  className="mt-1 min-h-7 px-2.5 border border-[var(--border-card)] rounded-md text-[0.74rem] text-ink-muted"
                  onClick={() => promoteQueryMatchToDraft(match.path, match.snippet)}
                >
                  Promote to draft
                </button>
              </div>
            ))}
            {queryMatches.length === 0 && !isFetchingQuery ? (
              <p className="text-[0.74rem] text-ink-faint">No results yet.</p>
            ) : null}
          </div>
          {relatedPages.length > 0 ? (
            <div className="mt-2 border-t border-white/5 pt-2">
              <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-1.5">Related pages</p>
              <div className="grid gap-1.5 max-h-28 overflow-auto">
                {relatedPages.map((page) => (
                  <div key={page.path} className="text-[0.74rem] text-ink-muted">
                    <p className="m-0 text-ink">{page.path}</p>
                    <MemoryTrustBadge memory={page.memory} />
                    <p className="m-0 text-ink-faint">{page.reason}</p>
                    <p className="m-0 text-ink-muted">{page.summary}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {contradictions.length > 0 ? (
            <div className="mt-2 border-t border-white/5 pt-2">
              <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-orange mb-1.5">Possible contradictions</p>
              <div className="grid gap-1.5 max-h-28 overflow-auto">
                {contradictions.map((item) => (
                  <div key={`${item.primaryPath}-${item.conflictingPath}`} className="text-[0.74rem] text-ink-muted">
                    <p className="m-0 text-ink">{item.primaryPath}</p>
                    <p className="m-0 text-ink-faint">vs {item.conflictingPath}</p>
                    <p className="m-0 text-ink-muted">{item.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </section>

        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Reflection Candidates</p>
          <p className="text-[0.72rem] text-ink-faint mb-2">
            Detect repeated episodic patterns. Candidates remain generated context until explicitly reviewed.
          </p>
          <button
            type="button"
            onClick={() => void generateReflectionCandidates()}
            disabled={isGeneratingReflections}
            className="border-purple/35 text-purple bg-purple/10 hover:bg-purple/20"
          >
            {isGeneratingReflections ? "Reflecting..." : "Generate candidates"}
          </button>
          {isFetchingReflectionReview ? (
            <p className="mt-2 text-[0.7rem] text-ink-faint">Refreshing durable review queue...</p>
          ) : null}
          {scannedReflectionEpisodes !== null ? (
            <p className="mt-2 text-[0.7rem] text-ink-faint">Scanned {scannedReflectionEpisodes} episodic artifact(s).</p>
          ) : null}
          <div className="mt-2 grid gap-2" aria-live="polite" aria-label="Reflection candidates">
            {reflectionCandidates.map((candidate) => (
              <div key={candidate.id} className="border border-white/5 rounded-md p-2">
                <span
                  className="inline-flex mb-1 min-h-5 items-center rounded border border-[var(--border-card)] px-1.5 text-[0.64rem] font-bold uppercase tracking-wide text-ink-muted"
                  aria-label={`Reflection status: ${candidate.status}`}
                >
                  {candidate.status}
                </span>
                <p className="m-0 text-[0.74rem] text-ink">{candidate.pattern}</p>
                <p className="mt-1 mb-0 text-[0.68rem] text-ink-faint">
                  {candidate.occurrenceCount} episodes · {candidate.evidencePaths.join(", ")}
                </p>
                <div className="mt-1"><MemoryTrustBadge memory={candidate.memory} /></div>
                <label className="block mt-2 text-[0.68rem] text-ink-faint" htmlFor={`reflection-note-${candidate.id}`}>Operator note</label>
                <input
                  id={`reflection-note-${candidate.id}`}
                  value={reflectionNotes[candidate.id] ?? candidate.decisionNote ?? ""}
                  onChange={(event) => setReflectionNotes((current) => ({ ...current, [candidate.id]: event.target.value }))}
                  disabled={candidate.status !== "pending"}
                  className="mt-1 w-full min-h-8 border border-[var(--border-card)] rounded-md px-2 text-[0.74rem] bg-black/25 text-ink"
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={candidate.status !== "pending" || !(reflectionNotes[candidate.id] ?? candidate.decisionNote)?.trim() || activeReflectionDecisionId !== null}
                    className="min-h-7 px-2.5 border border-teal/35 rounded-md text-[0.74rem] text-teal"
                    onClick={() => void decideReflection(candidate.id, "accepted")}
                  >Accept</button>
                  <button
                    type="button"
                    disabled={candidate.status !== "pending" || !(reflectionNotes[candidate.id] ?? candidate.decisionNote)?.trim() || activeReflectionDecisionId !== null}
                    className="min-h-7 px-2.5 border border-orange/35 rounded-md text-[0.74rem] text-orange"
                    onClick={() => void decideReflection(candidate.id, "rejected")}
                  >Reject</button>
                  {candidate.status === "accepted" ? (
                    <button
                      type="button"
                      disabled={activeReflectionPromotionId !== null}
                      className="min-h-7 px-2.5 border border-purple/35 rounded-md text-[0.74rem] text-purple"
                      onClick={() => void promoteAcceptedReflection(candidate.id)}
                    >Promote accepted</button>
                  ) : null}
                </div>
                {candidate.decisionPath ? <p className="mt-2 mb-0 text-[0.68rem] text-ink-faint">Decision: {candidate.decisionPath}</p> : null}
                {candidate.promotedPath ? <p className="mt-1 mb-0 text-[0.68rem] text-teal">Promoted: {candidate.promotedPath}</p> : null}
              </div>
            ))}
            {scannedReflectionEpisodes !== null && reflectionCandidates.length === 0 ? (
              <p className="text-[0.72rem] text-ink-faint">No repeated patterns met the threshold.</p>
            ) : null}
          </div>
        </section>

        <section className="border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Lint</p>
          <button
            type="button"
            onClick={() => void runLint()}
            className="border-orange/35 text-orange bg-orange/10 hover:bg-orange/20"
          >
            {isLinting ? "Linting..." : "Run Wiki Lint"}
          </button>
          {lintSummary ? <p className="mt-2 text-[0.74rem] text-ink-muted">{lintSummary}</p> : null}
          {lintCheckedAt ? (
            <p className="mt-1 text-[0.72rem] text-ink-faint">Last run: {lintCheckedAt}</p>
          ) : null}
          <div className="mt-2 max-h-24 overflow-auto">
            {lintIssues.map((issue) => (
              <div key={`${issue.path}-${issue.code}`} className="mb-2 text-[0.74rem] text-ink-muted">
                <p className="m-0">
                  {issue.code}: <span className="text-ink">{issue.path}</span>
                </p>
                <p className="m-0 mt-0.5 text-ink-faint">{issue.message}</p>
                {issue.suggestion ? <p className="m-0 mt-0.5 text-ink-faint">Suggest: {issue.suggestion}</p> : null}
              </div>
            ))}
          </div>
        </section>
        </div>
      </div>
    </section>
  );
}
