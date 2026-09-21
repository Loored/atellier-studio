import { spawn } from "node:child_process";
import { mkdir, realpath, rm } from "node:fs/promises";
import path from "node:path";
import type { SupervisedCodeVerificationCheck } from "@atellier/shared";

export type IsolatedWorktree = {
  path: string;
  baseRevision: string;
};

export type WorktreeCommandResult = {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  termination: "completed" | "timed-out" | "cancelled";
};

export interface IsolatedWorktreeService {
  create(id: string): Promise<IsolatedWorktree>;
  find(id: string): Promise<IsolatedWorktree | null>;
  runVerification(
    worktree: IsolatedWorktree,
    check: SupervisedCodeVerificationCheck,
    options?: { signal?: AbortSignal },
  ): Promise<WorktreeCommandResult>;
  discard(worktree: IsolatedWorktree): Promise<void>;
}

const VERIFICATION_COMMANDS: Readonly<Record<SupervisedCodeVerificationCheck, { command: string; argv: readonly string[] }>> = {
  "api-typecheck": { command: "corepack pnpm --filter @atellier/api typecheck", argv: ["pnpm", "--filter", "@atellier/api", "typecheck"] },
  "web-typecheck": { command: "corepack pnpm --filter @atellier/web typecheck", argv: ["pnpm", "--filter", "@atellier/web", "typecheck"] },
  "api-tests": { command: "corepack pnpm test:api", argv: ["pnpm", "test:api"] },
  "web-tests": { command: "corepack pnpm test:web", argv: ["pnpm", "test:web"] },
};

/**
 * Uses fixed argv envelopes only. Worktrees live alongside the repository,
 * never in its current checkout, and are removed only through a registered
 * `git worktree remove` call for that exact generated path.
 */
export class GitIsolatedWorktreeService implements IsolatedWorktreeService {
  constructor(
    private readonly repositoryRoot: string,
    private readonly timeoutMs = 120_000,
    private readonly maxOutputBytes = 64 * 1024,
  ) {}

  async create(id: string): Promise<IsolatedWorktree> {
    if (!/^supervised-[a-f0-9]{16}$/u.test(id)) throw new Error("Supervised worktree identifier is invalid.");
    const repositoryRoot = await realpath(this.repositoryRoot);
    const parent = path.resolve(repositoryRoot, "..", `${path.basename(repositoryRoot)}.atellier-worktrees`);
    await mkdir(parent, { recursive: true });
    const worktreeParent = await realpath(parent);
    const destination = path.join(worktreeParent, id);
    if (!isInside(worktreeParent, destination)) throw new Error("Supervised worktree path escaped its dedicated parent.");
    const base = await run("git", ["rev-parse", "HEAD"], repositoryRoot, this.timeoutMs, this.maxOutputBytes);
    if (base.exitCode !== 0) throw new Error(`Cannot resolve repository HEAD: ${base.stderr || base.stdout}`);
    const baseRevision = base.stdout.trim();
    const created = await run("git", ["worktree", "add", "--detach", destination, baseRevision], repositoryRoot, this.timeoutMs, this.maxOutputBytes);
    if (created.exitCode !== 0) throw new Error(`Cannot create isolated worktree: ${created.stderr || created.stdout}`);
    const dependencies = await run("corepack", [
      "pnpm",
      "install",
      "--offline",
      "--frozen-lockfile",
      "--ignore-scripts",
      "--package-import-method=copy",
    ], destination, this.timeoutMs, this.maxOutputBytes);
    if (dependencies.exitCode !== 0) {
      await this.removeRegisteredWorktree(repositoryRoot, destination);
      throw new Error(`Cannot prepare isolated worktree dependencies: ${dependencies.stderr || dependencies.stdout}`);
    }
    return { path: destination, baseRevision };
  }

