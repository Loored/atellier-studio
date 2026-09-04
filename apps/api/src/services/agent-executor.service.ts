import type { Agent, AgentRole, ModelProfile } from "@atellier/shared";

export type ExecuteAgentInstructionInput = {
  agent: Agent;
  instruction: string;
  context?: string;
  verifiedFiles?: string[];
  signal?: AbortSignal;
  maxOutputTokens?: number;
  modelProfileOverride?: ModelProfile;
};

export type ExecuteAgentInstructionResult = {
  response: string;
  needsHuman: boolean;
};

export type AgentExecutorMode = "mock" | "openai" | "anthropic" | "groq" | "ollama";

// Generic config for any OpenAI-compatible Chat Completions endpoint
// (OpenAI, Groq, Ollama's OpenAI-compat surface, OpenRouter, Together, etc.).
export type OpenAiCompatibleExecutorConfig = {
  /** Full POST URL for chat completions, e.g. https://api.openai.com/v1/chat/completions */
  baseUrl: string;
  /** Bearer token; omit for providers that don't require auth (e.g. local Ollama). */
  apiKey?: string;
  model: string;
  repoFileHints?: string[];
  /** Provider label used in error messages; defaults to "OpenAI-compatible". */
  providerLabel?: string;
  /** Provider-specific fields added to the chat-completion request body. */
  providerRequestBody?: Record<string, unknown>;
};

// Back-compat alias for callers that historically referenced the OpenAI-only shape.
export type OpenAiAgentExecutorConfig = {
  apiKey: string;
  model: string;
  repoFileHints?: string[];
};

export type GroqAgentExecutorConfig = {
  apiKey: string;
  model: string;
  repoFileHints?: string[];
};

export type OllamaAgentExecutorConfig = {
  /** Default: http://127.0.0.1:11434 */
  baseUrl?: string;
  model: string;
  repoFileHints?: string[];
  /** Ollama per-request context window; defaults to 8192 for Context Receipts. */
  contextWindowTokens?: number;
};

export type AnthropicAgentExecutorConfig = {
  apiKey: string;
  model: string;
  repoFileHints?: string[];
};

export interface AgentExecutorService {
  execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult>;
}

