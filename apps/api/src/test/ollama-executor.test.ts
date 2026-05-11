import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@atellier/shared";
import { OllamaAgentExecutorService } from "../services/agent-executor.service";

const fixtureAgent: Agent = {
  id: "agent-1",
  name: "Pia",
  role: "pm",
  status: "idle",
  createdAt: "2026-05-10T00:00:00.000Z",
  updatedAt: "2026-05-10T00:00:00.000Z",
};

function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
  });
}

describe("OllamaAgentExecutorService", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("posts to the local Ollama OpenAI-compat endpoint without auth header by default", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        id: "chatcmpl_local",
        model: "llama3.2",
        choices: [
          { index: 0, message: { role: "assistant", content: "Local plan ready." }, finish_reason: "stop" },
        ],
      }),
    );

    const executor = new OllamaAgentExecutorService({
      model: "llama3.2",
    });

    const result = await executor.execute({
      agent: fixtureAgent,
      instruction: "Draft the plan.",
    });

    expect(result).toEqual({ response: "Local plan ready.", needsHuman: true });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://127.0.0.1:11434/v1/chat/completions");

    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Content-Type"]).toBe("application/json");

    const body = JSON.parse(init.body as string) as { model: string };
    expect(body.model).toBe("llama3.2");
  });

  it("honors a custom baseUrl and trims trailing slashes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        choices: [
          { index: 0, message: { role: "assistant", content: "ok" }, finish_reason: "stop" },
        ],
      }),
    );

    const executor = new OllamaAgentExecutorService({
      baseUrl: "http://my-host:9999/",
      model: "mistral",
    });

    await executor.execute({ agent: fixtureAgent, instruction: "ping" });

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://my-host:9999/v1/chat/completions");
  });

  it("throws an Ollama-labeled error on a non-2xx response", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(
        { error: "model 'mystery' not found, pull it first" },
        { status: 404 },
      ),
    );

    const executor = new OllamaAgentExecutorService({
      model: "mystery",
    });

    await expect(
      executor.execute({ agent: fixtureAgent, instruction: "anything" }),
    ).rejects.toThrow(/Ollama execution failed \(404\).*model 'mystery' not found/);
  });
});

export {};
