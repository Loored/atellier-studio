import type {
  Agent,
  AgentRole,
  OrchestrationSkillId,
  OrchestrationSkillSummary,
  OrchestrationSkillStepSummary,
  SkillOrchestrationResult,
  SkillOrchestrationStepResult,
  StartSkillOrchestrationInput,
} from "@atellier/shared";
import { AgentRunService } from "./agent-run.service";
import { AgentService } from "./agent.service";
import { RunService } from "./run.service";

type SkillStepTemplate = OrchestrationSkillStepSummary & {
  instruction: string;
};

type SkillTemplate = Omit<OrchestrationSkillSummary, "steps"> & {
  steps: SkillStepTemplate[];
};

const SKILL_TEMPLATES: SkillTemplate[] = [
  {
    id: "atellier-build-loop",
    name: "Atellier Build Loop",
    description: "Coordinates planning, building, runtime validation, QA, fixing, and memory capture.",
    steps: [
      {
        id: "scope",
        label: "Scope the work",
        phase: "plan",
        agentRole: "pm",
        agentName: "Pepe PM",
        objective: "Turn the goal into a small execution plan with acceptance criteria.",
        instruction:
          "Clarify the requested change, name the smallest useful vertical slice, and list acceptance criteria. Keep it operational and avoid speculative infrastructure.",
      },
      {
        id: "build",
        label: "Implement the slice",
        phase: "backend",
        agentRole: "builder",
        agentName: "Pepe Builder",
        objective: "Produce the implementation approach for the code-owning agent.",
        instruction:
          "Work from the plan and describe the concrete implementation path. Call out files, contracts, and any blockers that require a follow-up builder pass.",
      },
      {
        id: "runtime",
        label: "Compile and run checks",
        phase: "runtime",
        agentRole: "builder",
        agentName: "Toto Runtime",
        objective: "Validate that the slice can be compiled, run, and inspected locally.",
        instruction:
          "Review the builder output as a runtime operator. Identify the checks to run, expected pass/fail signals, and blockers that should be returned to the builder.",
      },
      {
        id: "qa",
        label: "Test and report blockers",
        phase: "qa",
        agentRole: "qa",
        agentName: "Jaco QA",
        objective: "Review the current result and report actionable defects.",
        instruction:
          "Act as QA. Validate the behavior against acceptance criteria. Return a short blocker list; if none remain, state that the slice is ready for review.",
      },
      {
        id: "fix",
        label: "Fix reported blockers",
        phase: "backend",
        agentRole: "builder",
        agentName: "Pepe Builder",
        objective: "Plan the smallest fix pass for QA findings.",
        instruction:
          "Use QA findings to plan the smallest correction pass. Preserve unrelated work, keep changes focused, and identify any remaining risk.",
      },
      {
        id: "approve",
        label: "Approve or block",
        phase: "qa",
        agentRole: "qa",
        agentName: "Jaco QA",
        objective: "Revalidate and decide whether the run is ready for human review.",
        instruction:
          "Revalidate the fix pass. Approve when acceptance criteria are met, otherwise return only the remaining blockers.",
      },
      {
        id: "memory",
        label: "File operational memory",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Capture durable wiki memory for future sessions.",
        instruction:
          "Summarize reusable decisions, source links, contradictions, task updates, and wiki pages that should be created or updated.",
      },
    ],
  },
  {
    id: "llm-wiki-ingest-loop",
    name: "LLM Wiki Ingest Loop",
    description: "Coordinates source preservation, synthesis, cross-linking, contradiction checks, and wiki logging.",
    steps: [
      {
        id: "preserve-source",
        label: "Preserve the source",
        phase: "raw",
        agentRole: "intake",
        agentName: "Nina Intake",
        objective: "Identify the immutable raw source and extraction boundaries.",
        instruction:
          "Read the source context and define how it should be preserved under atelier/raw without overwriting prior inputs.",
      },
      {
        id: "summarize",
        label: "Summarize the source",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Extract the key facts, claims, and reusable concepts.",
        instruction:
          "Create a concise source summary with facts, claims, open questions, and links to existing wiki pages that should be updated.",
      },
      {
        id: "integrate",
        label: "Integrate pages",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Update entity, concept, workflow, and index pages.",
        instruction:
          "Map the summary into durable wiki pages. Note page updates, cross-references, and any contradictions with existing knowledge.",
      },
      {
        id: "task-followup",
        label: "Create follow-up work",
        phase: "plan",
        agentRole: "pm",
        agentName: "Pepe PM",
        objective: "Turn reusable findings into tasks only when work is implied.",
        instruction:
          "Identify whether the source implies active work. Propose tasks with clear outcomes, or state that no task is needed.",
      },
      {
        id: "log",
        label: "Append wiki log",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Record the ingest in chronological operational memory.",
        instruction:
          "Prepare the final wiki log entry with source path, pages created, pages updated, contradictions found, and tasks proposed.",
      },
    ],
  },
];

