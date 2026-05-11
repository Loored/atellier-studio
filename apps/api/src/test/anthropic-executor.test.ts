import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@atellier/shared";
import { AnthropicAgentExecutorService } from "../services/agent-executor.service";

const fixtureAgent: Agent = {
  id: "agent-1",
  name: "Pia",
  role: "pm",
  status: "idle",
  instructions: "Always include a risk note.",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("AnthropicAgentExecutorService", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts a /v1/messages request with cache_control on the system prompt and parses the assistant text", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "msg_test",
        type: "message",
        role: "assistant",
        model: "claude-opus-4-7",
        stop_reason: "end_turn",
        content: [{ type: "text", text: "Plan ready." }],
        usage: { input_tokens: 50, output_tokens: 5, cache_creation_input_tokens: 40 },
      }),
    );

    const executor = new AnthropicAgentExecutorService({
      apiKey: "sk-ant-test",
      model: "claude-opus-4-7",
      repoFileHints: ["apps/api/src/services/wiki.service.ts"],
    });

    const result = await executor.execute({
      agent: fixtureAgent,
      instruction: "Draft the migration plan.",
      context: "Mongo cluster v6.",
    });

    expect(result).toEqual({ response: "Plan ready.", needsHuman: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.anthropic.com/v1/messages");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers["x-api-key"]).toBe("sk-ant-test");
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as {
      model: string;
      max_tokens: number;
      system: Array<{ type: string; text: string; cache_control?: { type: string } }>;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("claude-opus-4-7");
    expect(body.max_tokens).toBeGreaterThan(0);
    expect(body.system).toHaveLength(1);
    expect(body.system[0].cache_control).toEqual({ type: "ephemeral" });
    expect(body.system[0].text).toContain("Pia");
    expect(body.system[0].text).toContain("apps/api/src/services/wiki.service.ts");
    expect(body.system[0].text).toContain("Always include a risk note.");
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].role).toBe("user");
    expect(body.messages[0].content).toContain("Draft the migration plan.");
    expect(body.messages[0].content).toContain("Mongo cluster v6.");
  });

  it("throws a descriptive error when the API responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } },
        { status: 401 },
      ),
    );

    const executor = new AnthropicAgentExecutorService({
      apiKey: "sk-ant-bad",
      model: "claude-opus-4-7",
    });

    await expect(
      executor.execute({ agent: fixtureAgent, instruction: "anything" }),
    ).rejects.toThrow(/Anthropic execution failed \(401\).*invalid x-api-key/);
  });

  it("throws when the API returns no text content", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "msg_empty",
        type: "message",
        role: "assistant",
        content: [],
        stop_reason: "max_tokens",
      }),
    );

    const executor = new AnthropicAgentExecutorService({
      apiKey: "sk-ant-test",
      model: "claude-opus-4-7",
    });

    await expect(
      executor.execute({ agent: fixtureAgent, instruction: "anything" }),
    ).rejects.toThrow(/empty response.*max_tokens/);
  });
});
