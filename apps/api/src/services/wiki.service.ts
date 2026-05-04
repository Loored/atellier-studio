import { mkdir, readFile, writeFile, appendFile } from "node:fs/promises";
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

  constructor(private readonly atelierRoot: string) {
    this.wikiRoot = path.join(atelierRoot, "wiki");
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
      ["clients", "projects", "entities", "workflows", "decisions", "synthesis"].map((segment) =>
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
}
