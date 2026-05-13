import { useEffect, useState } from "react";

function formatRelative(deltaMs: number): string {
  if (deltaMs < 5_000) return "ahora mismo";
  const seconds = Math.round(deltaMs / 1000);
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.round(hours / 24)} d`;
}

export function LiveTimestamp({ timestamp }: { timestamp: number | null | undefined }) {
  const [, force] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => force((n) => n + 1), 5_000);
    return () => window.clearInterval(id);
  }, []);

  if (!timestamp) return <span>—</span>;
  return <span>{formatRelative(Date.now() - timestamp)}</span>;
}
