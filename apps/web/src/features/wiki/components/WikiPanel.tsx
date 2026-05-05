import { BookOpenText } from "lucide-react";
import { useWikiPanel } from "../hooks/useWikiPanel";

export function WikiPanel() {
  const { wikiIndex, wikiLog, latestLog, isLoadingWikiIndexWithoutCache, isLoadingWikiLogWithoutCache } = useWikiPanel();

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
    </section>
  );
}
