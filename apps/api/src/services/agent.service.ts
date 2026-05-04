import { randomUUID } from "node:crypto";
import {
  type Agent,
  type CreateAgentInput,
  type UpdateAgentStatusInput,
} from "@atellier/shared";
import { AgentModel } from "../db/models/Agent";
import { cleanUndefined, toIso, toJsonRecord, type StorageMode } from "./service-utils";

export class AgentService {
  private readonly records = new Map<string, Agent>();

  constructor(private readonly storageMode: StorageMode) {}

  async list(): Promise<Agent[]> {
    if (this.storageMode === "mongo") {
      const agents = await AgentModel.find().sort({ createdAt: -1 });
      return toJsonRecord<Agent[]>(agents);
    }

    return [...this.records.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(input: CreateAgentInput): Promise<Agent> {
    if (this.storageMode === "mongo") {
      const agent = await AgentModel.create({
        ...input,
        status: input.status ?? "idle",
      });
      return toJsonRecord<Agent>(agent);
    }

    const now = new Date().toISOString();
    const agent: Agent = {
      id: randomUUID(),
      name: input.name,
      role: input.role,
      status: input.status ?? "idle",
      currentTaskId: input.currentTaskId,
      lastRunId: input.lastRunId,
      avatar: input.avatar,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(agent.id, agent);
    return agent;
  }

  async getById(id: string): Promise<Agent | null> {
    if (this.storageMode === "mongo") {
      const agent = await AgentModel.findById(id);
      return agent ? toJsonRecord<Agent>(agent) : null;
    }

    return this.records.get(id) ?? null;
  }

  async updateStatus(id: string, input: UpdateAgentStatusInput): Promise<Agent | null> {
    if (this.storageMode === "mongo") {
      const agent = await AgentModel.findByIdAndUpdate(
        id,
        cleanUndefined({
          status: input.status,
          currentTaskId: input.currentTaskId,
          lastRunId: input.lastRunId,
        }),
        { new: true },
      );
      return agent ? toJsonRecord<Agent>(agent) : null;
    }

    const current = this.records.get(id);
    if (!current) {
      return null;
    }

    const next: Agent = {
      ...current,
      ...cleanUndefined({
        status: input.status,
        currentTaskId: input.currentTaskId,
        lastRunId: input.lastRunId,
      }),
      updatedAt: toIso(new Date()),
    };
    this.records.set(id, next);
    return next;
  }
}
