import { randomUUID } from "node:crypto";
import {
  type AppendRunLogInput,
  type CompleteRunInput,
  type CreateRunInput,
  type Run,
  type RunLogEntry,
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
      const run = await RunModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          status: "completed",
          output: input.output,
          updatedAt: new Date(),
        }),
        { new: true },
      );

      if (!run) {
        return null;
      }

      const serialized = toJsonRecord<Run>(run);
      await this.appendRunCompletedLog(serialized, input);
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
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    await this.appendRunCompletedLog(next, input);
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
      },
    });
  }
}
