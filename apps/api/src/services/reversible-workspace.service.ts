import { lstat, readFile, realpath, rename, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";

const SAFE_ROOTS = ["docs", "atelier/wiki", "atelier/tasks", "apps", "packages"] as const;
const MAX_TEXT_BYTES = 64 * 1024;

/**
 * Bounded, atomic file replacement for an already-approved reversible preview.
 * Durable approval, idempotency, and state receipts are owned by the caller.
 */
export class ReversibleWorkspaceService {
  constructor(private readonly workspaceRoot: string) {}

  async verifyPreview(pathValue: string, expectedBefore: string): Promise<{ resolved: string }> {
    const { resolved, content } = await this.readVerifiedTextFile(pathValue);
    if (content !== expectedBefore) throw new Error("Workspace file changed since preview; create a new preview.");
    return { resolved };
  }

  async readVerifiedTextFile(pathValue: string): Promise<{ path: string; resolved: string; content: string }> {
    const normalized = this.normalizePath(pathValue);
    const workspaceRoot = await realpath(this.workspaceRoot);
    const rootPrefix = `${workspaceRoot}${path.sep}`;
    const resolved = path.resolve(workspaceRoot, normalized);
    if (!resolved.startsWith(rootPrefix)) throw new Error("Workspace change path escapes the workspace.");

    const entry = await lstat(resolved);
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Workspace change path must be a regular file.");
    if (entry.size > MAX_TEXT_BYTES) throw new Error(`Workspace change file exceeds the ${MAX_TEXT_BYTES} byte limit.`);

    const canonical = await realpath(resolved);
    if (canonical !== resolved || !canonical.startsWith(rootPrefix)) {
      throw new Error("Workspace change path cannot use symlinks.");
    }
    const current = await readFile(resolved, "utf8");
    if (current.includes("\0")) throw new Error("Workspace change path is not a text file.");
    return { path: normalized, resolved, content: current };
  }

  async applyApprovedPreview(input: { path: string; before: string; after: string; approvalValid: boolean }): Promise<void> {
    if (!input.approvalValid) throw new Error("A current durable approval is required before applying a workspace change.");
    await this.replaceVerifiedTextFile(input.path, input.before, input.after);
  }

  async rollbackAppliedPreview(input: { path: string; before: string; after: string }): Promise<void> {
    await this.replaceVerifiedTextFile(input.path, input.after, input.before);
  }

  isCodePath(pathValue: string): boolean {
    const normalized = pathValue.trim().replace(/\\/g, "/");
    return normalized.startsWith("apps/") || normalized.startsWith("packages/");
  }

  private normalizePath(pathValue: string): string {
    const normalized = pathValue.trim().replace(/\\/g, "/");
    const segments = normalized.split("/");
    if (!normalized || normalized.startsWith("/") || segments.some((part) => part === "." || part === ".." || part.startsWith("."))) {
      throw new Error("Workspace change path must be relative, non-traversing, and cannot include hidden paths.");
    }
    if (!SAFE_ROOTS.some((root) => normalized === root || normalized.startsWith(`${root}/`))) {
      throw new Error("Workspace change path is outside reversible safe roots.");
    }
    return normalized;
  }

  /**
   * A temp file in the target directory plus rename keeps readers from seeing
   * a partial document. Re-validating immediately before the rename closes the
   * stale-preview window as far as this local filesystem boundary allows.
   */
  private async replaceVerifiedTextFile(pathValue: string, expectedCurrent: string, replacement: string): Promise<void> {
    const { resolved } = await this.verifyPreview(pathValue, expectedCurrent);
    const temporaryPath = path.join(
      path.dirname(resolved),
      `.${path.basename(resolved)}.atellier-${randomUUID()}.tmp`,
    );
    try {
      await writeFile(temporaryPath, replacement, { encoding: "utf8", flag: "wx" });
      await this.verifyPreview(pathValue, expectedCurrent);
      await rename(temporaryPath, resolved);
    } finally {
      await unlink(temporaryPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== "ENOENT") throw error;
      });
    }
  }
}
