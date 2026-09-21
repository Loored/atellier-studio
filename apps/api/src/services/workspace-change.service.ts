import type {
  ApplyReversibleWorkspaceChangeResult,
  CodeChangeVerification,
  ApproveReversibleWorkspaceChangeInput,
  RecordCodeChangeVerificationInput,
  RollbackReversibleWorkspaceChangeInput,
  RollbackReversibleWorkspaceChangeResult,
  ReversibleWorkspaceApproval,
  ReversibleWorkspaceChange,
} from "@atellier/shared";
import { createHash } from "node:crypto";
import { EffectIdempotencyService } from "./effect-idempotency.service";
import { ReversibleWorkspaceService } from "./reversible-workspace.service";
import { WikiService } from "./wiki.service";

export class WorkspaceChangeNotFoundError extends Error {
  constructor(changeId: string) {
    super(`Workspace preview ${changeId} was not found.`);
    this.name = "WorkspaceChangeNotFoundError";
  }
}

export class ReversibleWorkspaceWritesDisabledError extends Error {
  constructor() {
    super("Reversible workspace writes are disabled by local policy.");
    this.name = "ReversibleWorkspaceWritesDisabledError";
  }
}

export class WorkspaceChangeVerificationRequiredError extends Error {
  constructor() {
    super("Code previews cannot be applied to the primary checkout; use server-run supervised worktree verification.");
    this.name = "WorkspaceChangeVerificationRequiredError";
  }
}

export class WorkspaceChangeRollbackHandleError extends Error {
  constructor() {
    super("A valid rollback handle for this applied workspace change is required.");
    this.name = "WorkspaceChangeRollbackHandleError";
  }
}

export class WorkspaceChangeEffectIncompleteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkspaceChangeEffectIncompleteError";
  }
}

/**
 * Owns the HTTP-facing reversible-change workflow.
 *
 * Preview, approval, and verification remain inspectable while writes are
 * disabled. Applying or rolling back needs an explicit local opt-in.
 */
export class WorkspaceChangeService {
  constructor(
    private readonly wiki: WikiService,
    private readonly workspace: ReversibleWorkspaceService,
    private readonly effects: EffectIdempotencyService,
    private readonly writesEnabled = false,
  ) {}

  async createPreview(input: { path: string; before: string; after: string }): Promise<ReversibleWorkspaceChange> {
    await this.workspace.verifyPreview(input.path, input.before);
    return this.wiki.createReversibleWorkspacePreview(input);
  }

  async approve(input: ApproveReversibleWorkspaceChangeInput): Promise<ReversibleWorkspaceApproval> {
    await this.requirePreview(input.changeId);
    return this.wiki.approveReversibleWorkspaceChange(input);
  }

  async recordCodeVerification(input: RecordCodeChangeVerificationInput): Promise<CodeChangeVerification> {
    await this.requirePreview(input.changeId);
    throw new WorkspaceChangeVerificationRequiredError();
  }

