import { createHash, randomUUID } from "node:crypto";
import { ROLE_SYSTEM_INSTRUCTIONS } from "./agent-executor.service";
import type {
  Agent,
  AgentRole,
  OrchestrationExecutionDefinition,
  OrchestrationExecutionStep,
  OrchestrationSkillId,
  OrchestrationSkillSummary,
  OrchestrationStatusResult,
  OrchestrationStepStatusEntry,
  Run,
  SkillOrchestrationResult,
  SkillOrchestrationStepResult,
  StartSkillOrchestrationInput,
} from "@atellier/shared";
import { AgentRunService } from "./agent-run.service";
import { AgentService } from "./agent.service";
import { RunService } from "./run.service";
import type { WikiService } from "./wiki.service";

type SkillStepTemplate = OrchestrationExecutionStep;
type SkillTemplate = OrchestrationExecutionDefinition;

export type SkillExecutionHooks = {
  isCancellationRequested: () => Promise<boolean>;
  signal?: AbortSignal;
  onStepStarted?: (step: SkillStepTemplate) => Promise<void>;
  onStepCompleted?: (step: SkillStepTemplate, result: SkillOrchestrationStepResult) => Promise<void>;
  onStepReused?: (step: SkillStepTemplate, result: SkillOrchestrationStepResult) => Promise<void>;
  onFinalizing?: () => Promise<void>;
};

export class OrchestrationCancelledError extends Error {
  constructor() {
    super("Orchestration cancellation requested.");
    this.name = "OrchestrationCancelledError";
  }
}

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
  {
    id: "wiki-dream-loop",
    name: "Wiki Dream Loop",
    description:
      "Periodic curator pass over the wiki: surfaces lint issues, stale pages, contradictions, and orphan notes; proposes (never silently applies) reorganizations as a dream report the operator approves before any other page is touched.",
    steps: [
      {
        id: "audit",
        label: "Audit the wiki",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Surface structural issues and outdated content from the lint output and a recency review.",
        instruction:
          "Review the wiki/lint findings, the most recent wiki/log entries, and the current index. List concrete issues by category: stale pages, contradictions, orphan notes, broken cross-references, overgrown index sections. Name paths explicitly. Do not propose fixes yet — only surface what is wrong.",
      },
      {
        id: "propose-changes",
        label: "Propose changes",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Turn each audit finding into a single concrete resolution proposal.",
        instruction:
          "For each issue raised in the audit, propose exactly ONE specific action: 'archive page X', 'merge X and Y into Z', 'add link from A to B', 'rewrite index section N'. Do not apply anything. The operator approves each proposal manually before any wiki change lands.",
      },
      {
        id: "draft-report",
        label: "Draft the dream report",
        phase: "wiki",
        agentRole: "wiki-curator",
        agentName: "Wiki Curator",
        objective: "Consolidate the audit and proposals into a single page-shaped dream report.",
        instruction:
          "Produce a markdown report with three sections: 'Summary' (≤5 bullets), 'Findings' (one bullet per audit issue with the path), and 'Proposed actions' (numbered list, each with rationale and risk). At the top of the report include a suggested filename: wiki/dreams/<YYYY-MM-DD>-dream-report.md. The operator (or an MCP client) is expected to save this output via wiki_page_write or POST /wiki/page once approved — the dream loop never writes pages itself.",
      },
      {
        id: "task-followup",
        label: "Optional task follow-up",
        phase: "plan",
        agentRole: "pm",
        agentName: "Pepe PM",
        objective: "Open a task if the proposals warrant tracked work; otherwise state none is needed.",
        instruction:
          "Decide if the proposed actions justify a tracked task (e.g. more than 5 changes, breaking-link risk, or a restructure of a major page). If yes, propose a single task with title, scope, and acceptance criteria. If no, state explicitly that no task is needed and why.",
      },
    ],
  },
];

