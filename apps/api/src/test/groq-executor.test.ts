import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@atellier/shared";
import { GroqAgentExecutorService } from "../services/agent-executor.service";

const fixtureAgent: Agent = {
  id: "agent-1",
  name: "Pia",
  role: "pm",
  status: "idle",
  instructions: "Always include a one-line risk note.",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("GroqAgentExecutorService", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts an OpenAI-compatible chat completion request to Groq with bearer auth", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "chatcmpl_test",
        object: "chat.completion",
        model: "llama-3.3-70b-versatile",
        choices: [
          { index: 0, message: { role: "assistant", content: "Plan ready." }, finish_reason: "stop" },
        ],
      }),
    );

    const executor = new GroqAgentExecutorService({
      apiKey: "gsk_test",
      model: "llama-3.3-70b-versatile",
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
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(init.method).toBe("POST");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer gsk_test");
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(body.model).toBe("llama-3.3-70b-versatile");
    expect(body.messages).toHaveLength(2);
    expect(body.messages[0].role).toBe("system");
    expect(body.messages[0].content).toContain("Pia");
    expect(body.messages[0].content).toContain("apps/api/src/services/wiki.service.ts");
    expect(body.messages[0].content).toContain("Always include a one-line risk note.");
    expect(body.messages[1].role).toBe("user");
    expect(body.messages[1].content).toContain("Draft the migration plan.");
    expect(body.messages[1].content).toContain("Mongo cluster v6.");
  });

  it("throws a Groq-labeled error when the API responds with a non-2xx status", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: { message: "invalid api key", type: "invalid_request_error" } },
        { status: 401 },
      ),
    );

    const executor = new GroqAgentExecutorService({
      apiKey: "gsk_bad",
      model: "llama-3.3-70b-versatile",
    });

    await expect(
      executor.execute({ agent: fixtureAgent, instruction: "anything" }),
    ).rejects.toThrow(/Groq execution failed \(401\).*invalid api key/);
  });

  it("throws when Groq returns an empty assistant message", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [{ index: 0, message: { role: "assistant", content: "" }, finish_reason: "length" }],
      }),
    );

    const executor = new GroqAgentExecutorService({
      apiKey: "gsk_test",
      model: "llama-3.3-70b-versatile",
    });

    await expect(
      executor.execute({ agent: fixtureAgent, instruction: "anything" }),
    ).rejects.toThrow(/Groq returned an empty response.*length/);
  });
});

export {};
