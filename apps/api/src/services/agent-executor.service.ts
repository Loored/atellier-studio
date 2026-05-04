import type { Agent } from "@atellier/shared";

export type ExecuteAgentInstructionInput = {
  agent: Agent;
  instruction: string;
  context?: string;
};

export type ExecuteAgentInstructionResult = {
  response: string;
  needsHuman: boolean;
};

export type AgentExecutorMode = "mock" | "openai";

export type OpenAiAgentExecutorConfig = {
  apiKey: string;
  model: string;
};

export interface AgentExecutorService {
  execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult>;
}

export class MockAgentExecutorService implements AgentExecutorService {
  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const normalizedInstruction = input.instruction.trim();
    const normalizedContext = input.context?.trim();
    const contextLine = normalizedContext ? `\nContexto: ${normalizedContext}` : "";

    const response = [
      `[${input.agent.role}] ${input.agent.name} ejecutó la instrucción.`,
      `Acción: ${normalizedInstruction}.${contextLine}`,
      "Resultado preliminar: listo para revisión humana.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      response,
      needsHuman: true,
    };
  }
}

type OpenAiResponse = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
  incomplete_details?: {
    reason?: string;
  };
  error?: {
    message?: string;
  };
};

export class OpenAiAgentExecutorService implements AgentExecutorService {
  constructor(private readonly config: OpenAiAgentExecutorConfig) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const systemPrompt = [
      `You are the ${input.agent.role} agent named ${input.agent.name} in Atellier Studio.`,
      "Return concise operational output and include blockers explicitly when present.",
      "Do not invent tool calls.",
    ].join(" ");

    const userPrompt = [
      `Instruction:\n${input.instruction.trim()}`,
      input.context?.trim() ? `Context:\n${input.context.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        input: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI execution failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as OpenAiResponse;
    const output = extractOpenAiOutputText(data);
    if (!output) {
      const reason = data.incomplete_details?.reason;
      const errorMessage = data.error?.message;
      const suffix = [reason ? `incomplete_reason=${reason}` : "", errorMessage ? `error=${errorMessage}` : ""]
        .filter(Boolean)
        .join(", ");
      throw new Error(
        `OpenAI execution returned an empty response${suffix ? ` (${suffix})` : ""}.`,
      );
    }

    return {
      response: output,
      needsHuman: true,
    };
  }
}

export function createAgentExecutorService(options: {
  mode: AgentExecutorMode;
  openai?: OpenAiAgentExecutorConfig;
}): AgentExecutorService {
  if (options.mode === "openai") {
    if (!options.openai?.apiKey) {
      throw new Error("OPENAI_API_KEY is required when AGENT_EXECUTOR_MODE=openai.");
    }
    return new OpenAiAgentExecutorService(options.openai);
  }

  return new MockAgentExecutorService();
}

function extractOpenAiOutputText(response: OpenAiResponse): string {
  if (typeof response.output_text === "string" && response.output_text.trim().length > 0) {
    return response.output_text.trim();
  }

  const contentParts =
    response.output
      ?.flatMap((outputItem) => outputItem.content ?? [])
      .map((contentItem) => {
        if (typeof contentItem.text === "string" && contentItem.text.trim().length > 0) {
          return contentItem.text.trim();
        }
        if (typeof contentItem.refusal === "string" && contentItem.refusal.trim().length > 0) {
          return `Refusal: ${contentItem.refusal.trim()}`;
        }
        return "";
      })
      .filter((text) => text.length > 0) ?? [];

  return contentParts.join("\n").trim();
}