export class SkillOrchestrationService {
  constructor(
    private readonly agents: AgentService,
    private readonly agentRuns: AgentRunService,
    private readonly runs: RunService,
    private readonly wiki: WikiService,
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

  async enqueue(input: StartSkillOrchestrationInput, maxAttempts = 3): Promise<Run> {
    const template = this.requireTemplate(input.skillId);
    const definitionSnapshot = structuredClone(template);
    const definitionHash = createHash("sha256")
      .update(JSON.stringify(definitionSnapshot))
      .digest("hex");
    const now = new Date().toISOString();
    const orchestrationRun = await this.runs.create({
      type: "orchestration",
      status: "queued",
      taskId: input.taskId,
      input: {
        skillId: input.skillId,
        goal: input.goal,
        context: input.context,
        executorModeOverride: input.executorModeOverride,
      },
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "queued",
        definitionHash,
        definitionSnapshot,
        idempotencyKey: randomUUID(),
        attempt: 0,
        maxAttempts: Math.max(maxAttempts, 1),
        nextEventSequence: 0,
        availableAt: now,
      },
    });
    await this.runs.appendLog(orchestrationRun.id, {
      level: "info",
      message: `Skill queued: ${template.name}.`,
    });
    return (await this.runs.getById(orchestrationRun.id)) ?? orchestrationRun;
  }

  async getStatus(orchestrationRunId: string): Promise<OrchestrationStatusResult | null> {
    const orchRun = await this.runs.getById(orchestrationRunId);
    if (!orchRun) {
      return null;
    }

    const orchInput = orchRun.input as { skillId?: string; goal?: string } | undefined;
    const skillId = orchInput?.skillId as OrchestrationSkillId | undefined;
    const template = this.readDefinitionSnapshot(orchRun)
      ?? (skillId ? SKILL_TEMPLATES.find((t) => t.id === skillId) : undefined);
    if (!template || !skillId) {
      return null;
    }

    const stepRuns = await this.runs.listByOrchestrationRunId(orchestrationRunId);
    const agents = await this.agents.list();

    const steps: OrchestrationStepStatusEntry[] = template.steps.map((step) => {
      const stepRun = [...stepRuns].reverse().find((r) => {
        const ri = r.input as Record<string, unknown> | undefined;
        return ri?.orchestrationStepId === step.id || ri?.orchestrationStepLabel === step.label;
      });
      const agent = agents.find((a) => a.name.toLowerCase() === step.agentName.toLowerCase());
      const status: OrchestrationStepStatusEntry["status"] = stepRun
        ? (stepRun.status as OrchestrationStepStatusEntry["status"])
        : "pending";
      return {
        stepId: step.id,
        label: step.label,
        phase: step.phase,
        agentRole: step.agentRole,
        agentName: step.agentName,
        agentId: agent?.id,
        runId: stepRun?.id,
        status,
        isActive: status === "running",
      };
    });

    const activeStep = steps.find((s) => s.isActive) ?? null;
    const activeIndex = activeStep ? steps.indexOf(activeStep) : -1;
    const nextStep = activeIndex >= 0 ? (steps[activeIndex + 1] ?? null) : null;

    return {
      orchestrationRunId,
      skillId,
      goal: orchInput?.goal ?? "",
      status: orchRun.status,
      execution: orchRun.execution,
      steps,
      activeStep,
      nextStep,
    };
  }

  private requireTemplate(skillId: OrchestrationSkillId): SkillTemplate {
    const template = SKILL_TEMPLATES.find((candidate) => candidate.id === skillId);
    if (!template) {
      throw new Error(`Unknown orchestration skill: ${skillId}`);
    }
    return template;
  }

