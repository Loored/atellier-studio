import { createHash } from "node:crypto";
import type {
  AgentRunEvaluation,
  AgentRunStreamEvent,
  AgentValidationResult,
  EvaluationTerminalStatus,
  ExecutorMode,
  ExecutionBudgetReceipt,
  ModelProfile,
  Run,
  RunAgentInput,
  RunAgentResult,
} from "@atellier/shared";
import {
  AgentExecutionCancelledError,
  type AgentExecutorService,
  type ExecuteAgentInstructionInput,
} from "./agent-executor.service";
import { AgentService } from "./agent.service";
import { MessageService } from "./message.service";
import { RunService } from "./run.service";
import { validateAgentResponse } from "./agent-response-validator";
import { parseAgentToolRequest, ToolHarnessService } from "./tool-harness.service";

export type AgentRunExecutionOptions = {
  signal?: AbortSignal;
  maxOutputTokens?: number;
  transformResponse?: (response: string) => string;
  /** Internal-only receipt revalidated by DurableRuntimeService. */
  executionBudget?: ExecutionBudgetReceipt;
  /** Only the initial Build Loop artifact may recover a repeated post-tool request once. */
  completeArtifactAfterTool?: boolean;
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
    private readonly toolHarness?: ToolHarnessService,
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
    const { signal, executionBudget } = options;
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

    const modelProfile = input.modelProfileOverride ?? "standard";
    const boundedContext = executionBudget
      ? this.truncateUtf8(input.context, executionBudget.limits.contextBytes)
      : input.context;
    const run = await this.runs.create({
      agentId,
      type: "manual",
      status: "running",
      input: {
        instruction: input.instruction,
        context: boundedContext,
        executorMode: selectedExecutorMode,
        ...(input.modelProfileOverride && { modelProfile: input.modelProfileOverride }),
        ...(executionBudget && {
          controlBudgetReceiptId: executionBudget.id,
          controlBundleFingerprint: executionBudget.bundleFingerprint,
          controlBudgetAssignmentFingerprint: executionBudget.assignmentFingerprint,
        }),
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
      const timeoutMs = executionBudget
        ? Math.min(this.executionTimeoutMs, executionBudget.limits.executionTimeoutMs)
        : this.executionTimeoutMs;
      const deadline = Date.now() + timeoutMs;
      const remainingTimeoutMs = () => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) throw new AgentExecutionTimeoutError(timeoutMs);
        return remaining;
      };
      const modelOverride = executionBudget?.modelProfiles[modelProfile];
      const allowedReadTools = this.toolHarness?.listCatalog().definitions
        .filter((tool) => tool.classification === "read" && tool.autonomy === "automatic"
          && tool.executionState === "available" && tool.allowedRoles.includes(agent.role)
          && (!executionBudget || executionBudget.allowedTools.includes(tool.name)))
        .map((tool) => tool.name) ?? [];
      let execution = await this.executeWithTimeout(executor, {
        agent,
        instruction: input.instruction,
        context: boundedContext,
        verifiedFiles,
        signal,
        maxOutputTokens: options.maxOutputTokens,
        modelProfileOverride: input.modelProfileOverride,
        modelOverride,
        allowedReadTools,
      }, remainingTimeoutMs());
      assertExecutionActive(signal);

      const toolRequest = parseAgentToolRequest(execution.response);
      if (toolRequest) {
        if (!this.toolHarness) {
          throw new Error("Tool Harness is not configured for agent execution.");
        }
        const toolResponse = await this.toolHarness.invoke({
          parentRunId: run.id,
          toolName: toolRequest.toolName,
          agentRole: agent.role,
          input: toolRequest.input,
        }, executionBudget ? { allowedTools: executionBudget.allowedTools } : undefined);
        assertExecutionActive(signal);
        const resultContext = toolResponse.result === undefined
          ? `Tool request was ${toolResponse.invocation.status}: ${toolResponse.invocation.outputSummary}`
          : JSON.stringify(toolResponse.result).slice(0, 6000);
        execution = await this.executeWithTimeout(executor, {
          agent,
          instruction: [
            input.instruction,
            "",
            "A bounded Tool Harness result is available below. Use it to answer the original instruction. Do not request another tool.",
            resultContext,
          ].join("\n"),
          context: boundedContext,
          verifiedFiles,
          signal,
          maxOutputTokens: options.maxOutputTokens,
          modelProfileOverride: input.modelProfileOverride,
          modelOverride,
          allowedReadTools: [],
        }, remainingTimeoutMs());
        assertExecutionActive(signal);
        if (options.completeArtifactAfterTool
          && toolResponse.invocation.status === "succeeded"
          && (!executionBudget || executionBudget.limits.maxRetries >= 1)
          && parseAgentToolRequest(execution.response)) {
          await this.runs.appendLog(run.id, {
            level: "warn",
            message: "Builder repeated a tool request after the bounded result; one final artifact-only completion is allowed without invoking another tool.",
          });
          execution = await this.executeWithTimeout(executor, {
            agent,
            instruction: [
              input.instruction,
              "",
              "The previous read-only tool result has already been returned. No further tool request can be executed.",
              "Return the complete Requested Artifact now, with every operator-required entry and field. Do not return TOOL_REQUEST, an introduction, or a promise to produce the artifact later.",
              "Bounded result:",
              resultContext,
            ].join("\n"),
            context: boundedContext,
            verifiedFiles,
            signal,
            maxOutputTokens: options.maxOutputTokens,
            modelProfileOverride: input.modelProfileOverride,
            modelOverride,
            allowedReadTools: [],
          }, remainingTimeoutMs());
          assertExecutionActive(signal);
        }
      }

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
          ...(execution.resolvedModel ? { resolvedModel: execution.resolvedModel } : {}),
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
      const evaluatedRun = await this.recordTerminalEvaluation({
        run: completedRun,
        terminalStatus: "completed",
        validation,
        needsHuman: execution.needsHuman,
        executorMode: selectedExecutorMode,
        modelProfile: input.modelProfileOverride ?? "standard",
        resolvedModel: execution.resolvedModel,
        agentRole: agent.role,
        configurationFingerprint: executionBudget?.bundleFingerprint,
      });
      if (!evaluatedRun) return null;

      const updatedAgent = await this.agents.updateStatus(agentId, {
        status: execution.needsHuman ? "needs-human" : "done",
        lastRunId: evaluatedRun.id,
        currentStep: null,
      });

      if (!updatedAgent) {
        return null;
      }

      const result = {
        agent: updatedAgent,
        run: evaluatedRun,
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
      const terminalRun = await this.runs.updateStatus(run.id, cancelled ? "cancelled" : "failed", { error: message });
      if (terminalRun) {
        try {
          await this.recordTerminalEvaluation({
            run: terminalRun,
            terminalStatus: terminalRun.status === "cancelled" ? "cancelled" : "failed",
            needsHuman: false,
            executorMode: selectedExecutorMode,
            modelProfile: input.modelProfileOverride ?? "standard",
            agentRole: agent.role,
            configurationFingerprint: executionBudget?.bundleFingerprint,
            error: {
              kind: cancelled ? "cancelled" : error instanceof AgentExecutionTimeoutError ? "timeout" : "executor",
              message,
            },
          });
        } catch (evaluationError) {
          const evaluationMessage = evaluationError instanceof Error ? evaluationError.message : "Unable to record terminal evaluation.";
          await this.runs.appendLog(run.id, { level: "error", message: `Terminal evaluation was not recorded: ${evaluationMessage}` });
        }
      }
      await this.agents.updateStatus(agentId, {
        status: cancelled ? "idle" : "blocked",
        lastRunId: run.id,
        currentStep: null,
      });
      emit?.({ type: "error", message });
      throw error;
    }
  }

  private async recordTerminalEvaluation(input: {
    run: Run;
    terminalStatus: EvaluationTerminalStatus;
    validation?: AgentValidationResult;
    needsHuman: boolean;
    executorMode: ExecutorMode;
    modelProfile: ModelProfile;
    resolvedModel?: string;
    agentRole: string;
    configurationFingerprint?: string;
    error?: AgentRunEvaluation["error"];
  }): Promise<Run | null> {
    const toolInvocations = (input.run.toolInvocations ?? []).reduce(
      (counts, invocation) => {
        counts[invocation.status] += 1;
        return counts;
      },
      { succeeded: 0, denied: 0, failed: 0 },
    );
    const runInput = input.run.input && typeof input.run.input === "object"
      ? input.run.input as Record<string, unknown>
      : {};
    const orchestration = {
      runId: this.stringRunInput(runInput, "orchestrationRunId"),
      stepId: this.stringRunInput(runInput, "orchestrationStepId"),
      logicalStepId: this.stringRunInput(runInput, "orchestrationLogicalStepId"),
      repairAttempt: this.numberRunInput(runInput, "orchestrationRepairAttempt"),
      repairKind: this.stringRunInput(runInput, "orchestrationRepairKind"),
    };
    const hasOrchestrationEvidence = Object.values(orchestration).some((value) => value !== undefined);
    const validationPassed = input.validation?.passed ?? false;
    const outcome = input.terminalStatus === "cancelled"
      ? "cancelled" as const
      : input.terminalStatus === "completed"
        ? validationPassed ? (input.needsHuman ? "needs-human" : "passed") : "failed"
        : "failed" as const;
    const startedAt = input.run.createdAt;
    const completedAt = input.run.updatedAt;
    const durationMs = Math.max(0, Date.parse(completedAt) - Date.parse(startedAt));
    const fingerprintSource = {
      runId: input.run.id,
      terminalStatus: input.terminalStatus,
      outcome,
      validationPassed,
      needsHuman: input.needsHuman,
      executorMode: input.executorMode,
      modelProfile: input.modelProfile,
      resolvedModel: input.resolvedModel,
      agentRole: input.agentRole,
      configurationFingerprint: input.configurationFingerprint,
      orchestration: hasOrchestrationEvidence ? orchestration : undefined,
      contextReceiptHash: this.stringRunInput(runInput, "orchestrationContextReceiptHash"),
      toolInvocations,
      startedAt,
      completedAt,
      durationMs,
      error: input.error,
    };
    const evaluation: AgentRunEvaluation = {
      schemaVersion: 2,
      evaluationId: `terminal:${input.run.id}`,
      fingerprint: createHash("sha256").update(JSON.stringify(fingerprintSource)).digest("hex"),
      runId: input.run.id,
      terminalStatus: input.terminalStatus,
      outcome,
      validationPassed,
      needsHuman: input.needsHuman,
      executorMode: input.executorMode,
      modelProfile: input.modelProfile,
      ...(input.resolvedModel ? { resolvedModel: input.resolvedModel } : {}),
      agentRole: input.agentRole,
      ...(input.configurationFingerprint ? { configurationFingerprint: input.configurationFingerprint } : {}),
      ...(hasOrchestrationEvidence ? { orchestration } : {}),
      ...(this.stringRunInput(runInput, "orchestrationContextReceiptHash") ? { contextReceiptHash: this.stringRunInput(runInput, "orchestrationContextReceiptHash") } : {}),
      toolInvocations,
      startedAt,
      completedAt,
      durationMs,
      ...(input.error ? { error: input.error } : {}),
      recordedAt: new Date().toISOString(),
    };
    return this.runs.recordEvaluation(input.run.id, evaluation);
  }

  private stringRunInput(input: Record<string, unknown>, key: string): string | undefined {
    const value = input[key];
    return typeof value === "string" && value.trim() ? value : undefined;
  }

  private numberRunInput(input: Record<string, unknown>, key: string): number | undefined {
    const value = input[key];
    return typeof value === "number" && Number.isFinite(value) ? value : undefined;
  }

  private truncateUtf8(value: string | undefined, maxBytes: number): string | undefined {
    if (!value) return value;
    const source = Buffer.from(value, "utf8");
    if (source.byteLength <= maxBytes) return value;
    return source.subarray(0, Math.max(0, maxBytes)).toString("utf8").replace(/\uFFFD$/u, "");
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

    const completedHandoffRun = await this.runs.complete(handoffRun.id, {
      summary: `${targetAgent.name} completed handoff execution.`,
      output: {
        handoffFromRunId: options.sourceRunId,
        response: handoffExecution.response,
        messageId: handoffAssistantMessage.id,
        validation,
      },
    });

    if (completedHandoffRun) {
      await this.recordTerminalEvaluation({
        run: completedHandoffRun,
        terminalStatus: "completed",
        validation,
        needsHuman: true,
        executorMode: options.executorMode,
        modelProfile: "standard",
        agentRole: targetAgent.role,
      });
    }

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

  private async executeWithTimeout(
    executor: AgentExecutorService,
    input: ExecuteAgentInstructionInput,
    timeoutMs = this.executionTimeoutMs,
  ) {
    const controller = new AbortController();
    const timeoutError = new AgentExecutionTimeoutError(timeoutMs);
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
    }, timeoutMs);

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
