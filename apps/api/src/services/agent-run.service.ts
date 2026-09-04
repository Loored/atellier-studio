import type { AgentRunStreamEvent, ExecutorMode, RunAgentInput, RunAgentResult } from "@atellier/shared";
import {
  AgentExecutionCancelledError,
  type AgentExecutorService,
  type ExecuteAgentInstructionInput,
} from "./agent-executor.service";
import { AgentService } from "./agent.service";
import { MessageService } from "./message.service";
import { RunService } from "./run.service";
import { validateAgentResponse } from "./agent-response-validator";

export type AgentRunExecutionOptions = {
  signal?: AbortSignal;
  maxOutputTokens?: number;
  transformResponse?: (response: string) => string;
};

export class AgentExecutionTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Execution timeout after ${timeoutMs}ms.`);
    this.name = "AgentExecutionTimeoutError";
  }
}

function assertExecutionActive(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new AgentExecutionCancelledError("Agent execution cancelled.");
  }
}

export class AgentRunService {
  private readonly maxHandoffDepth: number;
  private readonly executionTimeoutMs: number;
  private readonly verifiedRepoFiles: string[];

  constructor(
    private readonly agents: AgentService,
    private readonly runs: RunService,
    private readonly messages: MessageService,
    private readonly defaultExecutorMode: ExecutorMode,
    private readonly executorByMode: Partial<Record<ExecutorMode, AgentExecutorService>>,
    options: {
      maxHandoffDepth?: number;
      executionTimeoutMs?: number;
      verifiedRepoFiles?: string[];
    } = {},
  ) {
    const rawDepth = options.maxHandoffDepth;
    const rawTimeout = options.executionTimeoutMs;
    this.maxHandoffDepth = Number.isFinite(rawDepth) ? Math.max(0, Math.floor(rawDepth as number)) : 1;
    this.executionTimeoutMs = Number.isFinite(rawTimeout) ? Math.max(1000, rawTimeout as number) : 45_000;
    this.verifiedRepoFiles = [...new Set(options.verifiedRepoFiles ?? [])].sort();
  }

  async run(
    agentId: string,
    input: RunAgentInput,
    options: AgentRunExecutionOptions = {},
  ): Promise<RunAgentResult | null> {
    return this.runInternal(agentId, input, undefined, this.maxHandoffDepth, new Set(), options);
  }

  async runWithStream(
    agentId: string,
    input: RunAgentInput,
    emit: (event: AgentRunStreamEvent) => void,
    options: AgentRunExecutionOptions = {},
  ): Promise<RunAgentResult | null> {
    return this.runInternal(agentId, input, emit, this.maxHandoffDepth, new Set(), options);
  }

  private resolveExecutor(modeOverride?: ExecutorMode): { mode: ExecutorMode; executor: AgentExecutorService } {
    const mode = modeOverride ?? this.defaultExecutorMode;
    const executor = this.executorByMode[mode];
    if (!executor) {
      const availableModes = Object.keys(this.executorByMode).sort().join(", ");
      throw new Error(
        `Executor mode '${mode}' is not available in this API session. Available modes: ${availableModes || "none"}.`,
      );
    }
    return { mode, executor };
  }

  private async runInternal(
    agentId: string,
    input: RunAgentInput,
    emit?: (event: AgentRunStreamEvent) => void,
    remainingHandoffDepth = this.maxHandoffDepth,
    lineage = new Set<string>(),
    options: AgentRunExecutionOptions = {},
  ): Promise<RunAgentResult | null> {
    const { signal } = options;
    const agent = await this.agents.getById(agentId);
    if (!agent) {
      return null;
    }
    lineage.add(agentId);

    const { mode: selectedExecutorMode, executor } = this.resolveExecutor(input.executorModeOverride);
    const verifiedFiles = [...new Set([
      ...this.verifiedRepoFiles,
      ...(input.verifiedRepoFiles ?? []),
    ])].sort();
    emit?.({ type: "status", status: "queued" });

    const run = await this.runs.create({
      agentId,
      type: "manual",
      status: "running",
      input: {
        instruction: input.instruction,
        context: input.context,
        executorMode: selectedExecutorMode,
        ...(input.modelProfileOverride && { modelProfile: input.modelProfileOverride }),
        verifiedRepoFiles: verifiedFiles,
        ...(input.orchestrationStep && {
          orchestrationRunId: input.orchestrationStep.orchestrationRunId,
          orchestrationStepId: input.orchestrationStep.stepId,
          orchestrationStepLabel: input.orchestrationStep.label,
          orchestrationPhase: input.orchestrationStep.phase,
          orchestrationValidationProfile: input.orchestrationStep.validationProfile,
          orchestrationLogicalStepId: input.orchestrationStep.logicalStepId,
          orchestrationRepairAttempt: input.orchestrationStep.repairAttempt,
          orchestrationRepairAttemptLimit: input.orchestrationStep.repairAttemptLimit,
          orchestrationRepairKind: input.orchestrationStep.repairKind,
          orchestrationContextReceiptHash: input.orchestrationStep.contextReceiptHash,
        }),
      },
    });

    await this.agents.updateStatus(agentId, {
      status: "executing",
      lastRunId: run.id,
      currentStep: input.orchestrationStep
        ? {
            label: input.orchestrationStep.label,
            phase: input.orchestrationStep.phase,
            orchestrationRunId: input.orchestrationStep.orchestrationRunId,
            nextAgentName: input.orchestrationStep.nextAgentName,
          }
        : undefined,
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
      const execution = await this.executeWithTimeout(executor, {
        agent,
        instruction: input.instruction,
        context: input.context,
        verifiedFiles,
        signal,
        maxOutputTokens: options.maxOutputTokens,
        modelProfileOverride: input.modelProfileOverride,
      });
      assertExecutionActive(signal);

      const settledResponse = options.transformResponse
        ? options.transformResponse(execution.response)
        : execution.response;

      const validation = validateAgentResponse({
        role: agent.role,
        profile: input.orchestrationStep?.validationProfile,
        instruction: input.instruction,
        response: settledResponse,
        verifiedRepoFiles: verifiedFiles,
      });

      const combinedInvalidReferencedFiles = validation.invalidReferencedFiles;

      if (combinedInvalidReferencedFiles.length > 0) {
        await this.runs.appendLog(run.id, {
          level: "warn",
          message: `Agent response referenced unverified files: ${combinedInvalidReferencedFiles.join(", ")}`,
        });
      }

      if (validation.issues.length > 0) {
        for (const issue of validation.issues) {
          await this.runs.appendLog(run.id, {
            level: issue.severity === "error" ? "error" : "warn",
            message: `[${validation.profile ?? validation.role}] ${issue.message}`,
          });
        }
      }

      assertExecutionActive(signal);

      for (const chunk of this.chunkText(settledResponse, 80)) {
        emit?.({ type: "chunk", content: chunk });
      }
      emit?.({ type: "status", status: "finalizing" });

      const assistantMessage = await this.messages.create({
        agentId,
        runId: run.id,
        role: "assistant",
        content: settledResponse,
      });

      assertExecutionActive(signal);

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
          response: settledResponse,
          needsHuman: execution.needsHuman,
          validation: {
            role: validation.role,
            profile: validation.profile,
            passed: validation.passed,
            issues: validation.issues,
            verifiedRepoFiles: verifiedFiles,
            invalidReferencedFiles: combinedInvalidReferencedFiles,
            referencedFiles: validation.referencedFiles,
            candidateFiles: validation.candidateFiles,
            changedFiles: validation.changedFiles,
          },
        },
        suppressAutoDeliverable: input.recordDeliverable === false,
      });

      if (!completedRun) {
        return null;
      }

      const updatedAgent = await this.agents.updateStatus(agentId, {
        status: execution.needsHuman ? "needs-human" : "done",
        lastRunId: completedRun.id,
        currentStep: null,
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
          sourceResponse: settledResponse,
            handoffAgentId: input.handoffAgentId,
            handoffInstruction: input.handoffInstruction,
            remainingHandoffDepth: remainingHandoffDepth - 1,
            lineage: new Set(lineage),
            executor,
            executorMode: selectedExecutorMode,
            emit,
            signal,
          });
        }
      }

      emit?.({ type: "result", result });
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown agent execution error.";
      const cancelled = error instanceof AgentExecutionCancelledError || Boolean(signal?.aborted);
      await this.runs.appendLog(run.id, {
        level: cancelled ? "warn" : "error",
        message,
      });
      await this.runs.updateStatus(run.id, cancelled ? "cancelled" : "failed", { error: message });
      await this.agents.updateStatus(agentId, {
        status: cancelled ? "idle" : "blocked",
        lastRunId: run.id,
        currentStep: null,
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
    executor: AgentExecutorService;
    executorMode: ExecutorMode;
    emit?: (event: AgentRunStreamEvent) => void;
    signal?: AbortSignal;
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
        executorMode: options.executorMode,
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

    const handoffExecution = await this.executeWithTimeout(options.executor, {
      agent: targetAgent,
      instruction: composedInstruction,
      context: `handoff from ${options.sourceAgent.name}`,
      signal: options.signal,
    });
    assertExecutionActive(options.signal);

    const validation = validateAgentResponse({
      role: targetAgent.role,
      instruction: composedInstruction,
      response: handoffExecution.response,
      verifiedRepoFiles: this.verifiedRepoFiles,
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
        validation,
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

  private async executeWithTimeout(executor: AgentExecutorService, input: ExecuteAgentInstructionInput) {
    const controller = new AbortController();
    const timeoutError = new AgentExecutionTimeoutError(this.executionTimeoutMs);
    let timedOut = false;
    const cancelFromUpstream = (): void => {
      controller.abort(input.signal?.reason);
    };

    if (input.signal?.aborted) {
      cancelFromUpstream();
    } else {
      input.signal?.addEventListener("abort", cancelFromUpstream, { once: true });
    }

    const timeoutId = setTimeout(() => {
      timedOut = true;
      controller.abort(timeoutError);
    }, this.executionTimeoutMs);

    const aborted = new Promise<never>((_resolve, reject) => {
      const rejectForAbort = (): void => {
        reject(timedOut
          ? timeoutError
          : new AgentExecutionCancelledError("Agent execution cancelled."));
      };
      if (controller.signal.aborted) {
        rejectForAbort();
        return;
      }
      controller.signal.addEventListener("abort", rejectForAbort, { once: true });
    });

    try {
      return await Promise.race([executor.execute({ ...input, signal: controller.signal }), aborted]);
    } catch (error) {
      if (timedOut) {
        throw timeoutError;
      }
      if (input.signal?.aborted || error instanceof AgentExecutionCancelledError) {
        throw new AgentExecutionCancelledError("Agent execution cancelled.", { cause: error });
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
      input.signal?.removeEventListener("abort", cancelFromUpstream);
    }
  }
}
