import type { MemoryTrustMetadata } from "@atellier/shared";

const OPERATOR_CURATED_SEGMENTS = new Set(["clients", "projects", "entities", "workflows", "notes"]);

export function classifyMemoryTrust(relativePath: string, content: string): MemoryTrustMetadata {
  const normalizedPath = relativePath.replace(/\\/g, "/").replace(/^atelier\//, "");
  const provenancePaths = extractProvenancePaths(content);

  if (normalizedPath.startsWith("raw/")) {
    return {
      layer: "raw",
      state: "immutable-source",
      authority: "evidence-only",
      provenancePaths: [...new Set([normalizedPath, ...provenancePaths])].sort(),
      reason: "Immutable source evidence; preserve verbatim and interpret through reviewed memory.",
    };
  }

  if (normalizedPath.startsWith("wiki/role-memory/")) {
    return {
      layer: "learning",
      state: "verified",
      authority: "trusted",
      provenancePaths,
      reason: "Role learning is promoted only after an approved run and explicit operator curation.",
    };
  }

  if (normalizedPath.startsWith("wiki/decisions/")) {
    return {
      layer: "semantic",
      state: "verified",
      authority: "trusted",
      provenancePaths,
      reason: "Decision pages record an explicit operator decision; rejected proposals remain rejected content, not trusted proposals.",
    };
  }

  if (normalizedPath.startsWith("wiki/synthesis/")) {
    const verified = hasApprovedReview(content);
    return {
      layer: "semantic",
      state: verified ? "verified" : "generated",
      authority: verified ? "trusted" : "context-only",
      provenancePaths,
      reason: verified
        ? "Synthesis was captured from a completed, operator-approved run."
        : "Synthesis lacks explicit approved-run evidence and remains generated context.",
    };
  }

  if (normalizedPath.startsWith("wiki/sources/")) {
    return {
      layer: "semantic",
      state: "generated",
      authority: "context-only",
      provenancePaths,
      reason: "Source summary is derived from immutable raw evidence and remains unverified until curated.",
    };
  }

  if (normalizedPath.startsWith("wiki/deliverables/")) {
    const verified = hasApprovedReview(content);
    return {
      layer: "episodic",
      state: verified ? "verified" : "generated",
      authority: verified ? "trusted" : "context-only",
      provenancePaths,
      reason: verified
        ? "Deliverable belongs to an explicitly approved run."
        : "Deliverable is generated run output pending explicit approval.",
    };
  }

  if (normalizedPath.startsWith("wiki/dreams/")) {
    return {
      layer: "episodic",
      state: "generated",
      authority: "context-only",
      provenancePaths,
      reason: "Dream reports are generated proposals until an operator records a decision.",
    };
  }

  if (normalizedPath.startsWith("wiki/reflections/")) {
    return {
      layer: "semantic",
      state: "generated",
      authority: "context-only",
      provenancePaths,
      reason: "Reflection candidates are generated proposals pending an explicit operator decision.",
    };
  }

  const segment = normalizedPath.split("/")[1] ?? "";
  if (normalizedPath.startsWith("wiki/") && OPERATOR_CURATED_SEGMENTS.has(segment)) {
    return {
      layer: "semantic",
      state: "verified",
      authority: "trusted",
      provenancePaths,
      reason: "Page is stored in an operator-curated semantic Wiki category.",
    };
  }

  if (normalizedPath === "wiki/log.md" || normalizedPath.startsWith("runs/") || normalizedPath.startsWith("tasks/")) {
    return {
      layer: "episodic",
      state: "generated",
      authority: "context-only",
      provenancePaths,
      reason: "Operational history is useful evidence but does not become semantic truth automatically.",
    };
  }

  return {
    layer: "semantic",
    state: "generated",
    authority: "context-only",
    provenancePaths,
    reason: "Memory has no verified promotion signal and is treated as generated context.",
  };
}

function hasApprovedReview(content: string): boolean {
  return /^-\s*Review:\s*approved\s*$/im.test(content);
}

function extractProvenancePaths(content: string): string[] {
  const paths = Array.from(content.matchAll(
    /^-\s*(?:Raw path|Memory path|Deliverable|Report path|Evidence path|Decision path):\s*([^\s]+)\s*$/gim,
  )).map((match) => match[1]?.trim()).filter((value): value is string => Boolean(value && value !== "none"));
  return [...new Set(paths)].sort();
}
