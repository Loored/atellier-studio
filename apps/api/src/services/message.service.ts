import { randomUUID } from "node:crypto";
import type { AgentMessage, CreateAgentMessageInput } from "@atellier/shared";
import { MessageModel } from "../db/models/Message";
import { toIso, toJsonRecord, type StorageMode } from "./service-utils";

export class MessageService {
  private readonly records = new Map<string, AgentMessage>();

  constructor(private readonly storageMode: StorageMode) {}

  async listByAgent(agentId: string): Promise<AgentMessage[]> {
    if (this.storageMode === "mongo") {
      const messages = await MessageModel.find({ agentId }).sort({ createdAt: 1 }).limit(100);
      return toJsonRecord<AgentMessage[]>(messages);
    }

    return [...this.records.values()]
      .filter((message) => message.agentId === agentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async create(input: CreateAgentMessageInput): Promise<AgentMessage> {
    if (this.storageMode === "mongo") {
      const message = await MessageModel.create(input);
      return toJsonRecord<AgentMessage>(message);
    }

    const now = new Date().toISOString();
    const message: AgentMessage = {
      id: randomUUID(),
      agentId: input.agentId,
      runId: input.runId,
      role: input.role,
      content: input.content,
      createdAt: now,
      updatedAt: now,
    };
    this.records.set(message.id, message);
    return message;
  }
}
