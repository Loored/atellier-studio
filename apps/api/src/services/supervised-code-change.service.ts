import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  SupervisedCodeChange,
  SupervisedCodeVerificationCheck,
  SupervisedCodeVerificationReceipt,
} from "@atellier/shared";
import { EffectIdempotencyService } from "./effect-idempotency.service";
import { type IsolatedWorktreeService, commandForVerification } from "./isolated-worktree.service";
import { ReversibleWorkspaceService } from "./reversible-workspace.service";
import { WikiService } from "./wiki.service";

export class SupervisedCodeChangesDisabledError extends Error {
  constructor() {
    super("Supervised code changes are disabled by local policy.");
    this.name = "SupervisedCodeChangesDisabledError";
  }
}

export class SupervisedCodeChangeNotFoundError extends Error {
  constructor(id: string) {
    super(`Supervised code change ${id} was not found.`);
    this.name = "SupervisedCodeChangeNotFoundError";
  }
}

export class SupervisedCodeChangeStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupervisedCodeChangeStateError";
  }
}

/**
 * Applies an approved code preview only to a disposable worktree. The primary
 * checkout is never written by this service, and verification commands are a
 * fixed server-side set rather than operator/model-supplied shell text.
 */
export class SupervisedCodeChangeService {
  private readonly activeOperations = new Map<string, "verify" | "discard">();

  constructor(
    private readonly wiki: WikiService,
    private readonly repositoryRoot: string,
    private readonly atelierRoot: string,
    private readonly worktrees: IsolatedWorktreeService,
    private readonly effects: EffectIdempotencyService,
    private readonly enabled = false,
  ) {}

