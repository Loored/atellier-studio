import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupervisedCodeVerificationCheck } from "@atellier/shared";
import { buildServer } from "../server";
import { createAppServices } from "../services/app-services";
import type { IsolatedWorktree, IsolatedWorktreeService, WorktreeCommandResult } from "../services/isolated-worktree.service";
import { SupervisedCodeChangeService } from "../services/supervised-code-change.service";

class FakeWorktrees implements IsolatedWorktreeService {
  readonly verificationCalls: SupervisedCodeVerificationCheck[] = [];
  readonly roots: string[] = [];
  verificationBarrier?: Promise<void>;
  onVerificationStarted?: () => void;
  verificationResult?: WorktreeCommandResult;
  createCalls = 0;

  async create(): Promise<IsolatedWorktree> {
    this.createCalls += 1;
    const root = await mkdtemp(path.join(tmpdir(), "atellier-supervised-worktree-"));
    this.roots.push(root);
    await mkdir(path.join(root, "apps", "api"), { recursive: true });
    await writeFile(path.join(root, "apps", "api", "sample.ts"), "export const value = 1;\n", "utf8");
    return { path: root, baseRevision: "a".repeat(40) };
  }

  async find(): Promise<IsolatedWorktree | null> {
    const root = this.roots.at(-1);
    if (!root) return null;
    try {
      await readFile(path.join(root, "apps", "api", "sample.ts"), "utf8");
      return { path: root, baseRevision: "a".repeat(40) };
    } catch {
      return null;
    }
  }

  async runVerification(_worktree: IsolatedWorktree, check: SupervisedCodeVerificationCheck): Promise<WorktreeCommandResult> {
    this.verificationCalls.push(check);
    this.onVerificationStarted?.();
    await this.verificationBarrier;
    return this.verificationResult ?? { stdout: `${check} passed`, stderr: "", exitCode: 0, durationMs: 12, termination: "completed" };
  }

  async discard(worktree: IsolatedWorktree): Promise<void> {
    await rm(worktree.path, { recursive: true, force: true });
  }
}

