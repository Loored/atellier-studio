import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ReversibleWorkspaceService } from "../services/reversible-workspace.service";

describe("ReversibleWorkspaceService", () => {
  const roots: string[] = [];
  afterEach(async () => { await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))); });

  it("applies only an approved exact preview and rolls it back", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-reversible-")); roots.push(root);
    await mkdir(path.join(root, "docs")); const target = path.join(root, "docs", "note.md"); await writeFile(target, "before", "utf8");
    const service = new ReversibleWorkspaceService(root);
    await service.applyApprovedPreview({ path: "docs/note.md", before: "before", after: "after", approvalValid: true });
    expect(await readFile(target, "utf8")).toBe("after");
    await service.rollbackAppliedPreview({ path: "docs/note.md", before: "before", after: "after" });
    expect(await readFile(target, "utf8")).toBe("before");
  });

  it("fails closed when the preview is stale or approval is missing", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-reversible-")); roots.push(root);
    await mkdir(path.join(root, "docs")); await writeFile(path.join(root, "docs", "note.md"), "changed", "utf8");
    const service = new ReversibleWorkspaceService(root);
    await expect(service.applyApprovedPreview({ path: "docs/note.md", before: "before", after: "after", approvalValid: true })).rejects.toThrow("changed since preview");
    await expect(service.applyApprovedPreview({ path: "docs/note.md", before: "changed", after: "after", approvalValid: false })).rejects.toThrow("approval");
  });

  it("uses the identical approved preview and rollback boundary for code paths", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-reversible-")); roots.push(root);
    await mkdir(path.join(root, "apps", "api"), { recursive: true }); const target = path.join(root, "apps", "api", "sample.ts"); await writeFile(target, "export const value = 1;\n", "utf8");
    const service = new ReversibleWorkspaceService(root);
    expect(service.isCodePath("apps/api/sample.ts")).toBe(true);
    await service.applyApprovedPreview({ path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n", approvalValid: true });
    await service.rollbackAppliedPreview({ path: "apps/api/sample.ts", before: "export const value = 1;\n", after: "export const value = 2;\n" });
    expect(await readFile(target, "utf8")).toBe("export const value = 1;\n");
  });

  it("rejects raw, hidden, and symlinked paths before applying a preview", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "atellier-reversible-")); roots.push(root);
    await mkdir(path.join(root, "atelier", "raw"), { recursive: true });
    await mkdir(path.join(root, "docs"), { recursive: true });
    await writeFile(path.join(root, "atelier", "raw", "source.md"), "immutable", "utf8");
    await writeFile(path.join(root, "docs", "note.md"), "before", "utf8");
    await symlink(path.join(root, "docs", "note.md"), path.join(root, "docs", "linked.md"));
    const service = new ReversibleWorkspaceService(root);

    await expect(service.verifyPreview("atelier/raw/source.md", "immutable")).rejects.toThrow("outside reversible safe roots");
    await expect(service.verifyPreview("docs/.hidden.md", "before")).rejects.toThrow("hidden paths");
    await expect(service.verifyPreview("docs/linked.md", "before")).rejects.toThrow("regular file");
  });
});
