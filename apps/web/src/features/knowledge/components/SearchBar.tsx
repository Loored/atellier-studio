import { useEffect, useRef, useState } from "react";
import type { KnowledgeGraphNode } from "@atellier/shared";
import { cn } from "../../../lib/cn";

type Props = {
  query: string;
  onQueryChange: (value: string) => void;
  matches: KnowledgeGraphNode[];
  onPick: (id: string) => void;
};

export function SearchBar({ query, onQueryChange, matches, onPick }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setCursor(0);
  }, [matches]);

  function commit(id: string) {
    onPick(id);
    setOpen(false);
    inputRef.current?.blur();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") {
      onQueryChange("");
      setOpen(false);
      inputRef.current?.blur();
      return;
    }
    if (matches.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setCursor((c) => (c + 1) % matches.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setCursor((c) => (c - 1 + matches.length) % matches.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const target = matches[cursor];
      if (target) commit(target.id);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-3 py-1.5">
        <span className="text-xs text-ink-faint">⌘K</span>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(event) => {
            onQueryChange(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Buscar nodos…"
          className="w-56 bg-transparent text-sm text-ink outline-none placeholder:text-ink-faint"
        />
        {query && (
          <button
            type="button"
            onClick={() => onQueryChange("")}
            className="text-xs text-ink-faint hover:text-ink-muted"
            aria-label="Limpiar búsqueda"
          >
            ✕
          </button>
        )}
      </div>
      {open && query.trim().length > 0 && (
        <div className="absolute right-0 top-full z-30 mt-1 max-h-72 w-80 overflow-y-auto rounded-md border border-white/10 bg-[rgba(8,11,24,0.97)] shadow-xl shadow-black/40">
          {matches.length === 0 && (
            <p className="px-3 py-2 text-xs text-ink-faint">Sin coincidencias.</p>
          )}
          {matches.map((node, index) => (
            <button
              key={node.id}
              type="button"
              onMouseDown={(event) => {
                event.preventDefault();
                commit(node.id);
              }}
              className={cn(
                "block w-full border-b border-white/5 px-3 py-2 text-left text-xs last:border-b-0 hover:bg-white/5",
                index === cursor && "bg-white/10",
              )}
            >
              <p className="truncate font-bold text-ink">{node.label}</p>
              <p className="mt-0.5 truncate text-[0.65rem] uppercase tracking-wider text-ink-faint">
                {node.type} · {node.layer} · {node.quality}
              </p>
              {node.path && <p className="mt-0.5 truncate text-[0.65rem] text-ink-muted">{node.path}</p>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
