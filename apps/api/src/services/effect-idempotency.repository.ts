import { randomUUID } from "node:crypto";
import type { EffectExecutionRecord } from "@atellier/shared";
import { EffectExecutionModel } from "../db/models/EffectExecution";
import { toJsonRecord, type StorageMode } from "./service-utils";

export type ClaimEffectExecutionInput = Pick<
  EffectExecutionRecord,
  "toolName" | "classification" | "idempotencyKey" | "fingerprint" | "startedAt"
>;

export type ClaimEffectExecutionResult =
  | { kind: "claimed"; record: EffectExecutionRecord }
  | { kind: "existing"; record: EffectExecutionRecord };

export interface EffectIdempotencyRepository {
  claim(input: ClaimEffectExecutionInput): Promise<ClaimEffectExecutionResult>;
  complete(
    id: string,
    result: unknown,
    completedAt: string,
  ): Promise<EffectExecutionRecord | null>;
  fail(
    id: string,
    error: string,
    failedAt: string,
  ): Promise<EffectExecutionRecord | null>;
  findByKey(idempotencyKey: string): Promise<EffectExecutionRecord | null>;
}

export class MemoryEffectIdempotencyRepository implements EffectIdempotencyRepository {
  private readonly recordsByKey = new Map<string, EffectExecutionRecord>();

  async claim(input: ClaimEffectExecutionInput): Promise<ClaimEffectExecutionResult> {
    const existing = this.recordsByKey.get(input.idempotencyKey);
    if (existing) {
      return { kind: "existing", record: structuredClone(existing) };
    }

    const record: EffectExecutionRecord = {
      id: randomUUID(),
      ...input,
      attempt: 1,
      status: "in-progress",
      createdAt: input.startedAt,
      updatedAt: input.startedAt,
    };
    this.recordsByKey.set(input.idempotencyKey, record);
    return { kind: "claimed", record: structuredClone(record) };
  }

  async complete(
    id: string,
    result: unknown,
    completedAt: string,
  ): Promise<EffectExecutionRecord | null> {
    const current = this.findById(id);
    if (!current || current.status !== "in-progress") {
      return null;
    }
    const next: EffectExecutionRecord = {
      ...current,
      status: "completed",
      result,
      completedAt,
      updatedAt: completedAt,
    };
    this.recordsByKey.set(next.idempotencyKey, next);
    return structuredClone(next);
  }

  async fail(
    id: string,
    error: string,
    failedAt: string,
  ): Promise<EffectExecutionRecord | null> {
    const current = this.findById(id);
    if (!current || current.status !== "in-progress") {
      return null;
    }
    const next: EffectExecutionRecord = {
      ...current,
      status: "failed",
      error,
      failedAt,
      updatedAt: failedAt,
    };
    this.recordsByKey.set(next.idempotencyKey, next);
    return structuredClone(next);
  }

  async findByKey(idempotencyKey: string): Promise<EffectExecutionRecord | null> {
    const record = this.recordsByKey.get(idempotencyKey);
    return record ? structuredClone(record) : null;
  }

  private findById(id: string): EffectExecutionRecord | undefined {
    return [...this.recordsByKey.values()].find((record) => record.id === id);
  }
}

export class MongoEffectIdempotencyRepository implements EffectIdempotencyRepository {
  async claim(input: ClaimEffectExecutionInput): Promise<ClaimEffectExecutionResult> {
    try {
      const record = await EffectExecutionModel.create({
        ...input,
        attempt: 1,
        status: "in-progress",
      });
      return { kind: "claimed", record: toJsonRecord<EffectExecutionRecord>(record) };
    } catch (error) {
      if (!isDuplicateKeyError(error)) {
        throw error;
      }
      const existing = await this.findByKey(input.idempotencyKey);
      if (!existing) {
        throw error;
      }
      return { kind: "existing", record: existing };
    }
  }

  async complete(
    id: string,
    result: unknown,
    completedAt: string,
  ): Promise<EffectExecutionRecord | null> {
    const record = await EffectExecutionModel.findOneAndUpdate(
      { _id: id, status: "in-progress" },
      {
        $set: {
          status: "completed",
          result,
          completedAt,
          updatedAt: new Date(completedAt),
        },
      },
      { new: true },
    );
    return record ? toJsonRecord<EffectExecutionRecord>(record) : null;
  }

  async fail(
    id: string,
    error: string,
    failedAt: string,
  ): Promise<EffectExecutionRecord | null> {
    const record = await EffectExecutionModel.findOneAndUpdate(
      { _id: id, status: "in-progress" },
      {
        $set: {
          status: "failed",
          error,
          failedAt,
          updatedAt: new Date(failedAt),
        },
      },
      { new: true },
    );
    return record ? toJsonRecord<EffectExecutionRecord>(record) : null;
  }

  async findByKey(idempotencyKey: string): Promise<EffectExecutionRecord | null> {
    const record = await EffectExecutionModel.findOne({ idempotencyKey });
    return record ? toJsonRecord<EffectExecutionRecord>(record) : null;
  }
}

export function createEffectIdempotencyRepository(
  storageMode: StorageMode,
): EffectIdempotencyRepository {
  return storageMode === "mongo"
    ? new MongoEffectIdempotencyRepository()
    : new MemoryEffectIdempotencyRepository();
}

function isDuplicateKeyError(error: unknown): boolean {
  return Boolean(
    error
    && typeof error === "object"
    && "code" in error
    && error.code === 11000,
  );
}
