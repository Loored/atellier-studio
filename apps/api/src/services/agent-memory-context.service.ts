import { createHash } from "node:crypto";
import type {
  AgentMemoryContextBudgets,
  AgentMemoryContextExcludedPath,
  AgentMemoryContextItem,
  AgentMemoryContextPack,
  AgentMemoryContextPackInput,
  AgentMemoryContextReceipt,
  WikiQueryMatch,
} from "@atellier/shared";
import { WikiService } from "./wiki.service";

const DEFAULT_BUDGETS: AgentMemoryContextBudgets = {
  totalBytes: 16_000,
  perItemBytes: 4_000,
  maxRetrievalItems: 6,
};

export class AgentMemoryContextService {
  constructor(
    private readonly wiki: WikiService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async build(input: AgentMemoryContextPackInput): Promise<AgentMemoryContextPack> {
    const query = input.query.trim();
    if (!query) throw new Error("Memory context query is required.");

    const policy = input.retrievalPolicy ?? "evidence-first";
    const budgets = this.normalizeBudgets(input.budgets);
    const items: AgentMemoryContextItem[] = [];
    const excluded: AgentMemoryContextExcludedPath[] = [];
    const seen = new Set<string>();
    let remainingBytes = budgets.totalBytes;

    for (const requestedPath of input.directSourcePaths ?? []) {
      const normalizedPath = normalizePath(requestedPath);
      if (seen.has(normalizedPath)) {
        excluded.push({ path: normalizedPath, reason: "duplicate" });
        continue;
      }
      seen.add(normalizedPath);
      try {
        const page = await this.wiki.readPage(normalizedPath);
        const result = this.makeItem("direct", page.path, page.content, page.memory, budgets.perItemBytes, remainingBytes);
        if (!result) {
          excluded.push({ path: page.path, reason: "budget-exhausted" });
          continue;
        }
        items.push(result);
        remainingBytes -= result.includedBytes;
      } catch {
        excluded.push({ path: normalizedPath, reason: "not-found" });
      }
    }

    const roleMemoryPaths = [...new Set([
      ...(input.role ? [`wiki/role-memory/${input.role}.md`] : []),
      ...(input.roles ?? []).map((role) => `wiki/role-memory/${role}.md`),
      ...(input.roleMemoryPaths ?? []),
    ].map(normalizePath))];
    for (const roleMemoryPath of roleMemoryPaths) {
      const normalizedPath = normalizePath(roleMemoryPath);
      if (seen.has(normalizedPath)) {
        excluded.push({ path: normalizedPath, reason: "duplicate" });
        continue;
      }
      seen.add(normalizedPath);
      try {
        const page = await this.wiki.readPage(normalizedPath);
        if (page.memory.authority !== "trusted") {
          excluded.push({ path: page.path, reason: "context-only" });
          continue;
        }
        const applicableRole = input.roles?.find((role) => normalizedPath === `wiki/role-memory/${role}.md`)
          ?? input.role;
        const result = this.makeItem(
          "retrieval",
          page.path,
          page.content,
          page.memory,
          budgets.perItemBytes,
          remainingBytes,
          {
            path: page.path,
            snippet: "",
            memory: page.memory,
            retrieval: {
              lexical: 0,
              trustAdjustment: 3,
              total: 3,
              reason: `Included as explicit role-scoped trusted memory for ${applicableRole ?? "the current step"}.`,
            },
          },
          applicableRole,
        );
        if (!result) {
          excluded.push({ path: page.path, reason: "budget-exhausted" });
          continue;
        }
        items.push(result);
        remainingBytes -= result.includedBytes;
      } catch {
        excluded.push({ path: normalizedPath, reason: "not-found" });
      }
    }

    const retrievalMatches = await this.retrieveBySignificantPhrases(query, policy, budgets.maxRetrievalItems);

    for (const match of retrievalMatches) {
      const normalizedPath = normalizePath(match.path);
      if (seen.has(normalizedPath)) {
        excluded.push({ path: normalizedPath, reason: "duplicate" });
        continue;
      }
      seen.add(normalizedPath);
      if (match.memory.authority === "context-only") {
        excluded.push({ path: normalizedPath, reason: "context-only" });
        continue;
      }
      try {
        const page = await this.wiki.readPage(normalizedPath);
        const result = this.makeItem(
          "retrieval",
          page.path,
          page.content,
          page.memory,
          budgets.perItemBytes,
          remainingBytes,
          match,
        );
        if (!result) {
          excluded.push({ path: page.path, reason: "budget-exhausted" });
          continue;
        }
        items.push(result);
        remainingBytes -= result.includedBytes;
      } catch {
        excluded.push({ path: normalizedPath, reason: "not-found" });
      }
    }

    const stableFields = { schemaVersion: 1 as const, query, policy, budgets, items, excluded };
    const receipt: AgentMemoryContextReceipt = {
      ...stableFields,
      createdAt: this.now().toISOString(),
      stableHash: sha256(stableJson(stableFields)),
    };
    const frozenReceipt = deepFreeze(receipt);

    return {
      receipt: frozenReceipt,
      renderedContext: renderAgentMemoryContext(frozenReceipt, input.role),
      verifiedFiles: verifiedFilesForAgentMemoryContext(frozenReceipt, input.role),
    };
  }

  private makeItem(
    source: AgentMemoryContextItem["source"],
    itemPath: string,
    content: string,
    memory: AgentMemoryContextItem["memory"],
    perItemBytes: number,
    remainingBytes: number,
    match?: WikiQueryMatch,
    applicableRole?: AgentMemoryContextItem["applicableRole"],
  ): AgentMemoryContextItem | undefined {
    const allowedBytes = Math.min(perItemBytes, remainingBytes);
    if (allowedBytes <= 0) return undefined;
    const excerpt = truncateUtf8(content, allowedBytes);
    return {
      source,
      path: normalizePath(itemPath),
      memory,
      ...(match ? { retrieval: match.retrieval } : {}),
      ...(applicableRole ? { applicableRole } : {}),
      contentSha256: sha256(content),
      originalBytes: Buffer.byteLength(content),
      includedBytes: Buffer.byteLength(excerpt),
      truncated: Buffer.byteLength(excerpt) < Buffer.byteLength(content),
      excerpt,
    };
  }

  private async retrieveBySignificantPhrases(
    query: string,
    policy: NonNullable<AgentMemoryContextPackInput["retrievalPolicy"]>,
    limit: number,
  ): Promise<WikiQueryMatch[]> {
    const significantTerms = [...new Set(query.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}._-]{2,}/gu) ?? [])]
      .sort((left, right) => right.length - left.length || left.localeCompare(right))
      .slice(0, 4);
    const phrases = [...new Set([query, ...significantTerms])];
    const merged = new Map<string, WikiQueryMatch>();
    for (const phrase of phrases) {
      const response = await this.wiki.query({ query: phrase, limit, retrievalPolicy: policy }, { appendLog: false });
      for (const match of response.matches) {
        const existing = merged.get(match.path);
        if (!existing || match.retrieval.total > existing.retrieval.total) merged.set(match.path, match);
      }
    }
    return [...merged.values()]
      .sort((left, right) => right.retrieval.total - left.retrieval.total || left.path.localeCompare(right.path))
      .slice(0, limit);
  }

  private normalizeBudgets(input: AgentMemoryContextPackInput["budgets"]): AgentMemoryContextBudgets {
    const positiveInteger = (value: number | undefined, fallback: number) =>
      Number.isInteger(value) && (value ?? 0) > 0 ? value! : fallback;
    return {
      totalBytes: positiveInteger(input?.totalBytes, DEFAULT_BUDGETS.totalBytes),
      perItemBytes: positiveInteger(input?.perItemBytes, DEFAULT_BUDGETS.perItemBytes),
      maxRetrievalItems: Math.min(20, positiveInteger(input?.maxRetrievalItems, DEFAULT_BUDGETS.maxRetrievalItems)),
    };
  }
}

