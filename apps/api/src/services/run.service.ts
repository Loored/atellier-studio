import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  type AppendRunLogInput,
  type CaptureRunMemoryInput,
  type CaptureRunMemoryResponse,
  type CompleteRunInput,
  type CreateRunInput,
  type AgentValidationResult,
  type ListRunsInput,
  type Run,
  type RunExecutionPhase,
  type RunLogEntry,
  type RunReviewStatus,
  type RunStatus,
} from "@atellier/shared";
import { RunModel } from "../db/models/Run";
import { cleanUndefined, toIso, toJsonRecord, type StorageMode } from "./service-utils";
import { WikiService } from "./wiki.service";

export type RunExecutionUpdate = {
  status?: RunStatus;
  phase?: RunExecutionPhase;
  attempt?: number;
  availableAt?: string;
  leaseOwner?: string | null;
  leaseExpiresAt?: string | null;
  heartbeatAt?: string | null;
  cancelRequestedAt?: string | null;
  startedAt?: string;
  finishedAt?: string | null;
  lastError?: string | null;
  currentStepId?: string | null;
};

export class RunService {
  private readonly records = new Map<string, Run>();

  constructor(
    private readonly storageMode: StorageMode,
    private readonly wikiService: WikiService,
  ) {}

  async list(input: ListRunsInput = {}): Promise<Run[]> {
    const limit = Math.min(Math.max(input.limit ?? 30, 1), 100);
    if (this.storageMode === "mongo") {
      const query: Record<string, unknown> = {};
      if (input.type) {
        query.type = input.type;
      }
      if (input.statuses?.length) {
        query.status = { $in: input.statuses };
      }
      const runs = await RunModel.find(query).sort({ createdAt: -1 }).limit(limit);
      return toJsonRecord<Run[]>(runs);
    }

    return [...this.records.values()]
      .filter((run) => !input.type || run.type === input.type)
      .filter((run) => !input.statuses?.length || input.statuses.includes(run.status))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, limit);
  }

  async getById(id: string): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const run = await RunModel.findById(id);
      return run ? toJsonRecord<Run>(run) : null;
    }
    return this.records.get(id) ?? null;
  }

  async listByOrchestrationRunId(orchestrationRunId: string): Promise<Run[]> {
    if (this.storageMode === "mongo") {
      const runs = await RunModel.find({ "input.orchestrationRunId": orchestrationRunId }).sort({ createdAt: 1 });
      return toJsonRecord<Run[]>(runs);
    }
    return [...this.records.values()]
      .filter((r) => (r.input as Record<string, unknown> | undefined)?.orchestrationRunId === orchestrationRunId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async failInterruptedOrchestrationStepRuns(orchestrationRunId: string): Promise<number> {
    const now = new Date();
    const logEntry: RunLogEntry = {
      timestamp: now.toISOString(),
      level: "warn",
      message: "Superseded after the parent orchestration was reclaimed or retried.",
    };

    if (this.storageMode === "mongo") {
      const result = await RunModel.updateMany(
        {
          "input.orchestrationRunId": orchestrationRunId,
          status: { $in: ["queued", "running"] },
        },
        {
          $set: { status: "failed", updatedAt: now },
          $push: { logs: logEntry },
        },
      );
      return result.modifiedCount;
    }

    let settled = 0;
    for (const [id, run] of this.records) {
      const runInput = run.input as Record<string, unknown> | undefined;
      if (
        runInput?.orchestrationRunId !== orchestrationRunId
        || (run.status !== "queued" && run.status !== "running")
      ) {
        continue;
      }
      this.records.set(id, {
        ...run,
        status: "failed",
        logs: [...run.logs, logEntry],
        updatedAt: now.toISOString(),
      });
      settled += 1;
    }
    return settled;
  }

  async create(input: CreateRunInput): Promise<Run> {
    if (this.storageMode === "mongo") {
      const run = await RunModel.create({
        ...input,
        status: input.status ?? "queued",
        logs: [],
      });
      return toJsonRecord<Run>(run);
    }

    const now = new Date().toISOString();
    const run: Run = {
      id: randomUUID(),
      taskId: input.taskId,
      agentId: input.agentId,
      type: input.type,
      status: input.status ?? "queued",
      input: input.input,
      execution: input.execution,
      logs: [],
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(run.id, run);
    return run;
  }

  async appendLog(id: string, input: AppendRunLogInput): Promise<Run | null> {
    const logEntry: RunLogEntry = {
      timestamp: new Date().toISOString(),
      level: input.level ?? "info",
      message: input.message,
    };

    if (this.storageMode === "mongo") {
      const run = await RunModel.findByIdAndUpdate(
        id,
        {
          $push: { logs: logEntry },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      );
      return run ? toJsonRecord<Run>(run) : null;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next: Run = {
      ...current,
      logs: [...current.logs, logEntry],
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    return next;
  }

  async complete(id: string, input: CompleteRunInput): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const existing = await RunModel.findById(id);
      if (!existing) {
        return null;
      }
      const existingRun = toJsonRecord<Run>(existing);
      const resolvedReviewStatus =
        input.reviewStatus ??
        (existingRun.type === "review" ? "approved" : "pending");
      const resolvedDeliverablePath =
        input.deliverablePath ??
        (input.suppressAutoDeliverable
          ? undefined
          : this.buildAutoDeliverablePath(existingRun, input.summary));

      const run = await RunModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          status: "completed",
          output: input.output,
          reviewStatus: resolvedReviewStatus,
          deliverablePath: resolvedDeliverablePath,
          updatedAt: new Date(),
        }),
        { new: true },
      );

      if (!run) {
        return null;
      }

      const serialized = toJsonRecord<Run>(run);
      if (resolvedDeliverablePath) {
        await this.writeDeliverable(serialized, input.summary, resolvedDeliverablePath);
      }
      await this.appendRunCompletedLog(serialized, input);
      if (serialized.reviewStatus === "approved") {
        await this.appendDeliverableAcceptedLog(serialized);
      }
      return serialized;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next: Run = {
      ...current,
      status: "completed",
      output: input.output,
      reviewStatus: input.reviewStatus ?? (current.type === "review" ? "approved" : "pending"),
      deliverablePath:
        input.deliverablePath ??
        (input.suppressAutoDeliverable ? undefined : this.buildAutoDeliverablePath(current, input.summary)),
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    if (next.deliverablePath) {
      await this.writeDeliverable(next, input.summary, next.deliverablePath);
    }
    await this.appendRunCompletedLog(next, input);
    if (next.reviewStatus === "approved") {
      await this.appendDeliverableAcceptedLog(next);
    }
    return next;
  }

  async updateStatus(id: string, status: RunStatus, output?: unknown): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const run = await RunModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          status,
          output,
          updatedAt: new Date(),
        }),
        { new: true },
      );
      return run ? toJsonRecord<Run>(run) : null;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next: Run = {
      ...current,
      status,
      output: output ?? current.output,
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    return next;
  }

  async claimNextExecution(workerId: string, leaseMs: number): Promise<Run | null> {
    const now = new Date();
    const nowIso = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();

    if (this.storageMode === "mongo") {
      const run = await RunModel.findOneAndUpdate(
        {
          type: "orchestration",
          "execution.kind": "skill-orchestration",
          "execution.cancelRequestedAt": { $exists: false },
          $or: [
            { status: "queued", "execution.availableAt": { $lte: nowIso } },
            { status: "running", "execution.leaseExpiresAt": { $lte: nowIso } },
          ],
        },
        {
          $set: {
            status: "running",
            "execution.phase": "running",
            "execution.leaseOwner": workerId,
            "execution.leaseExpiresAt": leaseExpiresAt,
            "execution.heartbeatAt": nowIso,
            "execution.startedAt": nowIso,
            updatedAt: now,
          },
          $inc: { "execution.attempt": 1 },
        },
        { new: true, sort: { "execution.availableAt": 1, createdAt: 1 } },
      );
      return run ? toJsonRecord<Run>(run) : null;
    }

    const candidate = [...this.records.values()]
      .filter((run) => run.type === "orchestration" && run.execution?.kind === "skill-orchestration")
      .filter((run) => !run.execution?.cancelRequestedAt)
      .filter((run) => {
        if (run.status === "queued") {
          return (run.execution?.availableAt ?? nowIso) <= nowIso;
        }
        return run.status === "running" && Boolean(run.execution?.leaseExpiresAt)
          && (run.execution?.leaseExpiresAt ?? nowIso) <= nowIso;
      })
      .sort((a, b) => {
        const availability = (a.execution?.availableAt ?? a.createdAt)
          .localeCompare(b.execution?.availableAt ?? b.createdAt);
        return availability || a.createdAt.localeCompare(b.createdAt);
      })[0];

    if (!candidate?.execution) {
      return null;
    }

    const next: Run = {
      ...candidate,
      status: "running",
      execution: {
        ...candidate.execution,
        phase: candidate.execution.attempt > 0 ? "recovering" : "running",
        attempt: candidate.execution.attempt + 1,
        leaseOwner: workerId,
        leaseExpiresAt,
        heartbeatAt: nowIso,
        startedAt: nowIso,
      },
      updatedAt: nowIso,
    };
    this.records.set(next.id, next);
    return next;
  }

  async heartbeatExecution(id: string, workerId: string, leaseMs: number): Promise<boolean> {
    const now = new Date();
    const heartbeatAt = now.toISOString();
    const leaseExpiresAt = new Date(now.getTime() + leaseMs).toISOString();

    if (this.storageMode === "mongo") {
      const result = await RunModel.updateOne(
        {
          _id: id,
          status: "running",
          "execution.leaseOwner": workerId,
          "execution.cancelRequestedAt": { $exists: false },
        },
        {
          $set: {
            "execution.heartbeatAt": heartbeatAt,
            "execution.leaseExpiresAt": leaseExpiresAt,
            updatedAt: now,
          },
        },
      );
      return result.modifiedCount === 1;
    }

    const current = this.records.get(id);
    if (
      !current?.execution ||
      current.status !== "running" ||
      current.execution.leaseOwner !== workerId ||
      current.execution.cancelRequestedAt
    ) {
      return false;
    }
    this.records.set(id, {
      ...current,
      execution: { ...current.execution, heartbeatAt, leaseExpiresAt },
      updatedAt: heartbeatAt,
    });
    return true;
  }

  async updateExecution(
    id: string,
    input: RunExecutionUpdate,
    expectedLeaseOwner?: string,
  ): Promise<Run | null> {
    const now = new Date();

    if (this.storageMode === "mongo") {
      const set: Record<string, unknown> = { updatedAt: now };
      const unset: Record<string, ""> = {};
      if (input.status !== undefined) set.status = input.status;
      if (input.phase !== undefined) set["execution.phase"] = input.phase;
      if (input.attempt !== undefined) set["execution.attempt"] = input.attempt;
      if (input.availableAt !== undefined) set["execution.availableAt"] = input.availableAt;
      if (input.startedAt !== undefined) set["execution.startedAt"] = input.startedAt;

      const nullableFields = [
        "leaseOwner",
        "leaseExpiresAt",
        "heartbeatAt",
        "cancelRequestedAt",
        "finishedAt",
        "lastError",
        "currentStepId",
      ] as const;
      for (const field of nullableFields) {
        const value = input[field];
        if (value === undefined) continue;
        if (value === null) {
          unset[`execution.${field}`] = "";
        } else {
          set[`execution.${field}`] = value;
        }
      }

      const query: Record<string, unknown> = { _id: id };
      if (expectedLeaseOwner) {
        query["execution.leaseOwner"] = expectedLeaseOwner;
      }
      const update: Record<string, unknown> = { $set: set };
      if (Object.keys(unset).length > 0) {
        update.$unset = unset;
      }
      const run = await RunModel.findOneAndUpdate(query, update, { new: true });
      return run ? toJsonRecord<Run>(run) : null;
    }

    const current = this.records.get(id);
    if (!current?.execution || (expectedLeaseOwner && current.execution.leaseOwner !== expectedLeaseOwner)) {
      return null;
    }
    const nextExecution = { ...current.execution };
    const assign = <K extends keyof RunExecutionUpdate>(field: K): void => {
      const value = input[field];
      if (value === undefined) return;
      if (value === null) {
        delete (nextExecution as Record<string, unknown>)[field];
      } else if (field !== "status") {
        (nextExecution as Record<string, unknown>)[field] = value;
      }
    };
    (Object.keys(input) as Array<keyof RunExecutionUpdate>).forEach(assign);
    const next: Run = {
      ...current,
      status: input.status ?? current.status,
      execution: nextExecution,
      updatedAt: now.toISOString(),
    };
    this.records.set(id, next);
    return next;
  }

  async allocateEventSequence(id: string): Promise<number | null> {
    if (this.storageMode === "mongo") {
      const run = await RunModel.findByIdAndUpdate(
        id,
        { $inc: { "execution.nextEventSequence": 1 } },
        { new: true },
      );
      return run?.execution?.nextEventSequence ?? null;
    }

    const current = this.records.get(id);
    if (!current?.execution) {
      return null;
    }
    const sequence = current.execution.nextEventSequence + 1;
    this.records.set(id, {
      ...current,
      execution: { ...current.execution, nextEventSequence: sequence },
      updatedAt: new Date().toISOString(),
    });
    return sequence;
  }

  async updateReviewStatus(id: string, reviewStatus: RunReviewStatus): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const existing = await RunModel.findById(id);
      if (!existing) {
        return null;
      }
      const existingRun = toJsonRecord<Run>(existing);
      const validation = this.readValidation(existingRun.output);
      if (reviewStatus === "approved" && this.hasBlockingValidationIssues(validation)) {
        throw new Error(this.buildReviewBlockedMessage(validation));
      }

      const run = await RunModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          reviewStatus,
          updatedAt: new Date(),
        }),
        { new: true },
      );
      if (!run) {
        return null;
      }
      const serialized = toJsonRecord<Run>(run);
      if (reviewStatus === "approved") {
        await this.appendDeliverableAcceptedLog(serialized);
      }
      return serialized;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const validation = this.readValidation(current.output);
    if (reviewStatus === "approved" && this.hasBlockingValidationIssues(validation)) {
      throw new Error(this.buildReviewBlockedMessage(validation));
    }

    const next: Run = {
      ...current,
      reviewStatus,
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    if (reviewStatus === "approved") {
      await this.appendDeliverableAcceptedLog(next);
    }
    return next;
  }

  async captureMemory(id: string, input: CaptureRunMemoryInput = {}): Promise<CaptureRunMemoryResponse | null> {
    const run = await this.getById(id);
    if (!run) {
      return null;
    }
    if (run.status !== "completed") {
      throw new Error("Only completed runs can be captured as wiki memory.");
    }

    const summary = input.summary?.trim() || this.inferRunMemorySummary(run);
    const wikiPath = this.buildRunMemoryPath(run, summary);
    const content = this.buildRunMemoryMarkdown(run, summary);
    const page = await this.wikiService.writePage(wikiPath, content);
    const log = await this.wikiService.appendLog({
      eventType: "decision",
      title: "Run memory captured",
      summary: `Captured review memory for run ${run.id}.`,
      runId: run.id,
      taskId: run.taskId,
      agentId: run.agentId,
      details: {
        memoryPath: page.path,
        type: run.type,
        reviewStatus: run.reviewStatus ?? "none",
        deliverablePath: run.deliverablePath ?? "none",
      },
    });

    return {
      run,
      wikiPath: page.path,
      logPath: log.path,
    };
  }

  private readValidation(output: unknown): AgentValidationResult | null {
    const validation = (output as { validation?: AgentValidationResult } | undefined)?.validation;
    return validation ?? null;
  }

  private hasBlockingValidationIssues(validation: AgentValidationResult | null): boolean {
    if (!validation) {
      return false;
    }
    if (!validation.passed) {
      return true;
    }
    return (validation.issues ?? []).some((issue) => issue.severity === "error");
  }

  private buildReviewBlockedMessage(validation: AgentValidationResult | null): string {
    if (!validation) {
      return "Run validation blocked approval.";
    }

    const issueText = (validation.issues ?? [])
      .filter((issue) => issue.severity === "error")
      .slice(0, 3)
      .map((issue) => issue.message)
      .join(" ");

    return issueText
      ? `Run validation blocked approval: ${issueText}`
      : "Run validation blocked approval.";
  }

  async promoteDeliverable(id: string): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const existing = await RunModel.findById(id);
      if (!existing) {
        return null;
      }
      const existingRun = toJsonRecord<Run>(existing);
      const deliverablePath =
        existingRun.deliverablePath ??
        this.buildAutoDeliverablePath(existingRun, `Run ${existingRun.id} deliverable`);
      if (!deliverablePath) {
        return null;
      }

      const run = await RunModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          deliverablePath,
          updatedAt: new Date(),
        }),
        { new: true },
      );
      if (!run) {
        return null;
      }
      const serialized = toJsonRecord<Run>(run);
      await this.writeDeliverable(serialized, `Run ${serialized.id} deliverable`, deliverablePath);
      return serialized;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }
    const deliverablePath =
      current.deliverablePath ??
      this.buildAutoDeliverablePath(current, `Run ${current.id} deliverable`);
    if (!deliverablePath) {
      return null;
    }

    const next: Run = {
      ...current,
      deliverablePath,
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    await this.writeDeliverable(next, `Run ${next.id} deliverable`, deliverablePath);
    return next;
  }

  async unlinkDeliverable(id: string): Promise<Run | null> {
    if (this.storageMode === "mongo") {
      const existing = await RunModel.findById(id);
      if (!existing) {
        return null;
      }
      const existingRun = toJsonRecord<Run>(existing);
      const previousPath = existingRun.deliverablePath;

      const run = await RunModel.findByIdAndUpdate(
        id,
        {
          $unset: { deliverablePath: "" },
          $set: { updatedAt: new Date() },
        },
        { new: true },
      );
      if (!run) {
        return null;
      }
      if (previousPath) {
        await this.wikiService.deletePage(previousPath);
      }
      return toJsonRecord<Run>(run);
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }
    const previousPath = current.deliverablePath;
    const next: Run = {
      ...current,
      deliverablePath: undefined,
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    if (previousPath) {
      await this.wikiService.deletePage(previousPath);
    }
    return next;
  }

  private async appendRunCompletedLog(run: Run, input: CompleteRunInput): Promise<void> {
    await this.wikiService.appendLog({
      eventType: "run_completed",
      title: input.summary || "Run completed",
      summary: input.summary,
      runId: run.id,
      taskId: run.taskId,
      agentId: run.agentId,
      details: {
        type: run.type,
        status: run.status,
        reviewStatus: run.reviewStatus ?? "pending",
        deliverablePath: run.deliverablePath ?? "none",
      },
    });
  }

  private buildAutoDeliverablePath(run: Run, summary?: string): string | undefined {
    if (!summary?.trim()) {
      return undefined;
    }
    const safeSlug = summary
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48);
    const suffix = safeSlug.length > 0 ? safeSlug : run.type;
    return path.posix.join("wiki", "deliverables", `${run.id}-${suffix}.md`);
  }

  private buildRunMemoryPath(run: Run, summary: string): string {
    const slug = this.slugify(summary).slice(0, 48) || run.type;
    return path.posix.join("wiki", "synthesis", `run-${run.id}-${slug}.md`);
  }

  private inferRunMemorySummary(run: Run): string {
    const latestLog = run.logs.at(-1)?.message;
    if (latestLog?.trim()) {
      return latestLog.trim();
    }
    if (run.deliverablePath) {
      return `Review memory for ${run.deliverablePath}`;
    }
    return `Review memory for ${run.type} run`;
  }

  private buildRunMemoryMarkdown(run: Run, summary: string): string {
    const validation = this.readValidation(run.output);
    const latestLogs = run.logs.slice(-5);
    const outputText = this.stringifyUnknown(run.output);

    return [
      `# Run Memory - ${summary}`,
      "",
      "## Run",
      "",
      `- Run ID: ${run.id}`,
      `- Type: ${run.type}`,
      `- Status: ${run.status}`,
      `- Review: ${run.reviewStatus ?? "none"}`,
      `- Deliverable: ${run.deliverablePath ?? "none"}`,
      `- Created: ${run.createdAt}`,
      `- Updated: ${run.updatedAt}`,
      "",
      "## Review Summary",
      "",
      summary,
      "",
      "## Evidence",
      "",
      "### Latest Logs",
      "",
      ...(latestLogs.length > 0
        ? latestLogs.map((log) => `- ${log.timestamp} ${log.level}: ${log.message}`)
        : ["_No run logs captured._"]),
      "",
      "### Validation",
      "",
      ...(validation
        ? [
            `- Role: ${validation.role}`,
            `- Passed: ${validation.passed ? "yes" : "no"}`,
            `- Candidate files: ${validation.candidateFiles.length}`,
            `- Changed files: ${validation.changedFiles.length}`,
            `- Invalid references: ${validation.invalidReferencedFiles.length}`,
            ...(validation.issues.length > 0
              ? [
                  "",
                  "Issues:",
                  ...validation.issues.map((issue) => `- ${issue.severity}: ${issue.message}`),
                ]
              : []),
          ]
        : ["_No validation payload captured._"]),
      "",
      "### Output Snapshot",
      "",
      "```json",
      outputText,
      "```",
      "",
      "## Memory Decision",
      "",
      "This page captures reusable review context from a completed run so future work can reference the result without relying only on MongoDB state or chat history.",
      "",
    ].join("\n");
  }

  private stringifyUnknown(value: unknown): string {
    if (value === undefined) {
      return "null";
    }
    try {
      const serialized = JSON.stringify(value, null, 2);
      if (!serialized) {
        return "null";
      }
      return serialized.length > 6000 ? `${serialized.slice(0, 5997)}...` : serialized;
    } catch {
      return JSON.stringify({ unstringifiable: true }, null, 2);
    }
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  private async writeDeliverable(run: Run, summary: string | undefined, deliverablePath: string): Promise<void> {
    const content = this.buildDeliverableMarkdown(run, summary);
    await this.wikiService.writePage(deliverablePath, content);
  }

  private buildDeliverableMarkdown(run: Run, summary?: string): string {
    const title = summary?.trim() || `Run ${run.id} Deliverable`;
    const outputBlock = run.output === undefined ? "_No output captured._" : `\`\`\`json\n${JSON.stringify(run.output, null, 2)}\n\`\`\``;
    return [
      `# ${title}`,
      "",
      `- Run ID: ${run.id}`,
      `- Type: ${run.type}`,
      `- Status: ${run.status}`,
      `- Review: ${run.reviewStatus ?? "pending"}`,
      `- Created: ${run.createdAt}`,
      `- Updated: ${run.updatedAt}`,
      "",
      "## Summary",
      "",
      summary?.trim() || "Completed run deliverable.",
      "",
      "## Output",
      "",
      outputBlock,
      "",
    ].join("\n");
  }

  private async appendDeliverableAcceptedLog(run: Run): Promise<void> {
    await this.wikiService.appendLog({
      eventType: "decision",
      title: "Deliverable accepted",
      summary: "Run marked as approved.",
      runId: run.id,
      taskId: run.taskId,
      agentId: run.agentId,
      details: {
        type: run.type,
        reviewStatus: run.reviewStatus ?? "approved",
        deliverablePath: run.deliverablePath ?? "none",
      },
    });
  }
}
