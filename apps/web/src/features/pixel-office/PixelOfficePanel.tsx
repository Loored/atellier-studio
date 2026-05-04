import { Monitor } from "lucide-react";
import { useAgentsApi } from "../../api/hooks/agents/useAgentsApi";
import { agentsToPixelCharacters } from "./hooks/usePixelOffice";
import { PixelOfficeCanvas } from "./PixelOfficeCanvas";

export function PixelOfficePanel() {
  const { data: agents = [], isLoadingWithoutCache } = useAgentsApi();
  const characters = agentsToPixelCharacters(agents);

  return (
    <section className="panel panel-wide">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Live</p>
          <h2>Pixel Office</h2>
        </div>
        <div className="panel-actions">
          <Monitor size={16} />
          <span className="panel-chip">{agents.length} agents</span>
        </div>
      </div>

      {isLoadingWithoutCache ? (
        <p className="empty-state">Loading office…</p>
      ) : agents.length === 0 ? (
        <p className="empty-state">No agents yet — add one to populate the office.</p>
      ) : (
        <PixelOfficeCanvas characters={characters} />
      )}
    </section>
  );
}
