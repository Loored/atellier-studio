import { WikiPanel } from "./components/WikiPanel";

export function WikiView() {
  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      <div className="mb-5">
        <p className="eyebrow">Memory</p>
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">Wiki</h1>
      </div>
      <WikiPanel />
    </div>
  );
}