export class AgentExecutionCancelledError extends Error {
  constructor(message = "Agent execution cancelled.", options?: ErrorOptions) {
    super(message, options);
    this.name = "AgentExecutionCancelledError";
  }
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

const MOCK_STEP_DELAY_MS = Number(process.env.MOCK_STEP_DELAY_MS ?? 0);

// Role-aware system expertise injected into every agent prompt.
export const ROLE_SYSTEM_INSTRUCTIONS: Record<AgentRole, string> = {
  pm: `You are the product manager for Atellier Studio.
Responsibilities:
- Turn goals into clear execution plans with scope, acceptance criteria, and risk notes
- Break work into the smallest valuable vertical slice
- Identify dependencies and blockers before work begins
- Hand off plans to designers and builders with explicit context
- Final decision-maker on scope and priority

Output format: structured plan (scope → approach → acceptance criteria → handoff target).`,

  builder: `You are the implementation agent for Atellier Studio.
Responsibilities:
- Implement technical solutions based on PM or designer plans
- Write focused, backward-compatible changes aligned with existing patterns
- Identify implementation blockers explicitly — never hide them
- Produce builder-ready deliverables with a clear QA handoff note
- Do not expand scope beyond what was planned

Output format: implementation report (candidate files → summary → risk assessment → blockers → QA handoff).`,

  qa: `You are the quality assurance agent for Atellier Studio.
Responsibilities:
- Review implementation output against the PM's acceptance criteria
- Report specific, actionable defects — not vague concerns
- Approve clearly when all criteria are met
- Request changes with a numbered defect list when not
- After approval, hand off to wiki-curator for memory filing

Output format: QA report (verdict: APPROVED or CHANGES REQUESTED → findings → recommendation).`,

  designer: `You are the design agent for Atellier Studio.
Responsibilities:
- Create design directions based on PM requirements
- Specify which existing component patterns to use
- Document layout decisions, interaction model, and token/color choices
- Produce builder-ready design briefs — no ambiguity
- Flag design risks or missing requirements back to PM

Output format: design brief (component references → layout → interaction model → builder notes).`,

  "wiki-curator": `You are the wiki curator agent for Atellier Studio.
Responsibilities:
- Maintain the operational memory wiki after each significant session
- Summarize completed work into durable, reusable knowledge entries
- Update decision records, entity pages, and process notes
- Append to the wiki log with a timestamped entry
- Detect and note contradictions with existing wiki content

Output format: wiki update summary (pages created/updated → log entry drafted → contradictions found).`,

  intake: `You are the intake agent for Atellier Studio.
Responsibilities:
- Process incoming sources (meeting notes, research, client briefs, decisions)
- Extract key facts, open questions, and implied work items
- Preserve the raw source without modification
- Produce a structured extraction for the wiki-curator to summarize

Output format: intake summary (source type → key facts → implied tasks → handoff note to wiki-curator).`,
};

// Role-aware rich mock output templates.
function buildMockResponse(
  agent: Agent,
  instruction: string,
  context?: string,
  verifiedFiles: string[] = [],
): string {
  const name = agent.name;
  const role = agent.role;
  const taskSnippet = instruction.length > 100 ? `${instruction.slice(0, 100)}…` : instruction;
  const ctxLine = context ? `\n_Context: ${context.slice(0, 80)}${context.length > 80 ? "…" : ""}_\n` : "";
  const candidateFile = verifiedFiles[0] ?? "apps/api/src/services/wiki.service.ts";

  if (role === "builder" && /Phase:\s*runtime/i.test(instruction)) {
    return [
      `## Runtime Report — ${name}`,
      ctxLine,
      `## Checks to Run`,
      `1. Inspect the requested artifact against the linked source content.`,
      `2. Confirm the acceptance criteria and human-review boundary.`,
      ``,
      `## Expected Pass/Fail Signals`,
      `- Pass: the artifact is present, grounded, and reviewable.`,
      `- Fail: the response only promises future work or lacks source evidence.`,
      ``,
      `## Blockers`,
      `- None identified in the proposed artifact.`,
      ``,
      `## QA Handoff`,
      `- Revalidate the artifact content rather than step-completion metadata.`,
    ].join("\n");
  }

  const sections: Record<AgentRole, string> = {
    pm: [
      `## PM Plan — ${name}`,
      ctxLine,
      `**Request:** ${taskSnippet}`,
      ``,
      `**Execution plan:**`,
      `1. Scope: implement the described change as a single bounded slice`,
      `2. Approach: modify only the target layer; no new dependencies`,
      `3. Acceptance criteria:`,
      `   - Existing tests remain green`,
      `   - New behavior matches the specification`,
      `   - One integration test added covering the happy path`,
      ``,
      `**Risk:** Low — change is isolated`,
      ``,
      `**Handoff → Builder:** Proceed with this plan. Tag QA when implementation is ready.`,
    ].join("\n"),

    builder: [
      `## Builder Report — ${name}`,
      ctxLine,
      `**Task:** ${taskSnippet}`,
      ``,
      `**Candidate files:**`,
      `- ${candidateFile}`,
      ``,
      `**Summary:**`,
      `Proposed an additive service-layer change using existing patterns.`,
      ``,
      `## Requested Artifact`,
      `A complete bounded artifact for the requested goal. It records the intended outcome, the source-grounded decisions, the acceptance criteria, and the human-review boundary so QA can evaluate evidence instead of a promise of future work.`,
      ``,
      `**Risk assessment:** Low — no breaking contract changes expected`,
      ``,
      `**Blockers:** None identified`,
      ``,
      `**Handoff → QA:** Implementation approach documented. Ready for review against acceptance criteria.`,
    ].join("\n"),

    qa: [
      `## QA Review — ${name}`,
      ctxLine,
      `**Review scope:** ${taskSnippet}`,
      ``,
      `**Findings:**`,
      `- ✓ Acceptance criteria are testable and bounded`,
      `- ✓ No critical defects in planned approach`,
      `- ✓ Existing regression risk: low`,
      `- ⚠ Minor: confirm error path is handled explicitly`,
      ``,
      `**Acceptance Checklist:**`,
      `- [PASS] Existing tests remain green — Evidence: Runtime reported no regression blocker.`,
      `- [PASS] New behavior matches the specification — Evidence: The latest artifact states the requested outcome and human-review boundary.`,
      `- [PASS] One integration test added covering the happy path — Evidence: The artifact records a bounded acceptance signal for QA.`,
      ``,
      `**Verdict: APPROVED**`,
      ``,
      `**Recommendation:** Proceed to human review.`,
      ``,
      `**Handoff → Wiki Curator:** Document this cycle in operational memory.`,
    ].join("\n"),

    designer: [
      `## Design Brief — ${name}`,
      ctxLine,
      `**Brief:** ${taskSnippet}`,
      ``,
      `**Decisions:**`,
      `- Component pattern: reuse existing panel + card system`,
      `- Layout: sidebar-anchored, consistent with current grid`,
      `- Interaction: hover state + focus-visible ring (existing tokens)`,
      `- Colors: purple accent for primary action, teal for active states`,
      ``,
      `**Builder notes:**`,
      `- No new CSS primitives needed`,
      `- Follow existing --border-card and --bg-card tokens`,
      ``,
      `**Handoff → Builder:** Spec is complete. Proceed with implementation.`,
    ].join("\n"),

    "wiki-curator": [
      `## Wiki Update — ${name}`,
      ctxLine,
      `**Session summary:** ${taskSnippet}`,
      ``,
      `**Memory actions:**`,
      `- wiki/log.md: ✓ New session entry appended`,
      `- wiki/decisions/: ✓ One decision record filed`,
      `- wiki/process/: ✓ Updated agent handoff notes`,
      ``,
      `**Cross-references checked:** No contradictions found with existing pages`,
      ``,
      `**Wiki log entry drafted.** Operational memory is current.`,
    ].join("\n"),

    intake: [
      `## Intake Analysis — ${name}`,
      ctxLine,
      `**Source processed:** ${taskSnippet}`,
      ``,
      `**Extracted facts:**`,
      `- 3 key facts identified from source`,
      `- 1 open question requires follow-up`,
      `- 2 implied tasks found`,
      ``,
      `**Raw source:** preserved without modification`,
      ``,
      `**Handoff → Wiki Curator:** Source ready for summarization and wiki integration.`,
    ].join("\n"),
  };

  return sections[role] ?? `[${role}] ${name} processed the instruction.\nTask: ${taskSnippet}`;
}

// Dispatches each agent to a role-specific executor when one is configured,
// falling back to a global executor otherwise. The interface is identical to
// any other AgentExecutorService, so callers never see the routing.
export class RoleAwareAgentExecutorService implements AgentExecutorService {
  constructor(
    private readonly fallback: AgentExecutorService,
    private readonly perRole: Partial<Record<AgentRole, AgentExecutorService>> = {},
  ) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const executor = this.perRole[input.agent.role] ?? this.fallback;
    return executor.execute(input);
  }
}

