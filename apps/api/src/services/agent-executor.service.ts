import type { Agent, AgentRole } from "@atellier/shared";

export type ExecuteAgentInstructionInput = {
  agent: Agent;
  instruction: string;
  context?: string;
};

export type ExecuteAgentInstructionResult = {
  response: string;
  needsHuman: boolean;
};

export type AgentExecutorMode = "mock" | "openai" | "anthropic";

export type OpenAiAgentExecutorConfig = {
  apiKey: string;
  model: string;
  repoFileHints?: string[];
};

export type AnthropicAgentExecutorConfig = {
  apiKey: string;
  model: string;
  repoFileHints?: string[];
};

export interface AgentExecutorService {
  execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult>;
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
function buildMockResponse(agent: Agent, instruction: string, context?: string): string {
  const name = agent.name;
  const role = agent.role;
  const taskSnippet = instruction.length > 100 ? `${instruction.slice(0, 100)}…` : instruction;
  const ctxLine = context ? `\n_Context: ${context.slice(0, 80)}${context.length > 80 ? "…" : ""}_\n` : "";

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
      `- apps/api/src/services/wiki.service.ts`,
      ``,
      `**Summary:**`,
      `Proposed an additive service-layer change using existing patterns.`,
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
      `**Verdict: APPROVED**`,
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

export class MockAgentExecutorService implements AgentExecutorService {
  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    if (MOCK_STEP_DELAY_MS > 0) {
      await new Promise((r) => setTimeout(r, MOCK_STEP_DELAY_MS));
    }
    return {
      response: buildMockResponse(input.agent, input.instruction, input.context),
      needsHuman: true,
    };
  }
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

export class OpenAiAgentExecutorService implements AgentExecutorService {
  constructor(private readonly config: OpenAiAgentExecutorConfig) {}

  async execute(input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    const roleExpertise = ROLE_SYSTEM_INSTRUCTIONS[input.agent.role] ?? "";
    const customInstructions = input.agent.instructions?.trim();

    const systemPrompt = [
      `You are ${input.agent.name}, the ${input.agent.role} agent in Atellier Studio.`,
      "",
      roleExpertise,
      "This chat executor cannot edit repository files. Be truthful about that boundary.",
      "For proposed code work, use a 'Candidate files' section with only verified existing repository paths. Reserve 'Changed files' only for a response that is backed by real diff evidence from the system.",
      "Do not claim you implemented code changes unless an external execution step actually edited files in the repository. Do not invent file edits, diffs, paths, or test results.",
      this.config.repoFileHints?.length
        ? [
            "Verified repository files you may reference:",
            ...this.config.repoFileHints.map((filePath) => `- ${filePath}`),
          ].join("\n")
        : "",
      customInstructions ? `\nAdditional operator instructions:\n${customInstructions}` : "",
    ]
      .filter(Boolean)
      .join("\n")
      .trim();

    const userPrompt = [
      `Instruction:\n${input.instruction.trim()}`,
      input.context?.trim() ? `Context:\n${input.context.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.4,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`OpenAI execution failed (${response.status}): ${errorBody}`);
    }

    const data = (await response.json()) as ChatCompletionResponse;

    if (data.error?.message) {
      throw new Error(`OpenAI error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      throw new Error(
        `OpenAI returned an empty response (finish_reason: ${data.choices?.[0]?.finish_reason ?? "unknown"}).`,
      );
    }

    return {
      response: content,
      needsHuman: true,
    };
  }
}

// P3.a stub — accepts config and validates env wiring, but every execute() call
// throws. The real implementation (Opus 4.7 + prompt caching) lands in P3.b.
export class AnthropicAgentExecutorService implements AgentExecutorService {
  constructor(private readonly config: AnthropicAgentExecutorConfig) {}

  async execute(_input: ExecuteAgentInstructionInput): Promise<ExecuteAgentInstructionResult> {
    throw new Error(
      `Anthropic executor (model=${this.config.model}) is wired but not yet implemented. ` +
        "P3.a delivered the stub only — real calls land in P3.b. " +
        "Switch to AGENT_EXECUTOR_MODE=mock or =openai to run executions today.",
    );
  }
}

export function createAgentExecutorService(options: {
  mode: AgentExecutorMode;
  openai?: OpenAiAgentExecutorConfig;
  anthropic?: AnthropicAgentExecutorConfig;
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

  return new MockAgentExecutorService();
}
