import type {
  EffectExecutionRecord,
  ExecuteToolEffectInput,
  ToolEffectExecutionOutcome,
} from "@atellier/shared";
import { TOOL_EFFECT_CLASSIFICATIONS } from "@atellier/shared";
import type { EffectIdempotencyRepository } from "./effect-idempotency.repository";

export class EffectIdempotencyValidationError extends Error {
  override readonly name = "EffectIdempotencyValidationError";
}

export class EffectIdempotencyConflictError extends Error {
  override readonly name = "EffectIdempotencyConflictError";
}

export class EffectIdempotencyTransitionError extends Error {
  override readonly name = "EffectIdempotencyTransitionError";
}

export class EffectIdempotencyService {
  constructor(
    private readonly repository: EffectIdempotencyRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async execute<TResult>(
    input: ExecuteToolEffectInput,
    operation: () => Promise<TResult>,
  ): Promise<ToolEffectExecutionOutcome<TResult>> {
    const toolName = requireNonEmpty(input.toolName, "toolName");
    if (!TOOL_EFFECT_CLASSIFICATIONS.includes(input.classification)) {
      throw new EffectIdempotencyValidationError(
        `Unknown tool effect classification: ${String(input.classification)}`,
      );
    }

    if (input.classification !== "irreversible") {
      return { disposition: "executed", result: await operation() };
    }

    const idempotencyKey = requireNonEmpty(
      input.idempotencyKey,
      "idempotencyKey is required for irreversible effects",
    );
    const fingerprint = requireNonEmpty(
      input.fingerprint,
      "fingerprint is required for irreversible effects",
    );
    const startedAt = this.now().toISOString();
    const claim = await this.repository.claim({
      toolName,
      classification: "irreversible",
      idempotencyKey,
      fingerprint,
      startedAt,
    });

    if (claim.kind === "existing") {
      return this.resolveExisting<TResult>(claim.record, { toolName, fingerprint });
    }

    try {
      const result = await operation();
      const completedAt = this.now().toISOString();
      const record = await this.repository.complete(claim.record.id, result, completedAt);
      if (!record) {
        throw new EffectIdempotencyTransitionError(
          `Effect execution ${claim.record.id} could not transition to completed.`,
        );
      }
      return {
        disposition: "executed",
        result,
        record: record as EffectExecutionRecord<TResult>,
      };
    } catch (error) {
      if (error instanceof EffectIdempotencyTransitionError) {
        throw error;
      }
      const message = toErrorMessage(error);
      const failedAt = this.now().toISOString();
      const record = await this.repository.fail(claim.record.id, message, failedAt);
      if (!record) {
        throw new EffectIdempotencyTransitionError(
          `Effect execution ${claim.record.id} could not transition to failed.`,
        );
      }
      return {
        disposition: "failed",
        error: message,
        record: record as EffectExecutionRecord<TResult>,
      };
    }
  }

  private resolveExisting<TResult>(
    record: EffectExecutionRecord,
    expected: { toolName: string; fingerprint: string },
  ): ToolEffectExecutionOutcome<TResult> {
    if (record.toolName !== expected.toolName || record.fingerprint !== expected.fingerprint) {
      throw new EffectIdempotencyConflictError(
        `Idempotency key ${record.idempotencyKey} is already bound to a different effect fingerprint.`,
      );
    }

    if (record.status === "completed") {
      return {
        disposition: "reused",
        result: record.result as TResult,
        record: record as EffectExecutionRecord<TResult>,
      };
    }
    if (record.status === "failed") {
      return {
        disposition: "failed",
        error: record.error ?? "Irreversible effect failed without a recorded error.",
        record: record as EffectExecutionRecord<TResult>,
      };
    }
    return {
      disposition: "in-progress",
      record: record as EffectExecutionRecord<TResult>,
    };
  }
}

function requireNonEmpty(value: string | undefined, field: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new EffectIdempotencyValidationError(field);
  }
  return normalized;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
