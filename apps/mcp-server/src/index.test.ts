import { afterEach, describe, expect, it, vi } from "vitest";
import { handleWikiQuery, TOOLS } from "./index";

describe("Atellier MCP wiki query", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("declares and forwards the same retrieval policies as the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ query: "memory", matches: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const definition = TOOLS.find((tool) => tool.name === "wiki_query");
    expect(definition?.inputSchema.properties?.retrievalPolicy).toMatchObject({
      enum: ["balanced", "evidence-first", "trusted-only"],
    });

    await handleWikiQuery({ query: "memory", sourceType: "decision", retrievalPolicy: "trusted-only" });

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:4000/wiki/query", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ query: "memory", sourceType: "decision", retrievalPolicy: "trusted-only" }),
    }));
  });

  it("rejects invalid policy values before calling the API", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await handleWikiQuery({ query: "memory", retrievalPolicy: "untrusted" });

    expect(result.isError).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
