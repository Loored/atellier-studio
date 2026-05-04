import { randomUUID } from "node:crypto";
import { type CreateTaskInput, type Task, type UpdateTaskInput } from "@atellier/shared";
import { TaskModel } from "../db/models/Task";
import { cleanUndefined, toIso, toJsonRecord, type StorageMode } from "./service-utils";

export class TaskService {
  private readonly records = new Map<string, Task>();

  constructor(private readonly storageMode: StorageMode) {}

  async list(): Promise<Task[]> {
    if (this.storageMode === "mongo") {
      const tasks = await TaskModel.find().sort({ createdAt: -1 });
      return toJsonRecord<Task[]>(tasks);
    }

    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(input: CreateTaskInput): Promise<Task> {
    if (this.storageMode === "mongo") {
      const task = await TaskModel.create({
        ...input,
        status: input.status ?? "inbox",
        priority: input.priority ?? "medium",
      });
      return toJsonRecord<Task>(task);
    }

    const now = new Date().toISOString();
    const task: Task = {
      id: randomUUID(),
      title: input.title,
      description: input.description,
      status: input.status ?? "inbox",
      priority: input.priority ?? "medium",
      clientId: input.clientId,
      projectId: input.projectId,
      sourceIds: input.sourceIds ?? [],
      assignedAgentId: input.assignedAgentId,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(task.id, task);
    return task;
  }

  async update(id: string, input: UpdateTaskInput): Promise<Task | null> {
    if (this.storageMode === "mongo") {
      const task = await TaskModel.findByIdAndUpdate(id, cleanUndefined(input), { new: true });
      return task ? toJsonRecord<Task>(task) : null;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next: Task = {
      ...current,
      ...cleanUndefined(input),
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    return next;
  }
}
