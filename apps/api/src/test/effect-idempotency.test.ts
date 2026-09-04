import { describe, expect, it, vi } from "vitest";
import {
  EffectIdempotencyConflictError,
  EffectIdempotencyService,
  EffectIdempotencyValidationError,
} from "../services/effect-idempotency.service";
import { MemoryEffectIdempotencyRepository } from "../services/effect-idempotency.repository";

function createHarness() {
  const repository = new MemoryEffectIdempotencyRepository();
  let tick = 0;
  const service = new EffectIdempotencyService(
    repository,
    () => new Date(Date.UTC(2026, 7, 24, 12, 0, tick++)),
  );
  return { repository, service };
}

describe("EffectIdempotencyService", () => {
  it.each(["read", "reversible"] as const)(
    "executes a %s effect without an idempotency key",
    async (classification) => {
      const { service } = createHarness();
      const operation = vi.fn().mockResolvedValue({ ok: true });

      await expect(service.execute({ toolName: "inspect", classification }, operation))
        .resolves.toEqual({ disposition: "executed", result: { ok: true } });
      expect(operation).toHaveBeenCalledOnce();
    },
  );

  it("rejects an irreversible effect without a non-empty key before execution", async () => {
    const { service } = createHarness();
    const operation = vi.fn().mockResolvedValue("should-not-run");

    await expect(service.execute({
      toolName: "publish",
      classification: "irreversible",
      idempotencyKey: "  ",
      fingerprint: "publish:v1",
    }, operation)).rejects.toBeInstanceOf(EffectIdempotencyValidationError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("rejects an unknown classification instead of bypassing the ledger", async () => {
    const { service } = createHarness();
    const operation = vi.fn().mockResolvedValue("should-not-run");

    await expect(service.execute({
      toolName: "publish",
      classification: "unknown" as "read",
    }, operation)).rejects.toBeInstanceOf(EffectIdempotencyValidationError);
    expect(operation).not.toHaveBeenCalled();
  });

  it("persists and reuses a completed irreversible effect", async () => {
    const { service } = createHarness();
    const operation = vi.fn().mockResolvedValue({ remoteId: "delivery-1" });
    const input = {
      toolName: "publish",
      classification: "irreversible" as const,
      idempotencyKey: "run-1:publish",
      fingerprint: "publish:asset-a:v1",
    };

    const first = await service.execute(input, operation);
    const second = await service.execute(input, operation);

    expect(first.disposition).toBe("executed");
    expect(first.record).toMatchObject({
      attempt: 1,
      status: "completed",
      startedAt: "2026-08-24T12:00:00.000Z",
      completedAt: "2026-08-24T12:00:01.000Z",
      result: { remoteId: "delivery-1" },
    });
    expect(second).toMatchObject({
      disposition: "reused",
      result: { remoteId: "delivery-1" },
    });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("reports an existing attempt as in-progress without duplicating the effect", async () => {
    const { repository, service } = createHarness();
    await repository.claim({
      toolName: "send-email",
      classification: "irreversible",
      idempotencyKey: "run-2:email",
      fingerprint: "email:brief:v1",
      startedAt: "2026-08-24T11:00:00.000Z",
    });
    const operation = vi.fn().mockResolvedValue("sent");

    const outcome = await service.execute({
      toolName: "send-email",
      classification: "irreversible",
      idempotencyKey: "run-2:email",
      fingerprint: "email:brief:v1",
    }, operation);

    expect(outcome).toMatchObject({ disposition: "in-progress" });
    expect(operation).not.toHaveBeenCalled();
  });

  it("persists a failure and reports it deterministically on later calls", async () => {
    const { service } = createHarness();
    const operation = vi.fn().mockRejectedValue(new Error("Remote rejected request"));
    const input = {
      toolName: "charge",
      classification: "irreversible" as const,
      idempotencyKey: "run-3:charge",
      fingerprint: "charge:invoice-9:v1",
    };

    const first = await service.execute(input, operation);
    const second = await service.execute(input, operation);

    expect(first).toMatchObject({
      disposition: "failed",
      error: "Remote rejected request",
      record: {
        attempt: 1,
        status: "failed",
        error: "Remote rejected request",
        failedAt: "2026-08-24T12:00:01.000Z",
      },
    });
    expect(second).toMatchObject({
      disposition: "failed",
      error: "Remote rejected request",
    });
    expect(operation).toHaveBeenCalledOnce();
  });

  it("rejects reuse of a key with a different fingerprint", async () => {
    const { service } = createHarness();
    const operation = vi.fn().mockResolvedValue("sent");
    await service.execute({
      toolName: "send-email",
      classification: "irreversible",
      idempotencyKey: "run-4:email",
      fingerprint: "email:first:v1",
    }, operation);

    await expect(service.execute({
      toolName: "send-email",
      classification: "irreversible",
      idempotencyKey: "run-4:email",
      fingerprint: "email:second:v1",
    }, operation)).rejects.toBeInstanceOf(EffectIdempotencyConflictError);
    expect(operation).toHaveBeenCalledOnce();
  });

  it("allows only one concurrent claimant for an irreversible effect", async () => {
    const { service } = createHarness();
    let release!: (value: string) => void;
    const operation = vi.fn(() => new Promise<string>((resolve) => {
      release = resolve;
    }));
    const input = {
      toolName: "publish",
      classification: "irreversible" as const,
      idempotencyKey: "run-5:publish",
      fingerprint: "publish:concurrent:v1",
    };

    const firstPromise = service.execute(input, operation);
    await vi.waitFor(() => expect(operation).toHaveBeenCalledOnce());
    const second = await service.execute(input, operation);
    release("published");
    const first = await firstPromise;

    expect(second.disposition).toBe("in-progress");
    expect(first).toMatchObject({ disposition: "executed", result: "published" });
    expect(operation).toHaveBeenCalledOnce();
  });
});
