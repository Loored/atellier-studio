import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AgentMemoryContextService,
  renderAgentMemoryContext,
  renderAgentMemoryContextReceipt,
} from "../services/agent-memory-context.service";
import { WikiService } from "../services/wiki.service";

describe("AgentMemoryContextService", () => {
  let atelierRoot: string;
  let wiki: WikiService;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-memory-context-"));
    wiki = new WikiService(atelierRoot);
    await wiki.ensureWiki();
    await Promise.all([
      mkdir(path.join(atelierRoot, "raw"), { recursive: true }),
      mkdir(path.join(atelierRoot, "wiki", "notes"), { recursive: true }),
    ]);
  });

  afterEach(async () => {
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("prioritizes direct sources, deduplicates retrieval, and scopes role memory", async () => {
    await writeFile(path.join(atelierRoot, "raw", "brief.md"), "# Brief\n\nUse cobalt launch protocol.");
    await writeFile(path.join(atelierRoot, "wiki", "notes", "launch.md"), "# Launch\n\nCobalt launch protocol is approved.");
    await writeFile(path.join(atelierRoot, "wiki", "role-memory", "builder.md"), "# Builder\n\nCobalt checks must be reproducible.");

    const service = new AgentMemoryContextService(wiki, () => new Date("2026-08-30T10:00:00.000Z"));
    const pack = await service.build({
      query: "Prepare a robust cobalt launch protocol for tomorrow",
      directSourcePaths: ["raw/brief.md"],
      role: "builder",
      roleMemoryPaths: ["wiki/role-memory/builder.md"],
    });

    expect(pack.receipt.items.map((item) => item.path)).toEqual([
      "raw/brief.md",
      "wiki/role-memory/builder.md",
      "wiki/notes/launch.md",
    ]);
    expect(pack.receipt.items[1]).toMatchObject({ applicableRole: "builder", source: "retrieval" });
    expect(pack.receipt.excluded).toContainEqual({ path: "raw/brief.md", reason: "duplicate" });
    expect(pack.renderedContext).toContain("[EVIDENCE] raw/brief.md");
    expect(pack.renderedContext).toContain("[TRUSTED MEMORY] wiki/role-memory/builder.md");
    expect(pack.verifiedFiles).toEqual(["raw/brief.md"]);
  });

  it("keeps role-scoped memory out of other orchestration steps", async () => {
    await writeFile(path.join(atelierRoot, "wiki", "role-memory", "builder.md"), "# Builder\n\nBuilder-only contract.");
    await writeFile(path.join(atelierRoot, "wiki", "role-memory", "qa.md"), "# QA\n\nQA-only checklist.");

    const service = new AgentMemoryContextService(wiki);
    const pack = await service.build({
      query: "prepare and verify the work",
      roles: ["builder", "qa"],
    });

    expect(pack.receipt.items.map((item) => item.applicableRole)).toEqual(["builder", "qa"]);
    expect(renderAgentMemoryContext(pack.receipt, "builder")).toContain("Builder-only contract.");
    expect(renderAgentMemoryContext(pack.receipt, "builder")).not.toContain("QA-only checklist.");
    expect(renderAgentMemoryContext(pack.receipt, "qa")).toContain("QA-only checklist.");
    expect(renderAgentMemoryContext(pack.receipt, "qa")).not.toContain("Builder-only contract.");
  });

  it("excludes autonomously retrieved generated context but labels a linked summary non-authoritative", async () => {
    const generated = [
      "# Draft",
      "",
      "- Trust source: generic-write",
      "",
      "Cobalt launch protocol is speculative.",
    ].join("\n");
    await writeFile(path.join(atelierRoot, "wiki", "notes", "draft.md"), generated);

    const service = new AgentMemoryContextService(wiki);
    const autonomous = await service.build({ query: "cobalt launch protocol" });
    expect(autonomous.receipt.items).toEqual([]);
    expect(autonomous.receipt.excluded).toContainEqual({ path: "wiki/notes/draft.md", reason: "context-only" });

    const linked = await service.build({
      query: "unrelated",
      directSourcePaths: ["wiki/notes/draft.md", "wiki/notes/missing.md"],
    });
    expect(linked.renderedContext).toContain("[NON-AUTHORITATIVE CONTEXT] wiki/notes/draft.md");
    expect(linked.receipt.excluded).toContainEqual({ path: "wiki/notes/missing.md", reason: "not-found" });
  });

  it("applies byte budgets in priority order and records truncation", async () => {
    await writeFile(path.join(atelierRoot, "raw", "first.md"), "abcdefghij");
    await writeFile(path.join(atelierRoot, "raw", "second.md"), "klmnopqrst");
    const service = new AgentMemoryContextService(wiki);
    const pack = await service.build({
      query: "nothing matches",
      directSourcePaths: ["raw/first.md", "raw/second.md"],
      budgets: { totalBytes: 7, perItemBytes: 5, maxRetrievalItems: 2 },
    });

    expect(pack.receipt.items.map((item) => ({ path: item.path, excerpt: item.excerpt }))).toEqual([
      { path: "raw/first.md", excerpt: "abcde" },
      { path: "raw/second.md", excerpt: "kl" },
    ]);
    expect(pack.receipt.items.every((item) => item.truncated)).toBe(true);
    expect(pack.receipt.items.reduce((sum, item) => sum + item.includedBytes, 0)).toBe(7);
  });

  it("produces a frozen receipt with a stable hash independent of creation time", async () => {
    await writeFile(path.join(atelierRoot, "raw", "brief.md"), "stable evidence");
    const first = await new AgentMemoryContextService(wiki, () => new Date("2026-08-30T10:00:00.000Z"))
      .build({ query: "stable", directSourcePaths: ["raw/brief.md"] });
    const second = await new AgentMemoryContextService(wiki, () => new Date("2026-08-31T10:00:00.000Z"))
      .build({ query: "stable", directSourcePaths: ["raw/brief.md"] });

    expect(first.receipt.createdAt).not.toBe(second.receipt.createdAt);
    expect(first.receipt.stableHash).toBe(second.receipt.stableHash);
    expect(Object.isFrozen(first.receipt)).toBe(true);
    expect(Object.isFrozen(first.receipt.items)).toBe(true);
    expect(renderAgentMemoryContextReceipt(first.receipt)).toContain(first.receipt.stableHash);
  });

  it("writes receipt artifacts idempotently and rejects conflicting retries", async () => {
    await expect(wiki.writeContextReceiptArtifact("run-1", "same receipt")).resolves
      .toBe("runs/context/run-1-memory-context.md");
    await expect(wiki.writeContextReceiptArtifact("run-1", "same receipt")).resolves
      .toBe("runs/context/run-1-memory-context.md");
    await expect(wiki.writeContextReceiptArtifact("run-1", "different receipt")).rejects
      .toThrow("already exists with different content");
  });
});
