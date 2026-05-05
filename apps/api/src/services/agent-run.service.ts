import type { AgentRunStreamEvent, RunAgentInput, RunAgentResult } from "@atellier/shared";
import type { AgentExecutorService, ExecuteAgentInstructionInput } from "./agent-executor.service";
import { AgentService } from "./agent.service";
import { MessageService } from "./message.service";
import { RunService } from "./run.service";

export class AgentRunService {
  private readonly maxHandoffDepth: number;
  private readonly executionTimeoutMs: number;

  constructor(
    private readonly agents: AgentService,
    private readonly runs: RunService,
    private readonly messages: MessageService,
    private readonly executor: AgentExecutorService,
    options: {
      maxHandoffDepth?: number;
      executionTimeoutMs?: number;
    } = {},
  ) {
    const rawDepth = options.maxHandoffDepth;
    const rawTimeout = options.executionTimeoutMs;
    this.maxHandoffDepth = Number.isFinite(rawDepth) ? Math.max(0, Math.floor(rawDepth as number)) : 1;
    this.executionTimeoutMs = Number.isFinite(rawTimeout) ? Math.max(1000, rawTimeout as number) : 45_000;
  }

  async run(agentId: string, input: RunAgentInput): Promise<RunAgentResult | null> {
    return this.runInternal(agentId, input);
  }

  async runWithStream(
    agentId: string,
    input: RunAgentInput,
    emit: (event: AgentRunStreamEvent) => void,
  ): Promise<RunAgentResult | null> {
    return this.runInternal(agentId, input, emit);
  }

  private async runInternal(
    agentId: string,
    input: RunAgentInput,
    emit?: (event: AgentRunStreamEvent) => void,
    remainingHandoffDepth = this.maxHandoffDepth,
    lineage = new Set<string>(),
  ): Promise<RunAgentResult | null> {
    const agent = await this.agents.getById(agentId);
    if (!agent) {
      return null;
    }
    lineage.add(agentId);

    emit?.({ type: "status", status: "queued" });

    const run = await this.runs.create({
      agentId,
      type: "manual",
      status: "running",
      input: {
        instruction: input.instruction,
        context: input.context,
      },
    });

    await this.agents.updateStatus(agentId, {
      status: "executing",
      lastRunId: run.id,
    });
    emit?.({ type: "status", status: "running" });

    const userMessage = await this.messages.create({
      agentId,
      runId: run.id,
      role: "user",
      content: input.instruction,
    });

    await this.runs.appendLog(run.id, {
      level: "info",
      message: `Instruction received for agent ${agent.name}.`,
    });

    try {
      const execution = await this.executeWithTimeout({
        agent,
        instruction: input.instruction,
        context: input.context,
      });

      for (const chunk of this.chunkText(execution.response, 80)) {
        emit?.({ type: "chunk", content: chunk });
      }
      emit?.({ type: "status", status: "finalizing" });

      const assistantMessage = await this.messages.create({
        agentId,
        runId: run.id,
        role: "assistant",
        content: execution.response,
      });

      await this.runs.appendLog(run.id, {
        level: "info",
        message: "Agent execution finished.",
      });

      const completedRun = await this.runs.complete(run.id, {
        summary: execution.needsHuman
          ? `${agent.name} completed execution and requests review.`
          : `${agent.name} completed execution.`,
        output: {
          messageId: assistantMessage.id,
          response: execution.response,
          needsHuman: execution.needsHuman,
        },
        suppressAutoDeliverable: input.recordDeliverable === false,
      });

      if (!completedRun) {
        return null;
      }

      const updatedAgent = await this.agents.updateStatus(agentId, {
        status: execution.needsHuman ? "needs-human" : "done",
        lastRunId: completedRun.id,
      });

      if (!updatedAgent) {
        return null;
      }

      const result = {
        agent: updatedAgent,
        run: completedRun,
        userMessage,
        assistantMessage,
      };

      if (input.handoffAgentId && input.handoffAgentId !== agentId) {
        if (remainingHandoffDepth <= 0) {
          await this.runs.appendLog(completedRun.id, {
            level: "warn",
            message: "Handoff skipped: max handoff depth reached.",
          });
        } else if (lineage.has(input.handoffAgentId)) {
          await this.runs.appendLog(completedRun.id, {
            level: "warn",
            message: "Handoff skipped: detected circular handoff target.",
          });
        } else {
        await this.handleHandoff({
          sourceAgent: updatedAgent,
          sourceRunId: completedRun.id,
          sourceInstruction: input.instruction,
          sourceResponse: execution.response,
          handoffAgentId: input.handoffAgentId,
          handoffInstruction: input.handoffInstruction,
          remainingHandoffDepth: remainingHandoffDepth - 1,
          lineage: new Set(lineage),
          emit,
        });
        }
      }

      emit?.({ type: "result", result });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown agent execution error.";
      await this.runs.appendLog(run.id, {
        level: "error",
        message,
      });
      await this.runs.updateStatus(run.id, "failed", { error: message });
      await this.agents.updateStatus(agentId, {
        status: "blocked",
        lastRunId: run.id,
      });
      emit?.({ type: "error", message });
      throw error;
    }
  }

