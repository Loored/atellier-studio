import { AgentsPanel } from "./components/AgentsPanel";

export function AgentsView() {
  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      <div className="mb-5">
        <p className="eyebrow">Roster</p>
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">Agents</h1>
      </div>
      <div className="max-w-xl">
        <AgentsPanel />
      </div>
    </div>
  );
}
