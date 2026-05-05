import { RunsTimeline } from "./components/RunsTimeline";

export function RunsView() {
  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      <div className="mb-5">
        <p className="eyebrow">Execution</p>
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">Runs</h1>
      </div>
      <div className="max-w-3xl">
        <RunsTimeline />
      </div>
    </div>
  );
}
