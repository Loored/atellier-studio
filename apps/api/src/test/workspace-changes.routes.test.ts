import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildServer } from "../server";
import { createAppServices } from "../services/app-services";

describe("workspace change routes", () => {
  const roots: string[] = [];
  const servers: FastifyInstance[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => server.close()));
    await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
  });

  async function createFixture(writesEnabled = false) {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), "atellier-workspace-change-route-"));
    roots.push(workspaceRoot);
    const atelierRoot = path.join(workspaceRoot, "atelier");
    await mkdir(path.join(workspaceRoot, "docs"), { recursive: true });
    await mkdir(path.join(workspaceRoot, "apps", "api"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "docs", "note.md"), "before", "utf8");
    await writeFile(path.join(workspaceRoot, "apps", "api", "sample.ts"), "export const value = 1;\n", "utf8");
    const services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      workspaceRoot,
      reversibleWorkspaceWritesEnabled: writesEnabled,
    });
    const server = await buildServer({ storageMode: "memory", atelierRoot, workspaceRoot, services });
    servers.push(server);
    return { server, services, workspaceRoot };
  }

  it("keeps reversible workspace writes disabled by default while preserving previews", async () => {
    const { server, workspaceRoot } = await createFixture();
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "docs/note.md", before: "before", after: "after" },
    });
    expect(preview.statusCode).toBe(201);

    const apply = await server.inject({
      method: "POST",
      url: `/workspace-changes/${preview.json<{ id: string }>().id}/apply`,
    });
    expect(apply.statusCode).toBe(409);
    expect(apply.json()).toMatchObject({ error: "Reversible workspace writes are disabled by local policy." });
    expect(await readFile(path.join(workspaceRoot, "docs", "note.md"), "utf8")).toBe("before");
  });

  it("requires an explicit local opt-in before an approved document preview can write", async () => {
    const { server, workspaceRoot } = await createFixture(true);
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "docs/note.md", before: "before", after: "after" },
    });
    const changeId = preview.json<{ id: string }>().id;
    const approval = await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Apply the reviewed document change.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    expect(approval.statusCode).toBe(201);

    const apply = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/apply` });
    expect(apply.statusCode).toBe(200);
    const rollbackHandle = apply.json<{ rollbackHandle: string }>().rollbackHandle;
    expect(rollbackHandle).toMatch(/^[a-f0-9]{64}$/);
    expect(await readFile(path.join(workspaceRoot, "docs", "note.md"), "utf8")).toBe("after");

    const repeatedApply = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/apply` });
    expect(repeatedApply.statusCode).toBe(200);
    expect(repeatedApply.json()).toMatchObject({ id: changeId, status: "applied", rollbackHandle });

    const applied = await server.inject({ method: "GET", url: `/workspace-changes/${changeId}` });
    expect(applied.json()).toMatchObject({
      id: changeId,
      status: "applied",
      fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/),
      rollbackHandle,
      lastEffect: { operation: "apply", idempotencyKey: expect.stringContaining("workspace-change:apply:"), fingerprint: expect.stringMatching(/^[a-f0-9]{64}$/) },
    });
    const approvals = await server.inject({ method: "GET", url: `/workspace-changes/${changeId}/approvals` });
    expect(approvals.json()).toMatchObject({ approvals: [expect.objectContaining({ changeId, changeFingerprint: expect.stringMatching(/^[a-f0-9]{64}$/), status: "active" })] });

    const missingHandle = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/rollback` });
    expect(missingHandle.statusCode).toBe(400);
    const wrongHandle = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/rollback`, payload: { rollbackHandle: "wrong" } });
    expect(wrongHandle.statusCode).toBe(409);

    const rollback = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/rollback`, payload: { rollbackHandle } });
    expect(rollback.statusCode).toBe(200);
    expect(await readFile(path.join(workspaceRoot, "docs", "note.md"), "utf8")).toBe("before");
    const rolledBack = await server.inject({ method: "GET", url: `/workspace-changes/${changeId}` });
    expect(rolledBack.json()).toMatchObject({ id: changeId, status: "rolled-back", rollbackHandle, lastEffect: { operation: "rollback" } });
    const repeatedRollback = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/rollback`, payload: { rollbackHandle } });
    expect(repeatedRollback.statusCode).toBe(200);
    const secondApproval = await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "A rolled back preview cannot be approved again.", expiresAt: "2031-01-01T00:00:00.000Z" },
    });
    expect(secondApproval.statusCode).toBe(400);
    expect(secondApproval.json()).toMatchObject({ error: "Workspace preview is no longer approvable in its current state." });

    const listed = await server.inject({ method: "GET", url: "/workspace-changes" });
    expect(listed.json()).toMatchObject({ changes: [expect.objectContaining({ id: changeId, status: "rolled-back" })] });
  });

  it("rejects raw-input previews before they can enter a reversible workflow", async () => {
    const { server, workspaceRoot } = await createFixture();
    await mkdir(path.join(workspaceRoot, "atelier", "raw"), { recursive: true });
    await writeFile(path.join(workspaceRoot, "atelier", "raw", "source.md"), "immutable", "utf8");

    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "atelier/raw/source.md", before: "immutable", after: "changed" },
    });
    expect(preview.statusCode).toBe(400);
    expect(preview.json()).toMatchObject({ error: "Workspace change path is outside reversible safe roots." });
  });

  it("does not let client-supplied verification authorize a primary-checkout code write", async () => {
    const { server, workspaceRoot } = await createFixture(true);
    const preview = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" },
    });
    const changeId = preview.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Review only in the supervised worktree.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });

    const manualVerification = await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/verification`,
      payload: { commandLabel: "api-typecheck", passed: true, summary: "Untrusted client claim." },
    });
    expect(manualVerification.statusCode).toBe(409);
    expect(manualVerification.json()).toMatchObject({ error: expect.stringContaining("supervised worktree verification") });

    const apply = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/apply` });
    expect(apply.statusCode).toBe(409);
    expect(apply.json()).toMatchObject({ error: expect.stringContaining("primary checkout") });
    expect(await readFile(path.join(workspaceRoot, "apps", "api", "sample.ts"), "utf8")).toBe("export const value = 1;\n");
  });

  it("reconciles document apply and rollback when the file write outlives a failed Wiki receipt", async () => {
    const { server, services, workspaceRoot } = await createFixture(true);
    const previewResponse = await server.inject({
      method: "POST",
      url: "/workspace-changes/preview",
      payload: { path: "docs/note.md", before: "before", after: "after" },
    });
    const changeId = previewResponse.json<{ id: string }>().id;
    await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/approval`,
      payload: { note: "Approve the exact document update.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });

    const recordState = vi.spyOn(services.wiki, "recordReversibleWorkspaceState");
    recordState.mockRejectedValueOnce(new Error("Injected Wiki receipt failure"));
    const interruptedApply = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/apply` });
    expect(interruptedApply.statusCode).toBe(409);
    expect(await readFile(path.join(workspaceRoot, "docs", "note.md"), "utf8")).toBe("after");

    const recoveredApply = await server.inject({ method: "POST", url: `/workspace-changes/${changeId}/apply` });
    expect(recoveredApply.statusCode).toBe(200);
    const rollbackHandle = recoveredApply.json<{ rollbackHandle: string }>().rollbackHandle;
    expect((await server.inject({ method: "GET", url: `/workspace-changes/${changeId}` })).json()).toMatchObject({ status: "applied" });

    recordState.mockRejectedValueOnce(new Error("Injected rollback receipt failure"));
    const interruptedRollback = await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/rollback`,
      payload: { rollbackHandle },
    });
    expect(interruptedRollback.statusCode).toBe(409);
    expect(await readFile(path.join(workspaceRoot, "docs", "note.md"), "utf8")).toBe("before");

    const recoveredRollback = await server.inject({
      method: "POST",
      url: `/workspace-changes/${changeId}/rollback`,
      payload: { rollbackHandle },
    });
    expect(recoveredRollback.statusCode).toBe(200);
    expect((await server.inject({ method: "GET", url: `/workspace-changes/${changeId}` })).json()).toMatchObject({ status: "rolled-back" });
  });

  it("does not approve previews that do not exist", async () => {
    const { server } = await createFixture();
    const approval = await server.inject({
      method: "POST",
      url: "/workspace-changes/change-missing/approval",
      payload: { note: "This must not create an orphan approval.", expiresAt: "2030-01-01T00:00:00.000Z" },
    });
    expect(approval.statusCode).toBe(404);
  });
});
