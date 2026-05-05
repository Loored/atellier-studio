import { mkdir, readFile, writeFile, appendFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import { type AppendWikiLogInput, type AppendWikiLogResponse, type WikiPageResponse } from "@atellier/shared";

const DEFAULT_INDEX = `# Atellier Studio Wiki Index

| Path | Summary | Category | Last updated | Source count |
| --- | --- | --- | --- | --- |
| [log.md](./log.md) | Chronological operational log for ingests, runs, decisions, and wiki maintenance. | operations | 2026-05-04 | 0 |

## Categories

- clients
- projects
- entities
- workflows
- decisions
- synthesis
`;

const DEFAULT_LOG = `# Atellier Studio Wiki Log

## [2026-05-04T00:00:00.000Z] initialization | Milestone 0 wiki log created

- Summary: Initial durable wiki log for Atellier Studio operational memory.
`;

export class WikiService {
  private readonly wikiRoot: string;
  private readonly atelierRootResolved: string;

  constructor(private readonly atelierRoot: string) {
    this.atelierRootResolved = path.resolve(atelierRoot);
    this.wikiRoot = path.join(this.atelierRootResolved, "wiki");
  }

  get indexPath(): string {
    return path.join(this.wikiRoot, "index.md");
  }

  get logPath(): string {
    return path.join(this.wikiRoot, "log.md");
  }

  async ensureWiki(): Promise<void> {
    await mkdir(this.wikiRoot, { recursive: true });
    await Promise.all(
      ["clients", "projects", "entities", "workflows", "decisions", "synthesis", "deliverables"].map((segment) =>
        mkdir(path.join(this.wikiRoot, segment), { recursive: true }),
      ),
    );
    await this.ensureFile(this.indexPath, DEFAULT_INDEX);
    await this.ensureFile(this.logPath, DEFAULT_LOG);
  }

  async readIndex(): Promise<WikiPageResponse> {
    await this.ensureWiki();
    return {
      path: this.indexPath,
      content: await readFile(this.indexPath, "utf8"),
      ready: true,
    };
  }

  async readLog(): Promise<WikiPageResponse> {
    await this.ensureWiki();
    return {
      path: this.logPath,
      content: await readFile(this.logPath, "utf8"),
      ready: true,
    };
  }

  async readPage(relativePath: string): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const { normalized, resolved } = this.resolveAtelierPath(relativePath);

    return {
      path: normalized,
      content: await readFile(resolved, "utf8"),
      ready: true,
    };
  }

  async writePage(relativePath: string, content: string): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const { normalized, resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf8");
    if (this.isDeliverableMarkdownPath(normalized)) {
      await this.refreshDeliverablesIndex();
    }

    return {
      path: normalized,
      content,
      ready: true,
    };
  }

  async deletePage(relativePath: string): Promise<void> {
    await this.ensureWiki();
    const { normalized, resolved } = this.resolveAtelierPath(relativePath);
    await rm(resolved, { force: true });
    if (this.isDeliverableMarkdownPath(normalized)) {
      await this.refreshDeliverablesIndex();
    }
  }

  async appendLog(input: AppendWikiLogInput): Promise<AppendWikiLogResponse> {
    await this.ensureWiki();

    const entry = this.formatEntry(input);
    await appendFile(this.logPath, `\n${entry}`, "utf8");

    return {
      path: this.logPath,
      entry,
    };
  }

  private async ensureFile(filePath: string, content: string): Promise<void> {
    try {
      await readFile(filePath, "utf8");
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "ENOENT") {
        throw error;
      }
      await writeFile(filePath, content, "utf8");
    }
  }

  private resolveAtelierPath(relativePath: string): { normalized: string; resolved: string } {
    const normalized = relativePath.trim();
    if (!normalized) {
      throw new Error("Wiki page path is required.");
    }

    const resolved = path.resolve(this.atelierRootResolved, normalized);
    const prefix = `${this.atelierRootResolved}${path.sep}`;
    if (!(resolved === this.atelierRootResolved || resolved.startsWith(prefix))) {
      throw new Error("Wiki page path is outside atelier root.");
    }

    return { normalized, resolved };
  }

  private isDeliverableMarkdownPath(relativePath: string): boolean {
    const normalized = relativePath.replace(/\\/g, "/");
    return normalized.startsWith("wiki/deliverables/") &&
      normalized.endsWith(".md") &&
      normalized !== "wiki/deliverables/index.md";
  }

  private async refreshDeliverablesIndex(): Promise<void> {
    const deliverablesDir = path.join(this.wikiRoot, "deliverables");
    await mkdir(deliverablesDir, { recursive: true });
    const fileNames = await readdir(deliverablesDir);
    const markdownFiles = fileNames
      .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
      .sort();

    const rows: string[] = [];
    for (const fileName of markdownFiles) {
      const fullPath = path.join(deliverablesDir, fileName);
      const fileStats = await stat(fullPath);
      const fileContent = await readFile(fullPath, "utf8");
      const runType = this.extractMetadata(fileContent, "Type");
      const reviewStatus = this.extractMetadata(fileContent, "Review");
      const relativePath = `wiki/deliverables/${fileName}`;
      rows.push(
        `| [${fileName}](./${fileName}) | ${relativePath} | ${runType || "_unknown_"} | ${reviewStatus || "_unknown_"} | ${fileStats.mtime.toISOString()} |`,
      );
    }

    const content = [
      "# Deliverables Index",
      "",
      "| File | Path | Type | Review | Updated |",
      "| --- | --- | --- | --- | --- |",
      ...(rows.length > 0 ? rows : ["| _none_ | _none_ | _none_ | _none_ | _none_ |"]),
      "",
    ].join("\n");

    const indexPath = path.join(deliverablesDir, "index.md");
    await writeFile(indexPath, content, "utf8");
  }

  private formatEntry(input: AppendWikiLogInput): string {
    const lines = [`## [${new Date().toISOString()}] ${input.eventType} | ${input.title}`];

    if (input.runId) {
      lines.push(`- Run ID: ${input.runId}`);
    }
    if (input.taskId) {
      lines.push(`- Task ID: ${input.taskId}`);
    }
    if (input.agentId) {
      lines.push(`- Agent ID: ${input.agentId}`);
    }
    if (input.summary) {
      lines.push(`- Summary: ${input.summary}`);
    }
    if (input.details) {
      for (const [key, value] of Object.entries(input.details)) {
        if (value !== undefined && value !== null) {
          lines.push(`- ${key}: ${String(value)}`);
        }
      }
    }

    return `${lines.join("\n")}\n`;
  }

  private extractMetadata(content: string, key: string): string | null {
    const matcher = new RegExp(`^- ${key}:\\s*(.+)$`, "m");
    const result = content.match(matcher);
    return result?.[1]?.trim() || null;
  }
}
