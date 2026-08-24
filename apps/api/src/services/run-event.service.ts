import { randomUUID } from "node:crypto";
import type {
  AppendRunEventInput,
  ListRunEventsInput,
  RunEvent,
  RunEventsResponse,
} from "@atellier/shared";
import { RunEventModel } from "../db/models/RunEvent";
import { RunService } from "./run.service";
import { toJsonRecord, type StorageMode } from "./service-utils";

export class RunEventService {
  private readonly records = new Map<string, RunEvent[]>();

  constructor(
    private readonly storageMode: StorageMode,
    private readonly runs: RunService,
  ) {}

  async append(
    runId: string,
    input: AppendRunEventInput,
    expectedLeaseOwner?: string,
  ): Promise<RunEvent> {
    const sequence = await this.runs.allocateEventSequence(runId, expectedLeaseOwner);
    if (sequence === null) {
      if (expectedLeaseOwner) {
        throw new Error(`Execution lease lost while appending ${input.type} event for run ${runId}.`);
      }
      throw new Error(`Cannot append an event to missing execution run ${runId}.`);
    }

    if (this.storageMode === "mongo") {
      const event = await RunEventModel.create({ runId, sequence, ...input });
      return toJsonRecord<RunEvent>(event);
    }

    const event: RunEvent = {
      id: randomUUID(),
      runId,
      sequence,
      type: input.type,
      phase: input.phase,
      stepId: input.stepId,
      message: input.message,
      payload: input.payload,
      createdAt: new Date().toISOString(),
    };
    const current = this.records.get(runId) ?? [];
    this.records.set(runId, [...current, event]);
    return event;
  }

  async list(runId: string, input: ListRunEventsInput = {}): Promise<RunEventsResponse> {
    const after = Math.max(input.after ?? 0, 0);
    const limit = Math.min(Math.max(input.limit ?? 100, 1), 200);
    let events: RunEvent[];

    if (this.storageMode === "mongo") {
      const records = await RunEventModel.find({ runId, sequence: { $gt: after } })
        .sort({ sequence: 1 })
        .limit(limit);
      events = toJsonRecord<RunEvent[]>(records);
    } else {
      events = (this.records.get(runId) ?? [])
        .filter((event) => event.sequence > after)
        .slice(0, limit);
    }

    return {
      events,
      nextCursor: events.at(-1)?.sequence ?? after,
    };
  }
}