  async apply(changeId: string): Promise<ApplyReversibleWorkspaceChangeResult> {
    this.assertWritesEnabled();
    const preview = await this.requirePreview(changeId);
    if (this.workspace.isCodePath(preview.path)) throw new WorkspaceChangeVerificationRequiredError();
    const rollbackHandle = this.rollbackHandle(preview);
    const effect = this.effectInput("apply", preview, rollbackHandle);
    const result = { id: changeId, status: "applied" as const, rollbackHandle };
    if (await this.reconcilePhysicalState(preview, "apply", effect, rollbackHandle, result)) return result;
    const outcome = await this.effects.execute({
      toolName: "workspace-change.apply",
      classification: "reversible",
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, async () => {
      const current = await this.requirePreview(changeId);
      const approval = await this.wiki.verifyReversibleWorkspaceApproval(changeId);
      await this.workspace.applyApprovedPreview({
        path: current.path,
        before: current.before,
        after: current.after,
        approvalValid: approval.approved,
      });
      await this.wiki.recordReversibleWorkspaceState({
        changeId,
        status: "applied",
        idempotencyKey: effect.idempotencyKey,
        effectFingerprint: effect.fingerprint,
        rollbackHandle,
      });
      return result;
    });
    return this.resolveEffectOutcome(outcome, "apply");
  }

  async rollback(input: RollbackReversibleWorkspaceChangeInput): Promise<RollbackReversibleWorkspaceChangeResult> {
    this.assertWritesEnabled();
    const preview = await this.requirePreview(input.changeId);
    const rollbackHandle = this.rollbackHandle(preview);
    if (input.rollbackHandle !== rollbackHandle || preview.rollbackHandle !== rollbackHandle) {
      throw new WorkspaceChangeRollbackHandleError();
    }
    const effect = this.effectInput("rollback", preview, rollbackHandle);
    const result = { id: input.changeId, status: "rolled-back" as const };
    if (await this.reconcilePhysicalState(preview, "rollback", effect, rollbackHandle, result)) return result;
    const outcome = await this.effects.execute({
      toolName: "workspace-change.rollback",
      classification: "reversible",
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, async () => {
      const current = await this.requirePreview(input.changeId);
      await this.workspace.rollbackAppliedPreview({
        path: current.path,
        before: current.before,
        after: current.after,
      });
      await this.wiki.recordReversibleWorkspaceState({
        changeId: input.changeId,
        status: "rolled-back",
        idempotencyKey: effect.idempotencyKey,
        effectFingerprint: effect.fingerprint,
        rollbackHandle,
      });
      return result;
    });
    return this.resolveEffectOutcome(outcome, "rollback");
  }

  private async reconcilePhysicalState<TResult>(
    preview: ReversibleWorkspaceChange,
    operation: "apply" | "rollback",
    effect: { idempotencyKey: string; fingerprint: string },
    rollbackHandle: string,
    result: TResult,
  ): Promise<boolean> {
    const physical = await this.workspace.readVerifiedTextFile(preview.path);
    const expected = operation === "apply" ? preview.after : preview.before;
    const durableStatus = operation === "apply" ? "applied" : "rolled-back";
    if (preview.status === durableStatus) {
      if (physical.content !== expected) throw new WorkspaceChangeEffectIncompleteError(`Workspace ${operation} receipt conflicts with current file content.`);
      if (preview.lastEffect?.operation === operation
        && preview.lastEffect.idempotencyKey === effect.idempotencyKey
        && preview.lastEffect.fingerprint === effect.fingerprint) {
        await this.effects.reconcile({
          toolName: `workspace-change.${operation}`,
          idempotencyKey: effect.idempotencyKey,
          fingerprint: effect.fingerprint,
        }, result);
      }
      return true;
    }
    if (physical.content !== expected) return false;

    const reconciled = await this.effects.reconcile({
      toolName: `workspace-change.${operation}`,
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, result);
    if (!reconciled) {
      throw new WorkspaceChangeEffectIncompleteError(
        `Workspace content matches ${operation}, but no failed or stale durable effect authorizes reconciliation.`,
      );
    }
    await this.wiki.recordReversibleWorkspaceState({
      changeId: preview.id,
      status: durableStatus,
      idempotencyKey: effect.idempotencyKey,
      effectFingerprint: effect.fingerprint,
      rollbackHandle,
    });
    return true;
  }

  private async requirePreview(changeId: string): Promise<ReversibleWorkspaceChange> {
    const preview = await this.wiki.getReversibleWorkspacePreview(changeId);
    if (!preview) throw new WorkspaceChangeNotFoundError(changeId);
    return preview;
  }

  private assertWritesEnabled(): void {
    if (!this.writesEnabled) throw new ReversibleWorkspaceWritesDisabledError();
  }

  private rollbackHandle(preview: ReversibleWorkspaceChange): string {
    return this.digest({
      operation: "rollback",
      changeId: preview.id,
      changeFingerprint: preview.fingerprint,
      afterDigest: preview.afterDigest,
    });
  }

  private effectInput(
    operation: "apply" | "rollback",
    preview: ReversibleWorkspaceChange,
    rollbackHandle: string,
  ): { idempotencyKey: string; fingerprint: string } {
    const fingerprint = this.digest({
      operation,
      changeId: preview.id,
      changeFingerprint: preview.fingerprint,
      rollbackHandle: operation === "rollback" ? rollbackHandle : undefined,
    });
    return {
      idempotencyKey: `workspace-change:${operation}:${preview.fingerprint}`,
      fingerprint,
    };
  }

  private resolveEffectOutcome<TResult>(
    outcome: { disposition: "executed" | "reused"; result: TResult } | { disposition: "failed"; error: string } | { disposition: "in-progress" },
    operation: "apply" | "rollback",
  ): TResult {
    if (outcome.disposition === "executed" || outcome.disposition === "reused") return outcome.result;
    if (outcome.disposition === "failed") {
      throw new WorkspaceChangeEffectIncompleteError(`Workspace ${operation} has a durable failed effect: ${outcome.error}`);
    }
    throw new WorkspaceChangeEffectIncompleteError(`Workspace ${operation} is already in progress; wait for its durable receipt before retrying.`);
  }

  private digest(value: unknown): string {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  get(changeId: string): Promise<ReversibleWorkspaceChange | null> {
    return this.wiki.getReversibleWorkspacePreview(changeId);
  }

  list(): Promise<ReversibleWorkspaceChange[]> {
    return this.wiki.listReversibleWorkspaceChanges();
  }

  approvals(changeId: string): Promise<ReversibleWorkspaceApproval[]> {
    return this.wiki.listReversibleWorkspaceApprovals(changeId);
  }

  verifications(changeId: string): Promise<CodeChangeVerification[]> {
    return this.wiki.listCodeChangeVerifications(changeId);
  }
}
