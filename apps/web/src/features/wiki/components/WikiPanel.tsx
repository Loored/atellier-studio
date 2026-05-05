import { BookOpenText } from "lucide-react";
import { useWikiPanel } from "../hooks/useWikiPanel";

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
    setQueryInput,
    setQuerySourceType,
    queryMatches,
    isFetchingQuery,
    isIngesting,
    ingestResult,
    proposedTasks,
    selectedSummaryPage,
    isFetchingSummaryPage,
    isLinting,
    lintIssues,
    lintSummary,
    lintCheckedAt,
    canRunIngest,
    canRunQuery,
    submitIngest,
    selectIngestSummary,
    submitQuery,
    runLint,
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
        <p className="m-0 border border-dashed border-purple/[0.18] rounded-lg p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
          Loading wiki
        </p>
      ) : null}

      <pre
        className="min-h-[120px] max-h-[240px] overflow-auto border border-[var(--border-card)] rounded-lg p-3 text-ink-muted bg-black/25 whitespace-pre-wrap text-[0.78rem] font-mono leading-relaxed m-0"
        aria-label="Latest wiki log entries"
      >
        {latestLog || "No wiki log entries yet"}
      </pre>

      <div className="mt-3.5 grid grid-cols-12 gap-3">
        <section className="col-span-12 lg:col-span-4 border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
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
            className="mt-2 min-h-8 px-3 border border-purple/35 rounded-md text-[0.78rem] font-semibold text-purple disabled:opacity-50"
          >
            {isIngesting ? "Ingesting..." : "Ingest Source"}
          </button>
          {ingestResult ? (
            <div className="mt-2">
              <p className="text-[0.74rem] text-ink-muted">Saved: {ingestResult.summaryPagePath}</p>
              <button
                type="button"
                onClick={selectIngestSummary}
                className="mt-1 min-h-7 px-2.5 border border-[var(--border-card)] rounded-md text-[0.74rem] text-ink-muted"
              >
                Preview summary
              </button>
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
            <pre className="mt-2 max-h-24 overflow-auto border border-[var(--border-card)] rounded-md p-2 text-[0.72rem] text-ink-muted bg-black/25 whitespace-pre-wrap">
              {selectedSummaryPage.content}
            </pre>
          ) : null}
          {isFetchingSummaryPage ? (
            <p className="mt-2 text-[0.74rem] text-ink-faint">Loading summary preview...</p>
          ) : null}
        </section>

        <section className="col-span-12 lg:col-span-4 border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
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
          <button
            type="button"
            onClick={submitQuery}
            disabled={!canRunQuery}
            className="mt-2 min-h-8 px-3 border border-teal/35 rounded-md text-[0.78rem] font-semibold text-teal disabled:opacity-50"
          >
            {isFetchingQuery ? "Searching..." : "Query Wiki"}
          </button>
          <div className="mt-2 max-h-24 overflow-auto">
            {queryMatches.map((match) => (
              <p key={`${match.path}-${match.snippet}`} className="text-[0.74rem] text-ink-muted mb-1">
                {match.path}: {match.snippet}
              </p>
            ))}
            {queryMatches.length === 0 && !isFetchingQuery ? (
              <p className="text-[0.74rem] text-ink-faint">No results yet.</p>
            ) : null}
          </div>
        </section>

        <section className="col-span-12 lg:col-span-4 border border-[var(--border-card)] rounded-lg p-3 bg-white/[0.02]">
          <p className="text-[0.68rem] font-bold tracking-[0.1em] uppercase text-purple mb-2">Lint</p>
          <button
            type="button"
            onClick={() => void runLint()}
            className="min-h-8 px-3 border border-orange/35 rounded-md text-[0.78rem] font-semibold text-orange"
          >
            {isLinting ? "Linting..." : "Run Wiki Lint"}
          </button>
          {lintSummary ? <p className="mt-2 text-[0.74rem] text-ink-muted">{lintSummary}</p> : null}
          {lintCheckedAt ? (
            <p className="mt-1 text-[0.72rem] text-ink-faint">Last run: {lintCheckedAt}</p>
          ) : null}
          <div className="mt-2 max-h-24 overflow-auto">
            {lintIssues.map((issue) => (
              <p key={`${issue.path}-${issue.code}`} className="text-[0.74rem] text-ink-muted mb-1">
                {issue.code}: {issue.path}
              </p>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