  private *chunkText(content: string, chunkSize: number): Generator<string> {
    if (!content) {
      return;
    }
    let index = 0;
    while (index < content.length) {
      yield content.slice(index, index + chunkSize);
      index += chunkSize;
    }
  }

  private async handleHandoff(options: {
    sourceAgent: { id: string; name: string };
    sourceRunId: string;
    sourceInstruction: string;
    sourceResponse: string;
    handoffAgentId: string;
    handoffInstruction?: string;
    remainingHandoffDepth: number;
    lineage: Set<string>;
    emit?: (event: AgentRunStreamEvent) => void;
  }): Promise<void> {
    const targetAgent = await this.agents.getById(options.handoffAgentId);
    if (!targetAgent) {
      return;
    }

    const composedInstruction = [
      options.handoffInstruction?.trim() || `Continue the task from ${options.sourceAgent.name}.`,
      "",
      `Original instruction: ${options.sourceInstruction}`,
      `Previous agent output: ${options.sourceResponse}`,
    ]
      .filter(Boolean)
      .join("\n");

    await this.runs.appendLog(options.sourceRunId, {
      level: "info",
      message: `Handoff created to agent ${targetAgent.name}.`,
    });

    const handoffRun = await this.runs.create({
      agentId: targetAgent.id,
      type: "manual",
      status: "running",
      input: {
        handoffFromAgentId: options.sourceAgent.id,
        handoffFromRunId: options.sourceRunId,
        instruction: composedInstruction,
      },
    });

    await this.agents.updateStatus(targetAgent.id, {
      status: "executing",
      lastRunId: handoffRun.id,
    });

    await this.messages.create({
      agentId: targetAgent.id,
      runId: handoffRun.id,
      role: "system",
      content: `Handoff from ${options.sourceAgent.name}.`,
    });

    await this.messages.create({
      agentId: targetAgent.id,
      runId: handoffRun.id,
      role: "user",
      content: composedInstruction,
    });

    options.emit?.({
      type: "chunk",
      content: `\n\n[handoff] ${options.sourceAgent.name} -> ${targetAgent.name}\n`,
    });

    const handoffExecution = await this.executeWithTimeout({
      agent: targetAgent,
      instruction: composedInstruction,
      context: `handoff from ${options.sourceAgent.name}`,
    });

    for (const chunk of this.chunkText(handoffExecution.response, 80)) {
      options.emit?.({ type: "chunk", content: chunk });
    }

    const handoffAssistantMessage = await this.messages.create({
      agentId: targetAgent.id,
      runId: handoffRun.id,
      role: "assistant",
      content: handoffExecution.response,
    });

    await this.runs.complete(handoffRun.id, {
      summary: `${targetAgent.name} completed handoff execution.`,
      output: {
        handoffFromRunId: options.sourceRunId,
        response: handoffExecution.response,
        messageId: handoffAssistantMessage.id,
      },
    });

    await this.agents.updateStatus(targetAgent.id, {
      status: "needs-human",
      lastRunId: handoffRun.id,
    });

    if (options.remainingHandoffDepth > 0) {
      await this.runs.appendLog(handoffRun.id, {
        level: "info",
        message: `Handoff depth remaining: ${options.remainingHandoffDepth}.`,
      });
    }
  }

  private async executeWithTimeout(input: ExecuteAgentInstructionInput) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        this.executor.execute(input),
        new Promise<never>((_resolve, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error(`Execution timeout after ${this.executionTimeoutMs}ms.`));
          }, this.executionTimeoutMs);
        }),
      ]);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