export class ProfileAwareAgentExecutorService implements AgentExecutorService {
  constructor(
    private readonly fallback: AgentExecutorService,
    private readonly byProfile: Partial<Record<ModelProfile, AgentExecutorService>>,
  ) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    return (this.byProfile[input.modelProfileOverride ?? "standard"] ?? this.fallback).execute(input);
  }
}

export class MockAgentExecutorService implements AgentExecutorService {
  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    if (input.signal?.aborted) {
      throw new AgentExecutionCancelledError("Mock execution cancelled.");
    }
    if (MOCK_STEP_DELAY_MS > 0) {
      await new Promise<void>((resolve, reject) => {
        const signal = input.signal;
        const onAbort = (): void => {
          clearTimeout(timeout);
          reject(new AgentExecutionCancelledError("Mock execution cancelled."));
        };
        const timeout = setTimeout(() => {
          signal?.removeEventListener("abort", onAbort);
          resolve();
        }, MOCK_STEP_DELAY_MS);
        signal?.addEventListener("abort", onAbort, { once: true });
        if (signal?.aborted) {
          onAbort();
        }
      });
    }
    return {
      response: buildMockResponse(input.agent, input.instruction, input.context, input.verifiedFiles),
      needsHuman: true,
    };
  }
}

function buildExecutorSystemPrompt(
  input: ExecuteAgentInstructionInput,
  repoFileHints: string[] | undefined,
): string {
  const roleExpertise = ROLE_SYSTEM_INSTRUCTIONS[input.agent.role] ?? "";
  const customInstructions = input.agent.instructions?.trim();

  const verifiedFiles = [...new Set([...(repoFileHints ?? []), ...(input.verifiedFiles ?? [])])].sort();

  return [
    `You are ${input.agent.name}, the ${input.agent.role} agent in Atellier Studio.`,
    "",
    roleExpertise,
    "This chat executor cannot edit repository files. Be truthful about that boundary.",
    "For proposed code work, use a 'Candidate files' section with only verified existing repository paths. Reserve 'Changed files' only for a response that is backed by real diff evidence from the system.",
    "Do not claim you implemented code changes unless an external execution step actually edited files in the repository. Do not invent file edits, diffs, paths, or test results.",
    verifiedFiles.length
      ? [
          "Verified repository and Atellier vault files you may reference:",
          ...verifiedFiles.map((filePath) => `- ${filePath}`),
        ].join("\n")
      : "",
    customInstructions ? `\nAdditional operator instructions:\n${customInstructions}` : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();
}

function buildExecutorUserPrompt(input: ExecuteAgentInstructionInput): string {
  return [
    `Instruction:\n${input.instruction.trim()}`,
    input.context?.trim() ? `Context:\n${input.context.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
    finish_reason?: string;
  }>;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
};

// Single implementation that talks to any OpenAI-compatible /v1/chat/completions
// surface: OpenAI itself, Groq, Ollama (OpenAI-compat endpoint), OpenRouter, etc.
// Provider-specific behavior is captured in the config (baseUrl, optional apiKey,
// providerLabel for human-readable error messages).
export class OpenAiCompatibleAgentExecutorService implements AgentExecutorService {
  constructor(private readonly config: OpenAiCompatibleExecutorConfig) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const systemPrompt = buildExecutorSystemPrompt(input, this.config.repoFileHints);
    const userPrompt = buildExecutorUserPrompt(input);
    const label = this.config.providerLabel ?? "OpenAI-compatible";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    let response: Response;
    try {
      response = await fetch(this.config.baseUrl, {
        method: "POST",
        headers,
        signal: input.signal,
        body: JSON.stringify({
          model: this.config.model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          max_tokens: input.maxOutputTokens ?? 1024,
          ...this.config.providerRequestBody,
        }),
      });
    } catch (error) {
      if (input.signal?.aborted || isAbortError(error)) {
        throw new AgentExecutionCancelledError(`${label} execution cancelled.`, { cause: error });
      }
      throw error;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`${label} execution failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (data.error?.message) {
      throw new Error(`${label} error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error(
        `${label} returned an empty response (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"}).`,
      );
    }

    return {
      response: content,
      needsHuman: true,
    };
  }
}

// Back-compat alias: existing call sites that imported the OpenAI-only name keep
// working. Construction goes through the generic class with the OpenAI base URL.
export class OpenAiAgentExecutorService extends OpenAiCompatibleAgentExecutorService {
  constructor(config: OpenAiAgentExecutorConfig) {
    super({
      baseUrl: "https://api.openai.com/v1/chat/completions",
      apiKey: config.apiKey,
      model: config.model,
      repoFileHints: config.repoFileHints,
      providerLabel: "OpenAI",
    });
  }
}

type AnthropicMessagesResponse = {
  id?: string;
  type?: string;
  role?: string;
  model?: string;
  stop_reason?: string;
  content?: Array<{
    type?: string;
    text?: string;
  }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  error?: {
    type?: string;
    message?: string;
  };
};

const ANTHROPIC_API_VERSION = "2023-06-01";
const ANTHROPIC_MAX_TOKENS = 1024;
const ANTHROPIC_TEMPERATURE = 0.4;

export class AnthropicAgentExecutorService implements AgentExecutorService {
  constructor(private readonly config: AnthropicAgentExecutorConfig) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const systemPrompt = buildExecutorSystemPrompt(input, this.config.repoFileHints);
    const userPrompt = buildExecutorUserPrompt(input);

    let response: Response;
    try {
      response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": this.config.apiKey,
          "anthropic-version": ANTHROPIC_API_VERSION,
          "Content-Type": "application/json",
        },
        signal: input.signal,
        body: JSON.stringify({
          model: this.config.model,
          max_tokens: input.maxOutputTokens ?? ANTHROPIC_MAX_TOKENS,
          temperature: ANTHROPIC_TEMPERATURE,
          // Naive prompt caching: the system prompt (role expertise + repo hints)
          // is stable across runs of the same agent, so cache it ephemerally.
          // Per-run instruction/context stays uncached in the user message.
          system: [
            {
              type: "text",
              text: systemPrompt,
              cache_control: { type: "ephemeral" },
            },
          ],
          messages: [{ role: "user", content: userPrompt }],
        }),
      });
    } catch (error) {
      if (input.signal?.aborted || isAbortError(error)) {
        throw new AgentExecutionCancelledError("Anthropic execution cancelled.", { cause: error });
      }
      throw error;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic execution failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as AnthropicMessagesResponse;

    if (data.error?.message) {
      throw new Error(`Anthropic error: ${data.error.message}`);
    }

    const text = data.content
      ?.filter((block) => block.type === "text")
      .map((block) => block.text ?? "")
      .join("")
      .trim();

    if (!text) {
      throw new Error(
        `Anthropic returned an empty response (stop_reason: ${data.stop_reason ?? "unknown"}).`,
      );
    }

    return {
      response: text,
      needsHuman: true,
    };
  }
}

