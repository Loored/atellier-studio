import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { GitIsolatedWorktreeService } from "../services/isolated-worktree.service";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("GitIsolatedWorktreeService", () => {
  it("creates, confines, and discards a real detached Git worktree without changing its primary checkout", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-isolated-worktree-"));
    roots.push(root);
    const repositoryRoot = path.join(root, "repository");
    await mkdir(repositoryRoot, { recursive: true });
    await git(repositoryRoot, ["init"]);
    await git(repositoryRoot, ["config", "user.email", "atellier-test@example.invalid"]);
    await git(repositoryRoot, ["config", "user.name", "Atellier Test"]);
    await mkdir(path.join(repositoryRoot, "apps", "api"), { recursive: true });
    await mkdir(path.join(repositoryRoot, "apps", "web"), { recursive: true });
    await writeFile(path.join(repositoryRoot, "README.md"), "primary checkout\n", "utf8");
    await writeFile(path.join(repositoryRoot, "package.json"), JSON.stringify({
      name: "isolated-worktree-fixture",
      private: true,
      packageManager: "pnpm@9.15.4",
      scripts: { "test:api": "node -e \"process.stderr.write('expected failure\\n'); process.exit(7)\"" },
    }, null, 2), "utf8");
    await writeFile(path.join(repositoryRoot, "pnpm-workspace.yaml"), "packages:\n  - apps/*\n", "utf8");
    await writeFile(path.join(repositoryRoot, "pnpm-lock.yaml"), "lockfileVersion: '9.0'\nsettings:\n  autoInstallPeers: true\n  excludeLinksFromLockfile: false\nimporters:\n  .: {}\n  apps/api: {}\n  apps/web: {}\n", "utf8");
    await writeFile(path.join(repositoryRoot, "apps", "api", "package.json"), JSON.stringify({
      name: "@atellier/api",
      private: true,
      scripts: { typecheck: "node -e \"process.stdout.write('typecheck passed\\n')\"" },
    }, null, 2), "utf8");
    await writeFile(path.join(repositoryRoot, "apps", "web", "package.json"), JSON.stringify({
      name: "@atellier/web",
      private: true,
      scripts: { typecheck: "node -e \"setTimeout(() => process.exit(0), 10000)\"" },
    }, null, 2), "utf8");
    await git(repositoryRoot, ["add", "."]);
    await git(repositoryRoot, ["commit", "-m", "Initial fixture"]);

    const service = new GitIsolatedWorktreeService(repositoryRoot, 10_000);
    const worktree = await service.create("supervised-0123456789abcdef");

    expect(worktree.path).toBe(path.join(await realpath(root), "repository.atellier-worktrees", "supervised-0123456789abcdef"));
    expect(worktree.baseRevision).toMatch(/^[a-f0-9]{40}$/u);
    expect((await git(worktree.path, ["rev-parse", "HEAD"])).stdout.trim()).toBe(worktree.baseRevision);
    expect(await readFile(path.join(worktree.path, "README.md"), "utf8")).toBe("primary checkout\n");

    const passed = await service.runVerification(worktree, "api-typecheck");
    expect(passed).toMatchObject({ exitCode: 0, stdout: expect.stringContaining("typecheck passed") });
    const failed = await service.runVerification(worktree, "api-tests");
    expect(failed).toMatchObject({ exitCode: 7, stderr: expect.stringContaining("expected failure") });

    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);
    const cancelled = await service.runVerification(worktree, "web-typecheck", { signal: controller.signal });
    expect(cancelled).toMatchObject({ exitCode: null, termination: "cancelled" });
    expect(cancelled.durationMs).toBeLessThan(5_000);

    await writeFile(path.join(worktree.path, "README.md"), "isolated change\n", "utf8");
    expect(await readFile(path.join(repositoryRoot, "README.md"), "utf8")).toBe("primary checkout\n");

    await service.discard(worktree);
    await expect(access(worktree.path)).rejects.toMatchObject({ code: "ENOENT" });
    expect((await git(repositoryRoot, ["worktree", "list", "--porcelain"])).stdout).not.toContain(worktree.path);
  });

  it("rejects identifiers that cannot name a registered supervised worktree", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-isolated-worktree-"));
    roots.push(root);
    const service = new GitIsolatedWorktreeService(root);

    await expect(service.create("../../outside")).rejects.toThrow("identifier is invalid");
  });
});

async function git(cwd: string, argv: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", argv, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", reject);
    child.once("close", (code) => {
      const result = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") };
      if (code === 0) resolve(result);
      else reject(new Error(`git ${argv.join(" ")} failed: ${result.stderr || result.stdout}`));
    });
  });
}
