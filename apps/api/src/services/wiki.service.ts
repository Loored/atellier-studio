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
  type WikiContradiction,
  type WikiQueryMatch,
  type WikiQueryResponse,
  type WikiRelatedPage,
  type WikiDreamDecisionRecord,
  type WikiDreamDecisionRecordInput,
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
- dreams
`;

const DEFAULT_LOG = `# Atellier Studio Wiki Log

## [2026-05-04T00:00:00.000Z] initialization | Milestone 0 wiki log created

- Summary: Initial durable wiki log for Atellier Studio operational memory.
`;

const GRAPH_ANNOTATIONS_FILE = path.join("_runtime", "graph-annotations.json");

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
      ["clients", "projects", "entities", "workflows", "decisions", "synthesis", "sources", "deliverables", "dreams"].map((segment) =>
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
    const normalized = this.normalizeWritableWikiMarkdownPath(relativePath);
    await this.writeAtelierPage(normalized, content);
    if (this.isDeliverableMarkdownPath(normalized)) {
      await this.refreshDeliverablesIndex();
    } else {
      await this.upsertWikiIndexEntry(normalized, content);
    }

    return {
      path: normalized,
      content,
      ready: true,
    };
  }

  private async writeAtelierPage(relativePath: string, content: string): Promise<void> {
    const { resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    await writeFile(resolved, content, "utf8");
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

  async recordDreamDecision(input: WikiDreamDecisionRecordInput): Promise<WikiDreamDecisionRecord> {
    await this.ensureWiki();
    const reportPath = this.normalizeWritableWikiMarkdownPath(input.reportPath);
    if (!reportPath.startsWith("wiki/dreams/")) {
      throw new Error("Dream decision report path must be under wiki/dreams/.");
    }
    const proposal = input.proposal.trim();
    if (!proposal) {
      throw new Error("Dream proposal is required.");
    }
    const createdAt = new Date().toISOString();
    const id = this.slugify(`${createdAt}-${proposal}`).slice(0, 64);
    const datePrefix = createdAt.slice(0, 10);
    const decisionPath = `wiki/decisions/${datePrefix}-dream-decision-${id}.md`;
    const content = [
      "# Dream Proposal Decision",
      "",
      `- Created at: ${createdAt}`,
      `- Report path: ${reportPath}`,
      `- Decision: ${input.decision}`,
      ...(input.taskId ? [`- Task ID: ${input.taskId}`] : []),
      "",
      "## Proposal",
      "",
      proposal,
      "",
      "## Rationale",
      "",
      input.rationale?.trim() || "_No rationale provided._",
      "",
    ].join("\n");

    await this.writeAtelierPage(decisionPath, content);
    await this.upsertWikiIndexEntry(decisionPath, content);
    await this.appendLog({
      eventType: "decision",
      title: `Dream action ${input.decision}`,
      summary: `Dream proposal decision recorded for ${reportPath}`,
      taskId: input.taskId,
      details: {
        reportPath,
        proposal,
        decision: input.decision,
      },
    });

    return {
      id,
      path: decisionPath,
      reportPath,
      proposal,
      decision: input.decision,
      rationale: input.rationale,
      taskId: input.taskId,
      createdAt,
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
    await this.writeAtelierPage(rawPath, rawBody);

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
    await this.writeAtelierPage(summaryPath, summaryBody);
    await this.upsertSourceIndexEntry(summaryPath, sourceType, datePrefix);

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
    const indexEntries = await this.readWikiIndexEntries();
    const rankedMatches: Array<WikiQueryMatch & { score: number }> = [];
    const relatedPages: WikiRelatedPage[] = [];
    const contradictions: WikiContradiction[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((term) => term.length > 2);
    const relatedSeen = new Set<string>();
    const contradictionMap = new Map<string, string[]>();

    for (const filePath of files) {
      const content = await readFile(filePath, "utf8");
      if (sourceType && !content.includes(`- Source type: ${sourceType}`)) {
        continue;
      }
      const contentLower = content.toLowerCase();
      const firstMatchIndex = contentLower.indexOf(queryLower);
      if (firstMatchIndex < 0) {
        continue;
      }
      const snippetStart = Math.max(0, firstMatchIndex - 60);
      const snippetEnd = Math.min(content.length, firstMatchIndex + query.length + 60);
      const snippet = content.slice(snippetStart, snippetEnd).replace(/\s+/g, " ").trim();
      const titleLine = content.split("\n", 1)[0]?.toLowerCase() ?? "";
      const occurrenceCount = this.countOccurrences(contentLower, queryLower);
      const titleBonus = titleLine.includes(queryLower) ? 3 : 0;
      rankedMatches.push({
        path: this.toRelativeAtelierPath(filePath),
        snippet,
        score: occurrenceCount + titleBonus,
      });
    }

    for (const entry of indexEntries) {
      const entryText = `${entry.path} ${entry.summary} ${entry.category}`.toLowerCase();
      const relevance = queryTerms.filter((term) => entryText.includes(term)).length;
      if (relevance === 0) {
        continue;
      }

      if (!relatedSeen.has(entry.path)) {
        relatedSeen.add(entry.path);
        relatedPages.push({
          path: entry.path,
          summary: entry.summary,
          reason: entry.category === "sources"
            ? "Source summary shares query terms."
            : "Index entry shares query terms.",
        });
      }

      const key = entry.summary.toLowerCase().replace(/\s+/g, " ").trim();
      const paths = contradictionMap.get(key) ?? [];
      paths.push(entry.path);
      contradictionMap.set(key, paths);
    }

    for (const [summary, paths] of contradictionMap.entries()) {
      const uniquePaths = Array.from(new Set(paths));
      if (uniquePaths.length < 2) {
        continue;
      }
      contradictions.push({
        primaryPath: uniquePaths[0]!,
        conflictingPath: uniquePaths[1]!,
        reason: `Multiple wiki index entries share the summary "${summary}" and should be reviewed together.`,
      });
    }

    const matches = rankedMatches
      .sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return a.path.localeCompare(b.path);
      })
      .slice(0, limit)
      .map(({ path, snippet }) => ({ path, snippet }));

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
      relatedPages: relatedPages.slice(0, 5),
      contradictions: contradictions.slice(0, 3),
    };
  }

  async lint(options: { recordLog?: boolean } = {}): Promise<WikiLintResponse> {
    await this.ensureWiki();
    const issues: WikiLintIssue[] = [];
    const issueKeys = new Set<string>();
    const addIssue = (issue: WikiLintIssue) => {
      const key = `${issue.code}|${issue.path}|${issue.message}`;
      if (issueKeys.has(key)) return;
      issueKeys.add(key);
      issues.push(issue);
    };
    const indexContent = await readFile(this.indexPath, "utf8");
    const linkedPaths = Array.from(indexContent.matchAll(/\]\(\.\/([^)]+)\)/g)).map((m) => m[1]);
    const duplicateLinkedPaths = this.findDuplicates(linkedPaths);

    for (const linkedPath of linkedPaths) {
      const resolved = path.resolve(this.wikiRoot, linkedPath);
      try {
        await stat(resolved);
      } catch {
        addIssue({
          code: "missing_page",
          path: `wiki/${linkedPath.replace(/\\/g, "/")}`,
          message: "Linked page from wiki index does not exist.",
          suggestion: `Recreate or remove the missing link from wiki/index.md: ${linkedPath}`,
        });
      }
    }

    for (const duplicatePath of duplicateLinkedPaths) {
      addIssue({
        code: "stale_index_entry",
        path: `wiki/${duplicatePath.replace(/\\/g, "/")}`,
        message: "Wiki index contains duplicate entries for the same path.",
        suggestion: "Deduplicate the index rows so each page appears once.",
      });
    }

    const sourceFiles = await this.listMarkdownFiles(path.join(this.wikiRoot, "sources"));
    for (const sourceFile of sourceFiles) {
      const sourceContent = await readFile(sourceFile, "utf8");
      const sourceRelativePath = this.toRelativeAtelierPath(sourceFile);
      const rawPath = this.extractMetadata(sourceContent, "Raw path");

      if (!rawPath) {
        addIssue({
          code: "stale_index_entry",
          path: sourceRelativePath,
          message: "Source summary is missing Raw path metadata.",
          suggestion: "Restore the Raw path metadata so lint can trace the original source.",
        });
        continue;
      }

      try {
        const { resolved } = this.resolveAtelierPath(rawPath);
        await stat(resolved);
      } catch {
        addIssue({
          code: "broken_link",
          path: sourceRelativePath,
          message: `Raw source reference is missing: ${rawPath}`,
          suggestion: "Fix the Raw path reference or restore the missing raw source.",
        });
      }
    }

    const annotationSignals = await this.readAnnotationSignals();
    for (const signal of annotationSignals) {
      addIssue({
        code: "curation_signal",
        path: signal.path,
        message: signal.message,
        suggestion: signal.suggestion,
      });
    }

    const decisionSignals = await this.readDreamDecisionSignals();
    for (const signal of decisionSignals) {
      addIssue({
        code: "curation_signal",
        path: signal.path,
        message: signal.message,
        suggestion: signal.suggestion,
      });
    }

    const checkedAt = new Date().toISOString();
    if (options.recordLog !== false) {
      await this.appendLog({
        eventType: "wiki_lint",
        title: "Wiki lint run",
        summary: issues.length === 0 ? "No issues found." : `Found ${issues.length} issue(s).`,
        details: {
          issues: issues.length,
        },
      });
    }

    return {
      ok: issues.length === 0,
      issues,
      checkedAt,
    };
  }

  async listWikiMarkdownPaths(): Promise<string[]> {
    await this.ensureWiki();
    const files = await this.listMarkdownFiles(this.wikiRoot);
    return files.map((filePath) => this.toRelativeAtelierPath(filePath)).sort();
  }

  async listRawMarkdownPaths(): Promise<string[]> {
    return this.listAtelierSubdirMarkdownPaths("raw");
  }

  async listRawAssetPaths(): Promise<string[]> {
    return this.listAtelierSubdirAssetPaths("raw");
  }

  async listRuntimeMarkdownPaths(): Promise<string[]> {
    const [runs, tasks] = await Promise.all([
      this.listAtelierSubdirMarkdownPaths("runs"),
      this.listAtelierSubdirMarkdownPaths("tasks"),
    ]);
    return [...runs, ...tasks].sort();
  }

  private async listAtelierSubdirMarkdownPaths(subdir: string): Promise<string[]> {
    const root = path.join(this.atelierRootResolved, subdir);
    try {
      const files = await this.listMarkdownFiles(root);
      return files.map((filePath) => this.toRelativeAtelierPath(filePath)).sort();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  private async listAtelierSubdirAssetPaths(subdir: string): Promise<string[]> {
    const root = path.join(this.atelierRootResolved, subdir);
    try {
      const files = await this.listAssetFiles(root);
      return files.map((filePath) => this.toRelativeAtelierPath(filePath)).sort();
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code === "ENOENT") return [];
      throw error;
    }
  }

  private async listAssetFiles(root: string): Promise<string[]> {
    const entries = await readdir(root, { withFileTypes: true });
    const files: string[] = [];
    for (const entry of entries) {
      const fullPath = path.join(root, entry.name);
      if (entry.isDirectory()) {
        files.push(...(await this.listAssetFiles(fullPath)));
        continue;
      }
      if (entry.isFile() && /\.(md|pdf|txt|json|csv|jsonl|yaml|yml)$/i.test(entry.name)) {
        files.push(fullPath);
      }
    }
    return files;
  }

  async readPagesByPaths(
    relativePaths: string[],
  ): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    for (const relativePath of relativePaths) {
      try {
        const { normalized, resolved } = this.resolveAtelierPath(relativePath);
        const content = await readFile(resolved, "utf8");
        results.push({ path: normalized, content });
      } catch {
        // file disappeared or could not be read — skip silently
      }
    }
    return results;
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

  private async readWikiIndexEntries(): Promise<Array<{ path: string; summary: string; category: string }>> {
    const indexContent = await readFile(this.indexPath, "utf8");
    const lines = indexContent.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim() === "| Path | Summary | Category | Last updated | Source count |");
    if (headerIndex < 0) {
      return [];
    }

    const entries: Array<{ path: string; summary: string; category: string }> = [];
    for (let index = headerIndex + 2; index < lines.length; index += 1) {
      const line = lines[index]?.trim();
      if (!line) {
        break;
      }
      if (!line.startsWith("| [")) {
        continue;
      }

      const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
      if (cells.length < 5) {
        continue;
      }

      const pathMatch = cells[0]?.match(/\]\(([^)]+)\)/);
      const pathValue = pathMatch?.[1];
      if (!pathValue) {
        continue;
      }

      entries.push({
        path: pathValue.replace(/^\.\//, ""),
        summary: cells[1] ?? "",
        category: cells[2] ?? "",
      });
    }

    return entries;
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

  private normalizeWritableWikiMarkdownPath(relativePath: string): string {
    const normalized = relativePath.trim().replace(/\\/g, "/");
    const canonical = normalized.startsWith("atelier/") ? normalized.slice("atelier/".length) : normalized;
    if (!canonical.startsWith("wiki/")) {
      throw new Error("Writable wiki path must start with wiki/.");
    }
    if (!canonical.endsWith(".md")) {
      throw new Error("Writable wiki path must be a markdown file.");
    }
    if (canonical === "wiki/index.md" || canonical === "wiki/log.md" || canonical === "wiki/deliverables/index.md") {
      throw new Error("Writable wiki path is reserved.");
    }
    const segment = canonical.split("/")[1] ?? "";
    const allowedSegments = new Set([
      "clients",
      "projects",
      "entities",
      "workflows",
      "decisions",
      "synthesis",
      "sources",
      "deliverables",
      "notes",
      "dreams",
    ]);
    if (!allowedSegments.has(segment)) {
      throw new Error("Writable wiki path must target an allowed wiki category.");
    }
    return canonical;
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

  private async upsertWikiIndexEntry(wikiPath: string, content: string): Promise<void> {
    if (!wikiPath.startsWith("wiki/") || wikiPath === "wiki/index.md") {
      return;
    }

    const indexContent = await readFile(this.indexPath, "utf8");
    const relativeWikiPath = wikiPath.replace(/^wiki\//, "");
    const linkPath = `./${relativeWikiPath}`;
    const category = relativeWikiPath.split("/")[0] ?? "notes";
    const date = new Date().toISOString().slice(0, 10);
    const summary = this.sanitizeTableCell(this.summarizeContent(content.replace(/^# .*\n?/, "")));
    const row = `| [${relativeWikiPath}](${linkPath}) | ${summary || "Wiki page updated through safe write path."} | ${category} | ${date} | 0 |`;

    const lines = indexContent.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim() === "| Path | Summary | Category | Last updated | Source count |");
    if (headerIndex < 0 || headerIndex + 1 >= lines.length) {
      return;
    }

    const firstRowIndex = headerIndex + 2;
    let tableEndIndex = lines.findIndex((line, index) => index >= firstRowIndex && line.trim() === "");
    if (tableEndIndex < 0) {
      tableEndIndex = lines.length;
    }

    const rowMatcher = new RegExp(`\\]\\(${this.escapeRegExp(linkPath)}\\)`);
    const tableRows = lines.slice(firstRowIndex, tableEndIndex);
    const existingRowIndex = tableRows.findIndex((tableRow) => rowMatcher.test(tableRow));
    if (existingRowIndex >= 0) {
      tableRows[existingRowIndex] = row;
    } else {
      tableRows.push(row);
    }

    const updated = [
      ...lines.slice(0, firstRowIndex),
      ...tableRows,
      ...lines.slice(tableEndIndex),
    ].join("\n");

    await writeFile(this.indexPath, updated, "utf8");
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

  private sanitizeTableCell(value: string): string {
    return value.replace(/\|/g, "\\|").replace(/\n+/g, " ").trim();
  }

  private slugify(value: string): string {
    const base = value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return base || "untitled";
  }

  private async upsertSourceIndexEntry(summaryPath: string, sourceType: string, date: string): Promise<void> {
    const indexContent = await readFile(this.indexPath, "utf8");
    const linkPath = `./${summaryPath.replace(/^wiki\//, "")}`;
    const summaryLabel = summaryPath.replace(/^wiki\//, "");
    const row = `| [${summaryLabel}](${linkPath}) | Source summary generated from deterministic ingest. | sources | ${date} | 1 |`;

    const lines = indexContent.split("\n");
    const headerIndex = lines.findIndex((line) => line.trim() === "| Path | Summary | Category | Last updated | Source count |");
    if (headerIndex < 0 || headerIndex + 1 >= lines.length) {
      return;
    }

    const firstRowIndex = headerIndex + 2;
    let tableEndIndex = lines.findIndex((line, index) => index >= firstRowIndex && line.trim() === "");
    if (tableEndIndex < 0) {
      tableEndIndex = lines.length;
    }

    const sourceRowMatcher = new RegExp(`\\]\\(${this.escapeRegExp(linkPath)}\\)`);
    const tableRows = lines.slice(firstRowIndex, tableEndIndex);
    const existingRowIndex = tableRows.findIndex((tableRow) => sourceRowMatcher.test(tableRow));
    if (existingRowIndex >= 0) {
      tableRows[existingRowIndex] = row.replace("| sources |", `| ${sourceType} |`);
    } else {
      tableRows.push(row.replace("| sources |", `| ${sourceType} |`));
    }

    const updated = [
      ...lines.slice(0, firstRowIndex),
      ...tableRows,
      ...lines.slice(tableEndIndex),
    ].join("\n");

    await writeFile(this.indexPath, updated, "utf8");
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  private countOccurrences(content: string, query: string): number {
    if (!query) return 0;
    let count = 0;
    let fromIndex = 0;
    while (fromIndex < content.length) {
      const index = content.indexOf(query, fromIndex);
      if (index < 0) break;
      count += 1;
      fromIndex = index + query.length;
    }
    return count;
  }

  private findDuplicates(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const value of values) {
      if (seen.has(value)) {
        duplicates.add(value);
      } else {
        seen.add(value);
      }
    }
    return Array.from(duplicates).sort((a, b) => a.localeCompare(b));
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

  private async readAnnotationSignals(): Promise<Array<{ path: string; message: string; suggestion: string }>> {
    const annotationsPath = path.join(this.atelierRootResolved, GRAPH_ANNOTATIONS_FILE);
    type AnnotationRecord = { nodeId?: unknown; note?: unknown; tags?: unknown };
    let parsed: Record<string, AnnotationRecord> | null = null;
    try {
      parsed = JSON.parse(await readFile(annotationsPath, "utf8")) as Record<string, AnnotationRecord>;
    } catch {
      return [];
    }
    if (!parsed || typeof parsed !== "object") return [];

    const signals: Array<{ path: string; message: string; suggestion: string }> = [];
    for (const value of Object.values(parsed)) {
      const nodeId = typeof value?.nodeId === "string" ? value.nodeId : null;
      if (!nodeId || !nodeId.startsWith("wiki-page:")) continue;
      const path = nodeId.slice("wiki-page:".length);
      const note = typeof value?.note === "string" ? value.note.trim() : "";
      const tagsRaw = Array.isArray(value?.tags) ? value.tags : [];
      const tags = tagsRaw
        .filter((tag): tag is string => typeof tag === "string")
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => tag.length > 0);
      const hasSignalTag = tags.some((tag) =>
        tag.includes("stale") || tag.includes("orphan") || tag.includes("contradict") || tag.includes("needs-review"),
      );
      if (!hasSignalTag) continue;
      const label = tags.join(", ");
      signals.push({
        path,
        message: `Annotation marks this page for curation (${label}).${note ? ` Note: ${note.slice(0, 120)}` : ""}`,
        suggestion: "Review this page in Knowledge Graph curation and resolve or confirm the signal.",
      });
    }

    return signals;
  }

  private async readDreamDecisionSignals(): Promise<Array<{ path: string; message: string; suggestion: string }>> {
    const decisionsRoot = path.join(this.wikiRoot, "decisions");
    let files: string[] = [];
    try {
      files = await this.listMarkdownFiles(decisionsRoot);
    } catch {
      return [];
    }

    const signals: Array<{ path: string; message: string; suggestion: string }> = [];
    for (const filePath of files) {
      const content = await readFile(filePath, "utf8");
      const decision = this.extractMetadata(content, "Decision")?.toLowerCase();
      if (decision !== "deferred" && decision !== "rejected") continue;
      const reportPath = this.extractMetadata(content, "Report path");
      if (!reportPath) continue;
      const proposal = this.extractSection(content, "Proposal");
      signals.push({
        path: reportPath,
        message: `Dream decision is ${decision} for a proposal on this report.${proposal ? ` Proposal: ${proposal.slice(0, 120)}` : ""}`,
        suggestion: "Revisit the deferred/rejected proposal and either resolve it or record the next decision.",
      });
    }
    return signals;
  }

  private extractSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`## ${sectionName}\\n\\n([\\s\\S]*?)(?:\\n## |$)`);
    const section = content.match(regex)?.[1]?.trim();
    return section && section.length > 0 ? section : null;
  }
}