describe("supervised code change routes", () => {
  const roots: string[] = [];
  const servers: FastifyInstance[] = [];
  const worktrees: FakeWorktrees[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await Promise.all(worktrees.splice(0).flatMap((worktree) => worktree.roots.map((root) => rm(root, { recursive: true, force: true }))));
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function createFixture(enabled = true) {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "atellier-supervised-route-"));
    roots.push(workspaceRoot);
    const atelierRoot = path.join(workspaceRoot, "atelier");
    await mkdir(path.join(workspaceRoot, "apps", "api"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "apps", "api", "sample.ts"), "export const value = 1;\n", "utf8");
    const services = await createAppServices({ storageMode: "memory", atelierRoot, workspaceRoot, supervisedCodeChangesEnabled: enabled });
    const worktree = new FakeWorktrees();
    worktrees.push(worktree);
    services.supervisedCodeChanges = new SupervisedCodeChangeService(
      services.wiki,
      workspaceRoot,
      atelierRoot,
      worktree,
      services.effectIdempotency,
      enabled,
    );
    const server = await buildServer({ storageMode: "memory", atelierRoot, workspaceRoot, services });
    servers.push(server);
    return { server, services, workspaceRoot, atelierRoot, worktree };
  }

  it("keeps supervised code worktrees disabled unless explicitly enabled", async () => {
    const { server } = await createFixture(false);
    const response = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId: "change-any" } });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ error: "Supervised code changes are disabled by local policy." });
  });

  it("applies an approved code preview only inside a worktree and records server verification receipts", async () => {
    const { server, workspaceRoot, atelierRoot, worktree } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Run the reviewed code preview only in an isolated worktree.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });

    const prepared = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } });
    expect(prepared.statusCode).toBe(201);
    const supervised = prepared.json<{ id: string; worktreePath: string; status: string }>();
    expect(supervised.status).toBe("prepared");
    expect(await readFile(path.join(workspaceRoot, "apps", "api", "sample.ts"), "utf8")).toBe("export const value = 1;\n");
    expect(await readFile(path.join(supervised.worktreePath, "apps", "api", "sample.ts"), "utf8")).toBe("export const value = 2;\n");

    const verified = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervised.id}/verify` });
    expect(verified.statusCode).toBe(200);
    expect(verified.json()).toMatchObject({ status: "verified", verificationReceipts: [
      { check: "api-typecheck", status: "passed", command: "corepack pnpm --filter @atellier/api typecheck" },
      { check: "api-tests", status: "passed", command: "corepack pnpm test:api" },
    ] });
    expect(worktree.verificationCalls).toEqual(["api-typecheck", "api-tests"]);
    const receipt = verified.json<{ verificationReceipts: Array<{ stdoutPath: string }> }>().verificationReceipts[0]!;
    expect(await readFile(path.join(atelierRoot, receipt.stdoutPath), "utf8")).toContain("api-typecheck passed");

    const repeatedVerification = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervised.id}/verify` });
    expect(repeatedVerification.statusCode).toBe(200);
    expect(worktree.verificationCalls).toEqual(["api-typecheck", "api-tests"]);

    const discarded = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervised.id}/discard` });
    expect(discarded.statusCode).toBe(200);
    expect(discarded.json()).toMatchObject({ status: "discarded" });
    await expect(readFile(path.join(supervised.worktreePath, "apps", "api", "sample.ts"), "utf8")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("does not discard a worktree while its server verification is running", async () => {
    const { server, worktree } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Verify without racing discard.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    const prepared = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } });
    const supervisedId = prepared.json<{ id: string }>().id;

    let releaseVerification!: () => void;
    worktree.verificationBarrier = new Promise<void>((resolve) => { releaseVerification = resolve; });
    const verificationStarted = new Promise<void>((resolve) => { worktree.onVerificationStarted = resolve; });
    const verification = server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/verify` });
    await verificationStarted;

    const discard = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/discard` });
    expect(discard.statusCode).toBe(409);
    expect(discard.json()).toMatchObject({ error: expect.stringContaining("already running verify") });

    releaseVerification();
    expect((await verification).statusCode).toBe(200);
  });

  it("records a cancelled command as failed even when it exits cleanly after termination", async () => {
    const { server, worktree } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Cancelled checks must fail closed.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    const prepared = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } });
    worktree.verificationResult = { stdout: "handled cancellation", stderr: "", exitCode: 0, durationMs: 12, termination: "cancelled" };

    const verified = await server.inject({ method: "POST", url: `/supervised-code-changes/${prepared.json<{ id: string }>().id}/verify` });
    expect(verified.json()).toMatchObject({
      status: "verification-failed",
      verificationReceipts: [{ check: "api-typecheck", status: "failed", exitCode: 0, termination: "cancelled" }],
    });
    expect(worktree.verificationCalls).toEqual(["api-typecheck"]);
  });

  it("recovers prepared and discarded worktrees after their Wiki receipt fails", async () => {
    const { server, services, worktree } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Exercise restart recovery.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });

    const preparedReceipt = vi.spyOn(services.wiki, "recordSupervisedCodeChangePrepared");
    preparedReceipt.mockRejectedValueOnce(new Error("Injected prepare receipt failure"));
    expect((await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } })).statusCode).toBe(409);
    const recovered = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } });
    expect(recovered.statusCode).toBe(201);
    expect(recovered.json()).toMatchObject({ status: "prepared" });
    expect(worktree.createCalls).toBe(1);

    const supervisedId = recovered.json<{ id: string }>().id;
    const discardReceipt = vi.spyOn(services.wiki, "recordSupervisedCodeChangeDiscarded");
    discardReceipt.mockRejectedValueOnce(new Error("Injected discard receipt failure"));
    expect((await server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/discard` })).statusCode).toBe(409);
    const recoveredDiscard = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/discard` });
    expect(recoveredDiscard.statusCode).toBe(200);
    expect(recoveredDiscard.json()).toMatchObject({ status: "discarded" });
  });

  it("recovers a completed verification command without executing it twice", async () => {
    const { server, services, worktree } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Recover exact server verification.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    const prepared = await server.inject({ method: "POST", url: "/supervised-code-changes/prepare", payload: { changeId } });
    const supervisedId = prepared.json<{ id: string }>().id;

    const verificationReceipt = vi.spyOn(services.wiki, "recordSupervisedCodeVerification");
    verificationReceipt.mockRejectedValueOnce(new Error("Injected verification Wiki failure"));
    expect((await server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/verify` })).statusCode).toBe(409);
    expect(worktree.verificationCalls).toEqual(["api-typecheck"]);

    const recovered = await server.inject({ method: "POST", url: `/supervised-code-changes/${supervisedId}/verify` });
    expect(recovered.statusCode).toBe(200);
    expect(recovered.json()).toMatchObject({ status: "verified" });
    expect(worktree.verificationCalls).toEqual(["api-typecheck", "api-tests"]);
  });
});