// Groq exposes an OpenAI-compatible Chat Completions endpoint under
// https://api.groq.com/openai/v1, so we reuse the generic compat class.
export class GroqAgentExecutorService extends OpenAiCompatibleAgentExecutorService {
  constructor(config: GroqAgentExecutorConfig) {
    super({
      baseUrl: "https://api.groq.com/openai/v1/chat/completions",
      apiKey: config.apiKey,
      model: config.model,
      repoFileHints: config.repoFileHints,
      providerLabel: "Groq",
    });
  }
}

// Ollama runs locally and exposes an OpenAI-compatible endpoint at
// <baseUrl>/v1/chat/completions. No API key is required (loopback only).
const OLLAMA_DEFAULT_BASE_URL = "http://127.0.0.1:11434";

export class OllamaAgentExecutorService extends OpenAiCompatibleAgentExecutorService {
  constructor(config: OllamaAgentExecutorConfig) {
    const root = (config.baseUrl ?? OLLAMA_DEFAULT_BASE_URL).replace(/\/+$/, "");
    super({
      baseUrl: `${root}/v1/chat/completions`,
      apiKey: undefined,
      model: config.model,
      repoFileHints: config.repoFileHints,
      providerLabel: "Ollama",
      providerRequestBody: {
        options: { num_ctx: config.contextWindowTokens ?? 8192 },
        // Qwen 3.x models think by default. For Atellier's bounded structured
        // agent steps, reserve the output budget for the final artifact.
        reasoning_effort: "none",
      },
    });
  }
}

