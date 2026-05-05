import { randomUUID } from "node:crypto";
import path from "node:path";
import {
  type AppendRunLogInput,
  type CompleteRunInput,
  type CreateRunInput,
  type Run,
  type RunLogEntry,
  type RunReviewStatus,
  type RunStatus,
} from "@atellier/shared";
import { RunModel } from "../db/models/Run";
import { cleanUndefined, toIso, toJsonRecord, type StorageMode } from "./service-utils";
import { WikiService } from "./wiki.service";

export class RunService {
  private readonly records = new Map<string, Run>();

  constructor(
    private readonly storageMode: StorageMode,
    private readonly wikiService: WikiService,
  ) {}

  async list(): Promise<Run[]> {
    if (this.storageMode === "mongo") {
      const runs = await RunModel.find().sort({ createdAt: -1 }).limit(30);
      return toJsonRecord<Run[]>(runs);
    }

    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
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

  async updateReviewStatus(id: string, reviewStatus: RunReviewStatus): Promise<Run | null> {
    if (this.storageMode === "mongo") {
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
