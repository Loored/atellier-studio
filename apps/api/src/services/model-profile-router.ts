import type { ModelProfile } from "@atellier/shared";

const DEEP_SIGNAL = /\b(architecture|architectural|migration|security|production|critical|concurren|mongo|database|multi[- ]?step|complex|incident|rollback)\b/i;
const CHEAP_SIGNAL = /\b(rename|format|typo|spelling|simple|status|check|summarize|resumen)\b/i;

/** Conservative, deterministic routing. Explicit profile overrides are handled by callers. */
export function classifyModelProfile(goal: string, context = ""): ModelProfile {
  const text = `${goal}\n${context}`.trim();
  if (DEEP_SIGNAL.test(text)) return "deep";
  if (CHEAP_SIGNAL.test(text) && text.length <= 500) return "cheap";
  return "standard";
}