  async executeClaimed(
    orchestrationRun: Run,
    hooks: SkillExecutionHooks,
  ): Promise<SkillOrchestrationResult> {
    const leaseOwner = orchestrationRun.execution?.leaseOwner;
    if (!leaseOwner) {
      throw new Error(`Run ${orchestrationRun.id} has no active execution lease owner.`);
    }
    const template = this.readDefinitionSnapshot(orchestrationRun);
    if (!template) {
      throw new Error(`Run ${orchestrationRun.id} has no valid orchestration definition snapshot.`);
    }
    const input = this.readStartInput(orchestrationRun);
    const stepResults: SkillOrchestrationStepResult[] = [];
    const previousOutputs: string[] = [];
    const interruptedStepRuns = await this.runs.failInterruptedOrchestrationStepRuns(orchestrationRun.id);
    if (interruptedStepRuns > 0) {
      await this.runs.appendLog(orchestrationRun.id, {
        level: "warn",
        message: `Recovered ${interruptedStepRuns} interrupted child run(s) from an earlier worker attempt.`,
      });
    }
    const existingStepRuns = await this.runs.listByOrchestrationRunId(orchestrationRun.id);

    try {
      for (const step of template.steps) {
        if (await hooks.isCancellationRequested()) {
          throw new OrchestrationCancelledError();
        }

        const completedStepRun = [...existingStepRuns].reverse().find((candidate) => {
          const candidateInput = candidate.input as Record<string, unknown> | undefined;
          return candidate.status === "completed"
            && (candidateInput?.orchestrationStepId === step.id
              || candidateInput?.orchestrationStepLabel === step.label);
        });
        if (completedStepRun) {
          const reused = await this.buildReusedStepResult(step, completedStepRun);
          stepResults.push(reused);
          previousOutputs.push(this.buildPreviousOutput(step, reused.agentName, completedStepRun));
          await hooks.onStepReused?.(step, reused);
          continue;
        }

        const agent = await this.resolveAgent(step.agentName, step.agentRole);
        await hooks.onStepStarted?.(step);
        await this.runs.appendLog(orchestrationRun.id, {
          level: "info",
          message: `Starting ${step.label} with ${agent.name}.`,
        });

        const nextStep = template.steps[template.steps.indexOf(step) + 1];
        const result = await this.agentRuns.run(
          agent.id,
          {
            instruction: this.buildStepInstruction(template, step, input.goal),
            context: await this.buildStepContext(template, step, orchestrationRun.id, input.context, previousOutputs),
            executorModeOverride: input.executorModeOverride,
            recordDeliverable: false,
            orchestrationStep: {
              orchestrationRunId: orchestrationRun.id,
              stepId: step.id,
              label: step.label,
              phase: step.phase,
              nextAgentName: nextStep?.agentName,
            },
          },
          { signal: hooks.signal },
        );

        if (!result) {
          throw new Error(`Agent not found for orchestration step ${step.id}.`);
        }

        previousOutputs.push(this.buildPreviousOutput(step, agent.name, result.run));

        const stepResult: SkillOrchestrationStepResult = {
          stepId: step.id,
          label: step.label,
          phase: step.phase,
          agentId: agent.id,
          agentName: agent.name,
          agentRole: agent.role,
          runId: result.run.id,
          status: result.run.status,
        };
        stepResults.push(stepResult);

        await this.runs.appendLog(orchestrationRun.id, {
          level: "info",
          message: `Completed ${step.label}; step run ${result.run.id}.`,
        });
        const updatedParent = await this.runs.updateStatus(orchestrationRun.id, "running", {
          skillId: input.skillId,
          goal: input.goal,
          steps: stepResults,
        }, leaseOwner);
        if (!updatedParent) {
          throw new Error(`Execution lease lost while recording progress for run ${orchestrationRun.id}.`);
        }
        await hooks.onStepCompleted?.(step, stepResult);
      }

      if (await hooks.isCancellationRequested()) {
        throw new OrchestrationCancelledError();
      }
      await hooks.onFinalizing?.();

      const completedRun = await this.runs.complete(orchestrationRun.id, {
        summary: `${template.name} completed`,
        output: {
          skillId: input.skillId,
          goal: input.goal,
          steps: stepResults,
        },
      }, leaseOwner);

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
      const cancelled = error instanceof OrchestrationCancelledError || Boolean(hooks.signal?.aborted);
      const settledError = cancelled && !(error instanceof OrchestrationCancelledError)
        ? new OrchestrationCancelledError()
        : error;
      const message = settledError instanceof Error ? settledError.message : "Unknown orchestration failure.";
      await this.runs.appendLog(orchestrationRun.id, {
        level: cancelled ? "warn" : "error",
        message,
      });
      throw settledError;
    }
  }