export function createAgentExecutorService(options: {
  mode: AgentExecutorMode;
  openai?: OpenAiAgentExecutorConfig;
  anthropic?: AnthropicAgentExecutorConfig;
  groq?: GroqAgentExecutorConfig;
  ollama?: OllamaAgentExecutorConfig;
  repoFileHints?: string[];
}): AgentExecutorService {
  if (options.mode === "openai") {
    if (!options.openai?.apiKey) {
      throw new Error("OPENAI_API_KEY is required when AGENT_EXECUTOR_MODE=openai.");
    }
    return new OpenAiAgentExecutorService({
      ...options.openai,
      repoFileHints: options.repoFileHints,
    });
  }

  if (options.mode === "anthropic") {
    if (!options.anthropic?.apiKey) {
      throw new Error("ANTHROPIC_API_KEY is required when AGENT_EXECUTOR_MODE=anthropic.");
    }
    return new AnthropicAgentExecutorService({
      ...options.anthropic,
      repoFileHints: options.repoFileHints,
    });
  }

  if (options.mode === "groq") {
    if (!options.groq?.apiKey) {
      throw new Error("GROQ_API_KEY is required when AGENT_EXECUTOR_MODE=groq.");
    }
    return new GroqAgentExecutorService({
      ...options.groq,
      repoFileHints: options.repoFileHints,
    });
  }

  if (options.mode === "ollama") {
    if (!options.ollama?.model) {
      throw new Error("OLLAMA_MODEL is required when AGENT_EXECUTOR_MODE=ollama.");
    }
    return new OllamaAgentExecutorService({
      ...options.ollama,
      repoFileHints: options.repoFileHints,
    });
  }

  return new MockAgentExecutorService();
}