  async prepare(changeId: string): Promise<SupervisedCodeChange> {
    this.assertEnabled();
    const preview = await this.wiki.getReversibleWorkspacePreview(changeId);
    if (!preview) throw new SupervisedCodeChangeNotFoundError(changeId);
    if (!this.isCodePath(preview.path)) throw new SupervisedCodeChangeStateError("Only previews under apps/ or packages/ can use supervised code changes.");
    const id = `supervised-${preview.fingerprint.slice(0, 16)}`;
    const existing = await this.wiki.getSupervisedCodeChange(id);
    if (existing) {
      const effect = this.effect("prepare", preview.fingerprint);
      await this.effects.reconcile({
        toolName: "supervised-code-change.prepare",
        idempotencyKey: effect.idempotencyKey,
        fingerprint: effect.fingerprint,
      }, existing);
      return existing;
    }
    const plan = this.verificationPlan(preview.path);
    const effect = this.effect("prepare", preview.fingerprint);
    const recoverable = await this.worktrees.find(id);
    if (recoverable) {
      const current = await new ReversibleWorkspaceService(recoverable.path).readVerifiedTextFile(preview.path);
      if (current.content !== preview.after) throw new SupervisedCodeChangeStateError("Recoverable worktree does not contain the exact approved preview.");
      const recovered = {
        id,
        changeId,
        changeFingerprint: preview.fingerprint,
        targetPath: preview.path,
        worktreePath: recoverable.path,
        baseRevision: recoverable.baseRevision,
        verificationPlan: plan,
        createdAt: new Date().toISOString(),
      };
      const reconciled = await this.effects.reconcile({
        toolName: "supervised-code-change.prepare",
        idempotencyKey: effect.idempotencyKey,
        fingerprint: effect.fingerprint,
      }, recovered);
      if (!reconciled) throw new SupervisedCodeChangeStateError("A worktree exists without a failed or stale prepare effect; automatic recovery is not authorized.");
      return this.wiki.recordSupervisedCodeChangePrepared(recovered);
    }
    const outcome = await this.effects.execute({
      toolName: "supervised-code-change.prepare",
      classification: "reversible",
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, async () => {
      const current = await this.wiki.getReversibleWorkspacePreview(changeId);
      const approval = await this.wiki.verifyReversibleWorkspaceApproval(changeId);
      if (!current || current.fingerprint !== preview.fingerprint || current.status !== "approved" || !approval.approved) {
        throw new SupervisedCodeChangeStateError("A current approval for the exact code preview is required before preparing a worktree.");
      }
      const worktree = await this.worktrees.create(id);
      try {
        await new ReversibleWorkspaceService(worktree.path).applyApprovedPreview({
          path: current.path,
          before: current.before,
          after: current.after,
          approvalValid: true,
        });
      } catch (error) {
        await this.worktrees.discard(worktree).catch(() => undefined);
        throw error;
      }
      return this.wiki.recordSupervisedCodeChangePrepared({
        id,
        changeId,
        changeFingerprint: current.fingerprint,
        targetPath: current.path,
        worktreePath: worktree.path,
        baseRevision: worktree.baseRevision,
        verificationPlan: plan,
        createdAt: new Date().toISOString(),
      });
    });
    return this.resolveEffect(outcome, "prepare");
  }

  async verify(id: string, signal?: AbortSignal): Promise<SupervisedCodeChange> {
    return this.withExclusiveOperation(id, "verify", async () => {
      this.assertEnabled();
      const supervised = await this.require(id);
      if (supervised.status === "discarded") throw new SupervisedCodeChangeStateError("Discarded worktrees cannot be verified.");
      for (const check of supervised.verificationPlan) {
        const receipt = await this.verifyCheck(supervised, check, signal);
        if (receipt.termination === "cancelled" || receipt.termination === "timed-out") break;
      }
      return this.require(id);
    });
  }

  async discard(id: string): Promise<SupervisedCodeChange> {
    return this.withExclusiveOperation(id, "discard", async () => {
      this.assertEnabled();
      const supervised = await this.require(id);
      if (supervised.status === "discarded") {
        const effect = this.effect("discard", supervised.changeFingerprint);
        await this.effects.reconcile({
          toolName: "supervised-code-change.discard",
          idempotencyKey: effect.idempotencyKey,
          fingerprint: effect.fingerprint,
        }, supervised);
        return supervised;
      }
      const effect = this.effect("discard", supervised.changeFingerprint);
      if (!await this.worktrees.find(id)) {
        const discardedAt = new Date().toISOString();
        const reconciled = await this.effects.reconcile({
          toolName: "supervised-code-change.discard",
          idempotencyKey: effect.idempotencyKey,
          fingerprint: effect.fingerprint,
        }, { id, status: "discarded", discardedAt });
        if (!reconciled) throw new SupervisedCodeChangeStateError("The worktree is missing without a failed or stale discard effect; automatic recovery is not authorized.");
        return this.wiki.recordSupervisedCodeChangeDiscarded({ id, discardedAt });
      }
      const outcome = await this.effects.execute({
        toolName: "supervised-code-change.discard",
        classification: "reversible",
        idempotencyKey: effect.idempotencyKey,
        fingerprint: effect.fingerprint,
      }, async () => {
        await this.worktrees.discard({ path: supervised.worktreePath, baseRevision: supervised.baseRevision });
        return this.wiki.recordSupervisedCodeChangeDiscarded({ id, discardedAt: new Date().toISOString() });
      });
      return this.resolveEffect(outcome, "discard");
    });
  }

  get(id: string): Promise<SupervisedCodeChange | null> {
    return this.wiki.getSupervisedCodeChange(id);
  }

  list(): Promise<SupervisedCodeChange[]> {
    return this.wiki.listSupervisedCodeChanges();
  }

  private async verifyCheck(supervised: SupervisedCodeChange, check: SupervisedCodeVerificationCheck, signal?: AbortSignal): Promise<SupervisedCodeVerificationReceipt> {
    const existing = supervised.verificationReceipts.find((receipt) => receipt.check === check);
    if (existing) {
      const effect = this.effect(`verify:${check}`, supervised.changeFingerprint);
      await this.effects.reconcile({
        toolName: "supervised-code-change.verify",
        idempotencyKey: effect.idempotencyKey,
        fingerprint: effect.fingerprint,
      }, existing);
      return existing;
    }
    const effect = this.effect(`verify:${check}`, supervised.changeFingerprint);
    const recovered = await this.recoverVerificationReceipt(supervised, check, effect);
    if (recovered) return recovered;
    const outcome = await this.effects.execute({
      toolName: "supervised-code-change.verify",
      classification: "reversible",
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, async () => {
      const result = await this.worktrees.runVerification(
        { path: supervised.worktreePath, baseRevision: supervised.baseRevision },
        check,
        { signal },
      );
      const paths = await this.persistVerificationOutput(supervised.id, check, result.stdout, result.stderr);
      const receipt: SupervisedCodeVerificationReceipt & { supervisedChangeId: string } = {
        supervisedChangeId: supervised.id,
        check,
        command: commandForVerification(check),
        status: result.termination === "completed" && result.exitCode === 0 ? "passed" : "failed",
        exitCode: result.exitCode,
        durationMs: result.durationMs,
        termination: result.termination,
        stdoutPath: paths.stdoutPath,
        stderrPath: paths.stderrPath,
        idempotencyKey: effect.idempotencyKey,
        fingerprint: effect.fingerprint,
        recordedAt: new Date().toISOString(),
      };
      await writeFile(this.verificationReceiptPath(supervised.id, check), `${JSON.stringify(receipt, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
      return this.wiki.recordSupervisedCodeVerification(receipt);
    });
    return this.resolveEffect(outcome, `verify ${check}`);
  }

  private async recoverVerificationReceipt(
    supervised: SupervisedCodeChange,
    check: SupervisedCodeVerificationCheck,
    effect: { idempotencyKey: string; fingerprint: string },
  ): Promise<SupervisedCodeVerificationReceipt | null> {
    let value: unknown;
    try {
      value = JSON.parse(await readFile(this.verificationReceiptPath(supervised.id, check), "utf8"));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw new SupervisedCodeChangeStateError("Stored verification recovery receipt is unreadable.");
    }
    if (!isVerificationRecoveryReceipt(value)
      || value.supervisedChangeId !== supervised.id
      || value.check !== check
      || value.command !== commandForVerification(check)
      || value.idempotencyKey !== effect.idempotencyKey
      || value.fingerprint !== effect.fingerprint) {
      throw new SupervisedCodeChangeStateError("Stored verification recovery receipt does not match the exact supervised check.");
    }
    const reconciled = await this.effects.reconcile({
      toolName: "supervised-code-change.verify",
      idempotencyKey: effect.idempotencyKey,
      fingerprint: effect.fingerprint,
    }, value);
    if (!reconciled) throw new SupervisedCodeChangeStateError("A verification receipt exists without a failed or stale effect; automatic recovery is not authorized.");
    return this.wiki.recordSupervisedCodeVerification(value);
  }

  private verificationReceiptPath(id: string, check: SupervisedCodeVerificationCheck): string {
    return path.join(this.atelierRoot, "runs", "artifacts", `${id}-${check}.receipt.json`);
  }

  private async persistVerificationOutput(id: string, check: SupervisedCodeVerificationCheck, stdout: string, stderr: string): Promise<{ stdoutPath: string; stderrPath: string }> {
    const base = `runs/artifacts/${id}-${check}`;
    const stdoutPath = `${base}.stdout.log`;
    const stderrPath = `${base}.stderr.log`;
    await mkdir(path.join(this.atelierRoot, "runs", "artifacts"), { recursive: true });
    await writeFile(path.join(this.atelierRoot, stdoutPath), stdout, "utf8");
    await writeFile(path.join(this.atelierRoot, stderrPath), stderr, "utf8");
    return { stdoutPath, stderrPath };
  }

  private verificationPlan(targetPath: string): SupervisedCodeVerificationCheck[] {
    if (targetPath.startsWith("apps/api/")) return ["api-typecheck", "api-tests"];
    if (targetPath.startsWith("apps/web/")) return ["web-typecheck", "web-tests"];
    return ["api-typecheck", "web-typecheck", "api-tests", "web-tests"];
  }

  private effect(operation: string, changeFingerprint: string): { idempotencyKey: string; fingerprint: string } {
    return {
      idempotencyKey: `supervised-code-change:${operation}:${changeFingerprint}`,
      fingerprint: createHash("sha256").update(JSON.stringify({ operation, changeFingerprint, repositoryRoot: this.repositoryRoot })).digest("hex"),
    };
  }

  private async require(id: string): Promise<SupervisedCodeChange> {
    const supervised = await this.get(id);
    if (!supervised) throw new SupervisedCodeChangeNotFoundError(id);
    return supervised;
  }

  private resolveEffect<TResult>(
    outcome: { disposition: "executed" | "reused"; result: TResult } | { disposition: "failed"; error: string } | { disposition: "in-progress" },
    operation: string,
  ): TResult {
    if (outcome.disposition === "executed" || outcome.disposition === "reused") return outcome.result;
    if (outcome.disposition === "failed") throw new SupervisedCodeChangeStateError(`Supervised ${operation} has a durable failed effect: ${outcome.error}`);
    throw new SupervisedCodeChangeStateError(`Supervised ${operation} is already in progress; wait for its durable receipt before retrying.`);
  }

  private assertEnabled(): void {
    if (!this.enabled) throw new SupervisedCodeChangesDisabledError();
  }

  private async withExclusiveOperation<TResult>(id: string, operation: "verify" | "discard", action: () => Promise<TResult>): Promise<TResult> {
    const active = this.activeOperations.get(id);
    if (active) throw new SupervisedCodeChangeStateError(`Supervised code change is already running ${active}; wait before ${operation}.`);
    this.activeOperations.set(id, operation);
    try {
      return await action();
    } finally {
      this.activeOperations.delete(id);
    }
  }

  private isCodePath(targetPath: string): boolean {
    return targetPath.startsWith("apps/") || targetPath.startsWith("packages/");
  }
}

function isVerificationRecoveryReceipt(value: unknown): value is SupervisedCodeVerificationReceipt & { supervisedChangeId: string } {
  if (!value || typeof value !== "object") return false;
  const receipt = value as Record<string, unknown>;
  return typeof receipt.supervisedChangeId === "string"
    && typeof receipt.check === "string"
    && typeof receipt.command === "string"
    && (receipt.status === "passed" || receipt.status === "failed")
    && (typeof receipt.exitCode === "number" || receipt.exitCode === null)
    && typeof receipt.durationMs === "number"
    && (receipt.termination === "completed" || receipt.termination === "timed-out" || receipt.termination === "cancelled")
    && typeof receipt.stdoutPath === "string"
    && typeof receipt.stderrPath === "string"
    && typeof receipt.idempotencyKey === "string"
    && typeof receipt.fingerprint === "string"
    && typeof receipt.recordedAt === "string";
}
