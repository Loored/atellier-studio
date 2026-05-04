import type {
  Agent,
  AgentRunStreamEvent,
  AgentMessage,
  CreateAgentInput,
  RunAgentInput,
  RunAgentResult,
  UpdateAgentStatusInput,
} from "@atellier/shared";
import { httpClient } from "../client/httpClient";

export const agentsService = {
  async list(): Promise<Agent[]> {
    const response = await httpClient.get<Agent[]>("/agents");
    return response.data;
  },

  async create(input: CreateAgentInput): Promise<Agent> {
    const response = await httpClient.post<Agent>("/agents", input);
    return response.data;
  },

  async updateStatus(agentId: string, input: UpdateAgentStatusInput): Promise<Agent> {
    const response = await httpClient.patch<Agent>(`/agents/${agentId}/status`, input);
    return response.data;
  },

  async listMessages(agentId: string): Promise<AgentMessage[]> {
    const response = await httpClient.get<AgentMessage[]>(`/agents/${agentId}/messages`);
    return response.data;
  },

  async run(agentId: string, input: RunAgentInput): Promise<RunAgentResult> {
    const response = await httpClient.post<RunAgentResult>(`/agents/${agentId}/run`, input);
    return response.data;
  },

  async runStream(
    agentId: string,
    input: RunAgentInput,
    onEvent: (event: AgentRunStreamEvent) => void,
  ): Promise<void> {
    const baseUrl = import.meta.env.VITE_API_URL ?? "http://127.0.0.1:4000";
    const response = await fetch(`${baseUrl}/agents/${agentId}/run/stream`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    });

    if (!response.ok || !response.body) {
      throw new Error(`Stream request failed with status ${response.status}.`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamFailedMessage: string | null = null;
    let streamCompleted = false;

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const frame of frames) {
        if (!frame.startsWith("data: ")) {
          continue;
        }
        const payload = frame.slice(6).trim();
        if (!payload) {
          continue;
        }
        const event = JSON.parse(payload) as AgentRunStreamEvent;
        onEvent(event);
        if (event.type === "error") {
          streamFailedMessage = event.message || "Agent stream returned an unknown error.";
        }
        if (event.type === "result") {
          streamCompleted = true;
        }
      }
    }

    if (streamFailedMessage) {
      throw new Error(streamFailedMessage);
    }
    if (!streamCompleted) {
      throw new Error("Agent stream ended without a completion result.");
    }
  },
};
