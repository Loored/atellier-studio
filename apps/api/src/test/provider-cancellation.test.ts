import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Agent } from "@atellier/shared";
import {
  AgentExecutionCancelledError,
  AnthropicAgentExecutorService,
  GroqAgentExecutorService,
  OllamaAgentExecutorService,
  OpenAiAgentExecutorService,
  type AgentExecutorService,
} from "../services/agent-executor.service";

const fixtureAgent: Agent = {
  id: "agent-provider-cancel",
  name: "Pia",
  role: "pm",
  status: "idle",
  createdAt: "2026-08-24T00:00:00.000Z",
  updatedAt: "2026-08-24T00:00:00.000Z",
};

describe("provider cancellation", () => {
  const originalFetch = globalThis.fetch;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      const signal = init.signal;
      if (!signal) {
        reject(new Error("Expected provider request to receive an AbortSignal."));
        return;
      }
      const rejectAbort = (): void => reject(new DOMException("Aborted", "AbortError"));
      if (signal.aborted) {
        rejectAbort();
        return;
      }
      signal.addEventListener("abort", rejectAbort, { once: true });
    }));
    globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it.each<[string, () => AgentExecutorService]>([
    ["OpenAI", () => new OpenAiAgentExecutorService({ apiKey: "openai-test", model: "gpt-test" })],
    ["Anthropic", () => new AnthropicAgentExecutorService({ apiKey: "anthropic-test", model: "claude-test" })],
    ["Groq", () => new GroqAgentExecutorService({ apiKey: "groq-test", model: "llama-test" })],
    ["Ollama", () => new OllamaAgentExecutorService({ model: "qwen-test" })],
  ])("passes the caller signal to %s fetch and normalizes abort errors", async (label, createExecutor) => {
    const controller = new AbortController();
    const execution = createExecutor().execute({
      agent: fixtureAgent,
      instruction: "Prepare a bounded plan.",
      signal: controller.signal,
    });

    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBe(controller.signal);

    controller.abort();

    await expect(execution).rejects.toEqual(expect.objectContaining({
      name: AgentExecutionCancelledError.name,
      message: `${label} execution cancelled.`,
    }));
  });
});