  private readDefinitionSnapshot(run: Run): SkillTemplate | null {
    const snapshot = run.execution?.definitionSnapshot as Partial<SkillTemplate> | undefined;
    if (!snapshot || typeof snapshot.id !== "string" || !Array.isArray(snapshot.steps)) {
      return null;
    }
    if (!snapshot.steps.every((step) =>
      step
      && typeof step.id === "string"
      && typeof step.label === "string"
      && typeof step.instruction === "string")) {
      return null;
    }
    return snapshot as SkillTemplate;
  }

  private readStartInput(run: Run): StartSkillOrchestrationInput {
    const input = run.input as Partial<StartSkillOrchestrationInput> | undefined;
    if (!input?.skillId || typeof input.goal !== "string") {
      throw new Error(`Run ${run.id} has invalid orchestration input.`);
    }
    return input as StartSkillOrchestrationInput;
  }

  private async buildReusedStepResult(
    step: SkillStepTemplate,
    run: Run,
  ): Promise<SkillOrchestrationStepResult> {
    const agent = run.agentId ? await this.agents.getById(run.agentId) : null;
    return {
      stepId: step.id,
      label: step.label,
      phase: step.phase,
      agentId: run.agentId ?? agent?.id ?? "unknown",
      agentName: agent?.name ?? step.agentName,
      agentRole: agent?.role ?? step.agentRole,
      runId: run.id,
      status: run.status,
    };
  }

  private buildPreviousOutput(step: SkillStepTemplate, agentName: string, run: Run): string {
    const response = (run.output as { response?: string } | undefined)?.response ?? "Completed without text output.";
    return [
      `## ${step.label}`,
      `Agent: ${agentName} (${step.agentRole})`,
      `Run: ${run.id}`,
      this.truncateForContext(response),
    ].join("\n");
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
      instructions: ROLE_SYSTEM_INSTRUCTIONS[agentRole] ??
        `Operate as the ${agentRole} agent in Atellier Studio.`,
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

  private async buildStepContext(
    template: SkillTemplate,
    step: SkillStepTemplate,
    orchestrationRunId: string,
    baseContext?: string,
    previousOutputs: string[] = [],
  ): Promise<string> {
    const dreamGrounding = await this.buildWikiDreamGrounding(template, step);
    return [
      `Parent orchestration run: ${orchestrationRunId}`,
      baseContext?.trim() ? `Operator context:\n${baseContext.trim()}` : "",
      dreamGrounding,
      previousOutputs.length > 0 ? `Previous step outputs:\n${previousOutputs.join("\n\n")}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  private async buildWikiDreamGrounding(template: SkillTemplate, step: SkillStepTemplate): Promise<string> {
    if (template.id !== "wiki-dream-loop" || step.id !== "audit") {
      return "";
    }

    const [lint, wikiPaths] = await Promise.all([
      this.wiki.lint({ recordLog: false }),
      this.wiki.listWikiMarkdownPaths(),
    ]);
    const issueLines = lint.issues.length > 0
      ? lint.issues.map((issue) => [
          `- ${issue.code}: ${issue.path}`,
          `  message: ${issue.message}`,
          issue.suggestion ? `  suggestion: ${issue.suggestion}` : "",
        ].filter(Boolean).join("\n"))
      : ["- none"];

    return [
      "Wiki Dream Grounding",
      `Lint checked at: ${lint.checkedAt}`,
      `Lint ok: ${lint.ok}`,
      "Lint findings:",
      ...issueLines,
      `Available wiki markdown paths (${wikiPaths.length}):`,
      ...wikiPaths.map((wikiPath) => `- ${wikiPath}`),
      "Use only the paths above when naming wiki files. If a page is not listed, mark it as unverified instead of inventing it.",
    ].join("\n");
  }

  private truncateForContext(content: string): string {
    if (content.length <= 1200) {
      return content;
    }

    return `${content.slice(0, 1200)}\n[truncated for orchestration context]`;
  }
}