  async find(id: string): Promise<IsolatedWorktree | null> {
    if (!/^supervised-[a-f0-9]{16}$/u.test(id)) throw new Error("Supervised worktree identifier is invalid.");
    const repositoryRoot = await realpath(this.repositoryRoot);
    const parent = path.resolve(repositoryRoot, "..", `${path.basename(repositoryRoot)}.atellier-worktrees`);
    let worktreeParent: string;
    try {
      worktreeParent = await realpath(parent);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    const expected = path.join(worktreeParent, id);
    let destination: string;
    try {
      destination = await realpath(expected);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
    if (destination !== expected || !isInside(worktreeParent, destination)) throw new Error("Supervised worktree is outside the registered parent.");
    const registered = await run("git", ["worktree", "list", "--porcelain"], repositoryRoot, this.timeoutMs, this.maxOutputBytes);
    if (registered.exitCode !== 0 || !registered.stdout.split("\n").includes(`worktree ${destination}`)) return null;
    const revision = await run("git", ["rev-parse", "HEAD"], destination, this.timeoutMs, this.maxOutputBytes);
    if (revision.exitCode !== 0) throw new Error(`Cannot resolve isolated worktree HEAD: ${revision.stderr || revision.stdout}`);
    return { path: destination, baseRevision: revision.stdout.trim() };
  }

  async runVerification(worktree: IsolatedWorktree, check: SupervisedCodeVerificationCheck, options: { signal?: AbortSignal } = {}): Promise<WorktreeCommandResult> {
    const cwd = await this.resolveRegisteredWorktree(worktree.path);
    const envelope = VERIFICATION_COMMANDS[check];
    return run("corepack", envelope.argv, cwd, this.timeoutMs, this.maxOutputBytes, options.signal);
  }

  async discard(worktree: IsolatedWorktree): Promise<void> {
    const id = path.basename(path.resolve(worktree.path));
    const existing = await this.find(id);
    if (!existing) return;
    const repositoryRoot = await realpath(this.repositoryRoot);
    const parent = path.resolve(repositoryRoot, "..", `${path.basename(repositoryRoot)}.atellier-worktrees`);
    const worktreeParent = await realpath(parent);
    const destination = await realpath(existing.path);
    if (!isInside(worktreeParent, destination) || !/^supervised-[a-f0-9]{16}$/u.test(path.basename(destination))) {
      throw new Error("Supervised worktree is outside the registered parent.");
    }
    await this.removeRegisteredWorktree(repositoryRoot, destination);
  }

  private async resolveRegisteredWorktree(worktreePath: string): Promise<string> {
    const repositoryRoot = await realpath(this.repositoryRoot);
    const parent = path.resolve(repositoryRoot, "..", `${path.basename(repositoryRoot)}.atellier-worktrees`);
    const worktreeParent = await realpath(parent);
    const candidate = await realpath(worktreePath);
    if (!isInside(worktreeParent, candidate) || !/^supervised-[a-f0-9]{16}$/u.test(path.basename(candidate))) {
      throw new Error("Verification worktree is outside the registered parent.");
    }
    return candidate;
  }

  private async removeRegisteredWorktree(repositoryRoot: string, destination: string): Promise<void> {
    const removed = await run("git", ["worktree", "remove", "--force", destination], repositoryRoot, this.timeoutMs, this.maxOutputBytes);
    if (removed.exitCode !== 0) {
      const registered = await run("git", ["worktree", "list", "--porcelain"], repositoryRoot, this.timeoutMs, this.maxOutputBytes);
      if (registered.exitCode !== 0 || registered.stdout.split("\n").includes(`worktree ${destination}`)) {
        throw new Error(`Cannot discard isolated worktree: ${removed.stderr || removed.stdout}`);
      }
    }
    // Git may unregister a worktree before reporting that ignored dependency
    // files kept its directory non-empty. The exact canonical destination was
    // already validated under the dedicated worktree parent.
    await rm(destination, { recursive: true, force: true });
  }
}

export function commandForVerification(check: SupervisedCodeVerificationCheck): string {
  return VERIFICATION_COMMANDS[check].command;
}

function run(executable: string, argv: readonly string[], cwd: string, timeoutMs: number, maxOutputBytes: number, signal?: AbortSignal): Promise<WorktreeCommandResult> {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    if (signal?.aborted) {
      resolve({ stdout: "", stderr: "Verification cancelled before execution.\n", exitCode: null, durationMs: 0, termination: "cancelled" });
      return;
    }
    const detached = process.platform !== "win32";
    const child = spawn(executable, [...argv], { cwd, detached, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = new BoundedOutput(maxOutputBytes);
    const stderr = new BoundedOutput(maxOutputBytes);
    let termination: WorktreeCommandResult["termination"] = "completed";
    let forceTimer: NodeJS.Timeout | undefined;
    const terminate = (reason: Exclude<WorktreeCommandResult["termination"], "completed">) => {
      if (termination !== "completed") return;
      termination = reason;
      killChild(child.pid, detached, "SIGTERM");
      forceTimer = setTimeout(() => killChild(child.pid, detached, "SIGKILL"), 2_000);
      forceTimer.unref();
    };
    const abort = () => terminate("cancelled");
    signal?.addEventListener("abort", abort, { once: true });
    const timer = setTimeout(() => terminate("timed-out"), timeoutMs);
    timer.unref();
    child.stdout.on("data", (chunk: Buffer | string) => stdout.append(chunk));
    child.stderr.on("data", (chunk: Buffer | string) => stderr.append(chunk));
    child.once("error", (error) => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener("abort", abort);
      reject(error);
    });
    child.once("close", (exitCode) => {
      clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      signal?.removeEventListener("abort", abort);
      resolve({ stdout: stdout.value(), stderr: stderr.value(), exitCode, durationMs: Math.max(0, Date.now() - startedAt), termination });
    });
  });
}

function killChild(pid: number | undefined, detached: boolean, signal: NodeJS.Signals): void {
  if (!pid) return;
  try {
    process.kill(detached ? -pid : pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
  }
}

class BoundedOutput {
  private readonly chunks: Buffer[] = [];
  private size = 0;

  constructor(private readonly limit: number) {}

  append(chunk: Buffer | string): void {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    const remaining = this.limit - this.size;
    if (remaining <= 0) return;
    const bounded = value.subarray(0, remaining);
    this.chunks.push(bounded);
    this.size += bounded.byteLength;
  }

  value(): string {
    return Buffer.concat(this.chunks).toString("utf8");
  }
}

function isInside(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}
