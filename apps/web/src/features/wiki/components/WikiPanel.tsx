import { BookOpenText } from "lucide-react";
import { useWikiPanel } from "../hooks/useWikiPanel";

export function WikiPanel() {
  const { wikiIndex, wikiLog, latestLog, isLoadingWikiIndexWithoutCache, isLoadingWikiLogWithoutCache } = useWikiPanel();

  const isLoadingWiki = isLoadingWikiIndexWithoutCache || isLoadingWikiLogWithoutCache;

  return (
    <section className="panel panel-wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Memory</p>
          <h2>Wiki Log</h2>
        </div>
        <div className="wiki-ready">
          <BookOpenText size={18} />
          <span>{wikiIndex?.ready && wikiLog?.ready ? "Ready" : "Checking"}</span>
        </div>
      </div>

      {isLoadingWiki ? <p className="empty-state">Loading wiki</p> : null}

      <pre className="wiki-log" aria-label="Latest wiki log entries">{latestLog || "No wiki log entries yet"}</pre>
    </section>
  );
}