export function renderAgentMemoryContext(
  receipt: AgentMemoryContextReceipt,
  role?: AgentMemoryContextItem["applicableRole"],
): string {
  const items = receipt.items.filter((item) => !item.applicableRole || item.applicableRole === role);
  if (items.length === 0) return "No verified evidence or trusted memory was available.";
  return items.map((item) => {
    const label = item.source === "direct" && item.memory.authority === "context-only"
      ? "NON-AUTHORITATIVE CONTEXT"
      : item.source === "direct" || item.memory.authority === "evidence-only"
        ? "EVIDENCE"
        : "TRUSTED MEMORY";
    return [`## [${label}] ${item.path}`, item.excerpt].join("\n\n");
  }).join("\n\n---\n\n");
}

export function verifiedFilesForAgentMemoryContext(
  receipt: AgentMemoryContextReceipt,
  role?: AgentMemoryContextItem["applicableRole"],
): string[] {
  return receipt.items
    .filter((item) => !item.applicableRole || item.applicableRole === role)
    .filter((item) => item.source === "direct" || item.memory.authority === "evidence-only")
    .map((item) => item.path);
}

export function renderAgentMemoryContextReceipt(receipt: AgentMemoryContextReceipt): string {
  const lines = [
    "# Agent Memory Context Receipt",
    "",
    `- Schema version: ${receipt.schemaVersion}`,
    `- Query: ${receipt.query}`,
    `- Policy: ${receipt.policy}`,
    `- Created at: ${receipt.createdAt}`,
    `- Stable hash: ${receipt.stableHash}`,
    `- Total budget: ${receipt.budgets.totalBytes} bytes`,
    `- Per-item budget: ${receipt.budgets.perItemBytes} bytes`,
    "",
    "## Included items",
    "",
    ...receipt.items.flatMap((item) => [
      `### ${item.path}`,
      "",
      `- Source: ${item.source}`,
      `- Authority: ${item.memory.authority}`,
      `- Trust: ${item.memory.state}`,
      `- Content SHA-256: ${item.contentSha256}`,
      `- Bytes: ${item.includedBytes}/${item.originalBytes}${item.truncated ? " (truncated)" : ""}`,
      ...(item.applicableRole ? [`- Applicable role: ${item.applicableRole}`] : []),
      ...(item.retrieval ? [`- Selection: ${item.retrieval.reason}`, `- Retrieval score: ${item.retrieval.total}`] : ["- Selection: Direct task source."]),
      "",
    ]),
    "## Excluded paths",
    "",
    ...(receipt.excluded.length
      ? receipt.excluded.map((entry) => `- ${entry.path}: ${entry.reason}`)
      : ["- None"]),
    "",
  ];
  return lines.join("\n");
}

function truncateUtf8(content: string, maxBytes: number): string {
  const buffer = Buffer.from(content);
  if (buffer.byteLength <= maxBytes) return content;
  return buffer.subarray(0, maxBytes).toString("utf8").replace(/\uFFFD$/u, "");
}

function normalizePath(value: string): string {
  return value.trim().replace(/\\/g, "/").replace(/^atelier\//, "");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