export class SkillOrchestrationService {
  constructor(
    private readonly agents: AgentService,
    private readonly agentRuns: AgentRunService,
    private readonly runs: RunService,
  ) {}

  listSkills(): OrchestrationSkillSummary[] {
    return SKILL_TEMPLATES.map((template) => ({
      id: template.id,
      name: template.name,
      description: template.description,
      steps: template.steps.map(({ instruction: _instruction, ...step }) => step),
    }));
  }

  getSkill(id: OrchestrationSkillId): OrchestrationSkillSummary | null {
    return this.listSkills().find((skill) => skill.id === id) ?? null;
  }

  async start(input: StartSkillOrchestrationInput): Promise<SkillOrchestrationResult> {
    const template = SKILL_TEMPLATES.find((candidate) => candidate.id === input.skillId);
    if (!template) {
      throw new Error(`Unknown orchestration skill: ${input.skillId}`);
    }

    const orchestrationRun = await this.runs.create({
      type: "orchestration",
      status: "running",
      taskId: input.taskId,
      input: {
        skillId: input.skillId,
        goal: input.goal,
        context: input.context,
      },
    });

    const stepResults: SkillOrchestrationStepResult[] = [];
    const previousOutputs: string[] = [];

    await this.runs.appendLog(orchestrationRun.id, {
      level: "info",
      message: `Skill triggered: ${template.name}.`,
    });

    try {
      for (const step of template.steps) {
        const agent = await this.resolveAgent(step.agentName, step.agentRole);
        await this.runs.appendLog(orchestrationRun.id, {
          level: "info",
          message: `Starting ${step.label} with ${agent.name}.`,
        });

        const result = await this.agentRuns.run(agent.id, {
          instruction: this.buildStepInstruction(template, step, input.goal),
          context: this.buildStepContext(orchestrationRun.id, input.context, previousOutputs),
          recordDeliverable: false,
        });

        if (!result) {
          throw new Error(`Agent not found for orchestration step ${step.id}.`);
        }

        previousOutputs.push(
          [
            `## ${step.label}`,
            `Agent: ${agent.name} (${agent.role})`,
            `Run: ${result.run.id}`,
            this.truncateForContext(result.assistantMessage.content),
          ].join("\n"),
        );

        stepResults.push({
          stepId: step.id,
          label: step.label,
          phase: step.phase,
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          runId: result.run.id,
          status: result.run.status,
        });

        await this.runs.appendLog(orchestrationRun.id, {
          level: "info",
          message: `Completed ${step.label}; step run ${result.run.id}.`,
        });
      }

      const completedRun = await this.runs.complete(orchestrationRun.id, {
        summary: `${template.name} completed`,
        output: {
          skillId: input.skillId,
          goal: input.goal,
          steps: stepResults,
        },
      });

      if (!completedRun) {
        throw new Error("Orchestration run disappeared before completion.");
      }

      return {
        skillId: input.skillId,
        goal: input.goal,
        orchestrationRun: completedRun,
        steps: stepResults,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown orchestration failure.";
      await this.runs.appendLog(orchestrationRun.id, {
        level: "error",
        message,
      });
      await this.runs.updateStatus(orchestrationRun.id, "failed", {
        skillId: input.skillId,
        goal: input.goal,
        error: message,
        steps: stepResults,
      });
      throw error;
    }
  }

  private async resolveAgent(agentName: string, agentRole: AgentRole): Promise<Agent> {
    const existingAgents = await this.agents.list();
    const normalizedName = agentName.toLowerCase();
    const existing = existingAgents.find((agent) => agent.name.toLowerCase() === normalizedName);
    if (existing) {
      return existing;
    }

    return this.agents.create({
      name: agentName,
      role: agentRole,
      status: "idle",
      instructions: `Operate as the ${agentRole} step agent for skill-driven Atellier orchestration.`,
    });
  }

  private buildStepInstruction(template: SkillTemplate, step: SkillStepTemplate, goal: string): string {
    return [
      `Skill: ${template.name}`,
      `Phase: ${step.phase}`,
      `Step: ${step.label}`,
      `Goal: ${goal}`,
      "",
      step.instruction,
      "",
      "Return concise operational output. Include blockers explicitly when present.",
    ].join("\n");
  }

  private buildStepContext(orchestrationRunId: string, baseContext?: string, previousOutputs: string[] = []): string {
    return [
      `Parent orchestration run: ${orchestrationRunId}`,
      baseContext?.trim() ? `Operator context:\n${baseContext.trim()}` : "",
      previousOutputs.length > 0 ? `Previous step outputs:\n${previousOutputs.join("\n\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private truncateForContext(content: string): string {
    if (content.length <= 1200) {
      return content;
    }

    return `${content.slice(0, 1200)}\n[truncated for orchestration context]`;
  }
}
