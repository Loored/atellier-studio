import { mkdir, readFile, writeFile, appendFile, readdir, stat, rm } from "node:fs/promises";
import path from "node:path";
import {
  type AppendWikiLogInput,
  type AppendWikiLogResponse,
  type WikiIngestInput,
  type WikiIngestResponse,
  type WikiLintIssue,
  type WikiLintResponse,
  type WikiPageResponse,
  type WikiQueryInput,
  type WikiQueryMatch,
  type WikiQueryResponse,
} from "@atellier/shared";

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

  async ingest(input: WikiIngestInput): Promise<WikiIngestResponse> {
    await this.ensureWiki();
    const title = input.title.trim();
    const content = input.content.trim();
    if (!title) {
      throw new Error("Ingest title is required.");
    }
    if (!content) {
      throw new Error("Ingest content is required.");
    }

    const timestamp = new Date().toISOString();
    const datePrefix = timestamp.slice(0, 10);
    const slug = this.slugify(title);
    const sourceType = input.sourceType ?? "other";
    const rawPath = `raw/ingest/${datePrefix}-${slug}.md`;
    const rawBody = [
      `# ${title}`,
      "",
      `- Captured at: ${timestamp}`,
      `- Source type: ${sourceType}`,
      ...(input.sourcePathHint ? [`- Source hint: ${input.sourcePathHint}`] : []),
      "",
      "## Content",
      "",
      content,
      "",
    ].join("\n");
    await this.writePage(rawPath, rawBody);

    const summaryPath = `wiki/sources/${datePrefix}-${slug}.md`;
    const summaryBody = [
      `# ${title}`,
      "",
      "## Source",
      "",
      `- Raw path: ${rawPath}`,
      `- Source type: ${sourceType}`,
      ...(input.sourcePathHint ? [`- Source hint: ${input.sourcePathHint}`] : []),
      "",
      "## Summary",
      "",
      this.summarizeContent(content),
      "",
    ].join("\n");
    await this.writePage(summaryPath, summaryBody);

    await this.appendLog({
      eventType: "ingest",
      title,
      summary: `Ingested source into ${summaryPath}`,
      details: {
        rawPath,
        summaryPagePath: summaryPath,
      },
    });

    const proposedTasks = await this.appendTaskProposalIfNeeded(title, content, summaryPath);

    return {
      rawPath,
      summaryPagePath: summaryPath,
      logPath: "wiki/log.md",
      proposedTasks,
    };
  }

  async query(input: WikiQueryInput): Promise<WikiQueryResponse> {
    await this.ensureWiki();
    const query = input.query.trim();
    if (!query) {
      throw new Error("Query is required.");
    }
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const sourceType = input.sourceType;
    const files = await this.listMarkdownFiles(path.join(this.atelierRootResolved, "wiki"));
    const matches: WikiQueryMatch[] = [];
    const queryLower = query.toLowerCase();

    for (const filePath of files) {
      if (matches.length >= limit) {
        break;
      }
      const content = await readFile(filePath, "utf8");
      if (sourceType && !content.includes(`- Source type: ${sourceType}`)) {
        continue;
      }
      const index = content.toLowerCase().indexOf(queryLower);
      if (index < 0) {
        continue;
      }
      const snippetStart = Math.max(0, index - 60);
      const snippetEnd = Math.min(content.length, index + query.length + 60);
      const snippet = content.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim();
      matches.push({
        path: this.toRelativeAtelierPath(filePath),
        snippet,
      });
    }

    await this.appendLog({
      eventType: "query",
      title: `Wiki query: ${query}`,
      summary: `Returned ${matches.length} matches`,
      details: {
        limit,
        ...(sourceType ? { sourceType } : {}),
      },
    });

    return {
      query,
      matches,
    };
  }

  async lint(): Promise<WikiLintResponse> {
    await this.ensureWiki();
    const issues: WikiLintIssue[] = [];
    const indexContent = await readFile(this.indexPath, "utf8");
    const linkedPaths = Array.from(indexContent.matchAll(/\]\(\.\/([^)]+)\)/g)).map((m) => m[1]);

    for (const linkedPath of linkedPaths) {
      const resolved = path.resolve(this.wikiRoot, linkedPath);
      try {
        await stat(resolved);
      } catch {
        issues.push({
          code: "missing_page",
          path: `wiki/${linkedPath.replace(/\\/g, "/")}`,
          message: "Linked page from wiki index does not exist.",
        });
      }
    }

    const checkedAt = new Date().toISOString();
    await this.appendLog({
      eventType: "wiki_lint",
      title: "Wiki lint run",
      summary: issues.length === 0 ? "No issues found." : `Found ${issues.length} issue(s).`,
      details: {
        issues: issues.length,
      },
    });

    return {
      ok: issues.length === 0,
      issues,
      checkedAt,
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

  private summarizeContent(content: string): string {
    const line = content.replace(/\s+/g, " ").trim();
    if (line.length <= 220) {
      return line;
    }
    return `${line.slice(0, 217)}...`;
  }

  private slugify(value: string): string {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "untitled";
  }

  private async listMarkdownFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...await this.listMarkdownFiles(fullPath));
        continue;
      }
      if (entry.isFile() && entry.name.endsWith(".md")) {
        files.push(fullPath);
      }
    }
    return files;
  }

  private toRelativeAtelierPath(absolutePath: string): string {
    return path.relative(this.atelierRootResolved, absolutePath).replace(/\\/g, "/");
  }

  private shouldProposeTask(title: string, content: string): boolean {
    const text = `${title}\n${content}`.toLowerCase();
    const signals = [
      "todo",
      "next step",
      "next steps",
      "action item",
      "pending",
      "blocker",
      "need to",
      "fix",
      "implement",
    ];
    return signals.some((signal) => text.includes(signal));
  }

  private async appendTaskProposalIfNeeded(title: string, content: string, summaryPath: string): Promise<string[]> {
    if (!this.shouldProposeTask(title, content)) {
      return [];
    }

    const inboxPath = path.join(this.atelierRootResolved, "tasks", "inbox.md");
    await mkdir(path.dirname(inboxPath), { recursive: true });
    const proposalLine = `- [ ] ${title} (source: ${summaryPath})`;
    let inboxContent = "";
    try {
      inboxContent = await readFile(inboxPath, "utf8");
    } catch {
      inboxContent = "";
    }
    if (inboxContent.includes(proposalLine)) {
      await this.appendLog({
        eventType: "decision",
        title: "Task proposal skipped as duplicate",
        summary: proposalLine,
        details: {
          inboxPath: "tasks/inbox.md",
        },
      });
      return [];
    }
    await appendFile(inboxPath, `\n${proposalLine}\n`, "utf8");

    await this.appendLog({
      eventType: "decision",
      title: "Task proposal added from ingest",
      summary: proposalLine,
      details: {
        inboxPath: "tasks/inbox.md",
      },
    });
    return [proposalLine];
  }
}
