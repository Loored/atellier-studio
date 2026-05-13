import { useMemo } from "react";
import { cn } from "../../../lib/cn";

type Props = {
  timestamps: ReadonlyArray<string>;
  value: number | null;
  onChange: (next: number | null) => void;
};

export function TimelineSlider({ timestamps, value, onChange }: Props) {
  const range = useMemo(() => {
    if (timestamps.length === 0) return null;
    const millis = timestamps
      .map((iso) => Date.parse(iso))
      .filter((n) => !Number.isNaN(n))
      .sort((a, b) => a - b);
    if (millis.length === 0) return null;
    return { min: millis[0]!, max: millis[millis.length - 1]! };
  }, [timestamps]);

  if (!range || range.max === range.min) return null;

  const cursor = value ?? range.max;
  const isLive = value === null || cursor >= range.max;
  const percent = ((cursor - range.min) / (range.max - range.min)) * 100;

  return (
    <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
      <span className="text-[0.62rem] uppercase tracking-wider text-ink-faint">
        {new Date(range.min).toLocaleDateString()}
      </span>
      <input
        type="range"
        min={range.min}
        max={range.max}
        step={Math.max(1, Math.floor((range.max - range.min) / 200))}
        value={cursor}
        onChange={(event) => {
          const next = Number(event.target.value);
          onChange(next >= range.max ? null : next);
        }}
        className="h-1 w-44 cursor-pointer appearance-none rounded-full bg-white/10 accent-violet-400"
        style={{
          background: `linear-gradient(to right, rgba(167,139,250,0.7) 0%, rgba(167,139,250,0.7) ${percent}%, rgba(255,255,255,0.08) ${percent}%, rgba(255,255,255,0.08) 100%)`,
        }}
      />
      <span className="text-[0.62rem] uppercase tracking-wider text-ink-faint">
        {new Date(range.max).toLocaleDateString()}
      </span>
      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-[0.62rem] font-bold uppercase tracking-wider",
          isLive ? "bg-emerald-400/15 text-emerald-200" : "bg-amber-400/15 text-amber-200",
        )}
      >
        {isLive ? "Live" : new Date(cursor).toLocaleString()}
      </span>
      {!isLive && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[0.65rem] text-ink-muted hover:text-ink"
          aria-label="Volver a vivo"
        >
          ↻
        </button>
      )}
    </div>
  );
}
