import { mkdir, readFile, writeFile, appendFile, readdir, stat, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import {
  AGENT_ROLES,
  REVIEW_LEARNING_RESOLUTION_OUTCOMES,
  REVIEW_LEARNING_SIGNALS,
  type AgentRole,
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
  type WikiReflectionInput,
  type WikiReflectionResponse,
  type WikiReflectionDecisionInput,
  type WikiReflectionDecisionRecord,
  type WikiReflectionPromotionInput,
  type WikiReflectionPromotionRecord,
  type WikiReflectionReviewResponse,
  type WikiRelatedPage,
  type ReviewLearningRecord,
  type ReviewLearningSignalResolution,
  type WikiDreamDecisionRecord,
  type WikiDreamDecisionRecordInput,
} from "@atellier/shared";
import { classifyMemoryTrust } from "./memory-trust.service";

type AppendRoleLearningInput = Omit<ReviewLearningRecord, "roleMemoryPath" | "logPath" | "resolution">;

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
- role-memory
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
      ["clients", "projects", "entities", "workflows", "decisions", "synthesis", "sources", "deliverables", "dreams", "role-memory"].map((segment) =>
        mkdir(path.join(this.wikiRoot, segment), { recursive: true }),
      ),
    );
    await this.ensureFile(this.indexPath, DEFAULT_INDEX);
    await this.ensureFile(this.logPath, DEFAULT_LOG);
  }

  async readIndex(): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const content = await readFile(this.indexPath, "utf8");
    return {
      path: this.indexPath,
      content,
      ready: true,
      memory: classifyMemoryTrust("wiki/index.md", content),
    };
  }

  async readLog(): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const content = await readFile(this.logPath, "utf8");
    return {
      path: this.logPath,
      content,
      ready: true,
      memory: classifyMemoryTrust("wiki/log.md", content),
    };
  }

  async readPage(relativePath: string): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const { normalized, resolved } = this.resolveAtelierPath(relativePath);
    const content = await readFile(resolved, "utf8");

    return {
      path: normalized,
      content,
      ready: true,
      memory: classifyMemoryTrust(normalized, content),
    };
  }

  async writePage(
    relativePath: string,
    content: string,
    options: { genericWrite?: boolean } = {},
  ): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const normalized = this.normalizeWritableWikiMarkdownPath(relativePath);
    if (options.genericWrite) {
      const segment = normalized.split("/")[1] ?? "";
      if (new Set(["decisions", "role-memory", "synthesis", "sources", "deliverables"]).has(segment)) {
        throw new Error("Generic writes cannot target a trusted or workflow-owned wiki category.");
      }
    }
    const persistedContent = options.genericWrite ? this.markGenericWrite(content) : content;
    await this.writeAtelierPage(normalized, persistedContent);
    if (this.isDeliverableMarkdownPath(normalized)) {
      await this.refreshDeliverablesIndex();
    } else {
      await this.upsertWikiIndexEntry(normalized, persistedContent);
    }

    return {
      path: normalized,
      content: persistedContent,
      ready: true,
      memory: classifyMemoryTrust(normalized, persistedContent),
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

  async writeContextReceiptArtifact(runId: string, content: string): Promise<string> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(runId)) {
      throw new Error("Context receipt run ID is invalid.");
    }
    const relativePath = `runs/context/${runId}-memory-context.md`;
    const { resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    try {
      await writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(resolved, "utf8");
      if (existing !== content) {
        throw new Error(`Context receipt already exists with different content: ${relativePath}`);
      }
    }
    return relativePath;
  }

  async writeContextEvaluationArtifact(runId: string, content: string): Promise<string> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(runId)) {
      throw new Error("Context evaluation run ID is invalid.");
    }
    const relativePath = `runs/context/${runId}-memory-evaluation.md`;
    const { resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    try {
      await writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(resolved, "utf8");
      if (existing !== content) {
        throw new Error(`Context evaluation already exists with different content: ${relativePath}`);
      }
    }
    return relativePath;
  }

  async writeAutomatedContextAssessmentArtifact(runId: string, content: string): Promise<string> {
    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(runId)) {
      throw new Error("Automated context assessment run ID is invalid.");
    }
    const relativePath = `runs/context/${runId}-memory-auto-assessment.md`;
    const { resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    try {
      await writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(resolved, "utf8");
      if (existing !== content) {
        throw new Error(`Automated context assessment already exists with different content: ${relativePath}`);
      }
    }
    return relativePath;
  }

  async appendRoleLearning(input: AppendRoleLearningInput): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const roleMemoryPath = `wiki/role-memory/${input.role}.md`;
    const { resolved } = this.resolveAtelierPath(roleMemoryPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    try {
      await writeFile(
        resolved,
        [
          `# Role Memory - ${input.role}`,
          "",
          "Approved review learnings curated by the operator.",
          "",
          "## Memory Trust",
          "",
          "- Layer: learning",
          "- State: verified",
          "- Authority: trusted",
          "",
        ].join("\n"),
        { encoding: "utf8", flag: "wx" },
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        throw error;
      }
    }

    const machineRecord = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
    const entry = [
      `## [${input.capturedAt}] Run ${input.runId}`,
      "",
      `- Run ID: ${input.runId}`,
      `- Task ID: ${input.taskId ?? "none"}`,
      `- Memory path: ${input.memoryPath}`,
      `- Signal: ${input.signal ?? "none"}`,
      `- Signal path: ${input.signalPath ?? "none"}`,
      "",
      "### Learning",
      "",
      input.lesson,
      "",
      `<!-- atellier-review-learning ${machineRecord} -->`,
      "",
    ].join("\n");
    await appendFile(resolved, entry, "utf8");
    const content = await readFile(resolved, "utf8");
    await this.upsertWikiIndexEntry(roleMemoryPath, content);

    return {
      path: roleMemoryPath,
      content,
      ready: true,
      memory: classifyMemoryTrust(roleMemoryPath, content),
    };
  }

  async appendRoleLearningResolution(
    role: AgentRole,
    input: ReviewLearningSignalResolution,
  ): Promise<WikiPageResponse> {
    await this.ensureWiki();
    const roleMemoryPath = `wiki/role-memory/${role}.md`;
    const { resolved } = this.resolveAtelierPath(roleMemoryPath);
    await readFile(resolved, "utf8");

    const machineRecord = Buffer.from(JSON.stringify(input), "utf8").toString("base64url");
    const entry = [
      `## [${input.resolvedAt}] Signal resolution for run ${input.runId}`,
      "",
      `- Run ID: ${input.runId}`,
      `- Signal: ${input.signal}`,
      `- Signal path: ${input.signalPath}`,
      `- Outcome: ${input.outcome}`,
      "",
      "### Resolution note",
      "",
      input.note,
      "",
      `<!-- atellier-review-learning-resolution ${machineRecord} -->`,
      "",
    ].join("\n");
    await appendFile(resolved, entry, "utf8");
    const content = await readFile(resolved, "utf8");
    await this.upsertWikiIndexEntry(roleMemoryPath, content);

    return {
      path: roleMemoryPath,
      content,
      ready: true,
      memory: classifyMemoryTrust(roleMemoryPath, content),
    };
  }

  async listReviewLearnings(): Promise<ReviewLearningRecord[]> {
    await this.ensureWiki();
    const roleMemoryRoot = path.join(this.wikiRoot, "role-memory");
    let files: string[] = [];
    try {
      files = await this.listMarkdownFiles(roleMemoryRoot);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        return [];
      }
      throw error;
    }

    const learnings: ReviewLearningRecord[] = [];
    for (const filePath of files) {
      const content = await readFile(filePath, "utf8");
      const roleMemoryPath = this.toRelativeAtelierPath(filePath);
      const fileLearnings: ReviewLearningRecord[] = [];
      const resolutions = new Map<string, ReviewLearningSignalResolution>();
      for (const match of content.matchAll(/<!-- atellier-review-learning ([a-zA-Z0-9_-]+) -->/g)) {
        try {
          const parsed = JSON.parse(
            Buffer.from(match[1] ?? "", "base64url").toString("utf8"),
          ) as Partial<AppendRoleLearningInput>;
          if (
            typeof parsed.runId !== "string" ||
            typeof parsed.role !== "string" ||
            !AGENT_ROLES.includes(parsed.role as (typeof AGENT_ROLES)[number]) ||
            typeof parsed.lesson !== "string" ||
            typeof parsed.memoryPath !== "string" ||
            typeof parsed.capturedAt !== "string"
          ) {
            continue;
          }
          const signal = typeof parsed.signal === "string" && REVIEW_LEARNING_SIGNALS.includes(
            parsed.signal as (typeof REVIEW_LEARNING_SIGNALS)[number],
          )
            ? parsed.signal as (typeof REVIEW_LEARNING_SIGNALS)[number]
            : undefined;
          fileLearnings.push({
            runId: parsed.runId,
            taskId: typeof parsed.taskId === "string" ? parsed.taskId : undefined,
            role: parsed.role as (typeof AGENT_ROLES)[number],
            lesson: parsed.lesson,
            memoryPath: parsed.memoryPath,
            roleMemoryPath,
            logPath: "wiki/log.md",
            signal,
            signalPath: signal && typeof parsed.signalPath === "string" ? parsed.signalPath : undefined,
            capturedAt: parsed.capturedAt,
          });
        } catch {
          // Keep malformed manual edits inspectable without breaking the read model.
        }
      }
      for (const match of content.matchAll(/<!-- atellier-review-learning-resolution ([a-zA-Z0-9_-]+) -->/g)) {
        try {
          const parsed = JSON.parse(
            Buffer.from(match[1] ?? "", "base64url").toString("utf8"),
          ) as Partial<ReviewLearningSignalResolution>;
          if (
            typeof parsed.runId !== "string" ||
            typeof parsed.outcome !== "string" ||
            !REVIEW_LEARNING_RESOLUTION_OUTCOMES.includes(
              parsed.outcome as (typeof REVIEW_LEARNING_RESOLUTION_OUTCOMES)[number],
            ) ||
            typeof parsed.note !== "string" ||
            typeof parsed.signal !== "string" ||
            !REVIEW_LEARNING_SIGNALS.includes(parsed.signal as (typeof REVIEW_LEARNING_SIGNALS)[number]) ||
            typeof parsed.signalPath !== "string" ||
            typeof parsed.logPath !== "string" ||
            typeof parsed.resolvedAt !== "string"
          ) {
            continue;
          }
          resolutions.set(parsed.runId, {
            runId: parsed.runId,
            outcome: parsed.outcome as (typeof REVIEW_LEARNING_RESOLUTION_OUTCOMES)[number],
            note: parsed.note,
            signal: parsed.signal as (typeof REVIEW_LEARNING_SIGNALS)[number],
            signalPath: parsed.signalPath,
            logPath: parsed.logPath,
            resolvedAt: parsed.resolvedAt,
          });
        } catch {
          // Keep malformed manual edits inspectable without breaking the read model.
        }
      }
      learnings.push(
        ...fileLearnings.map((learning) => {
          const resolution = resolutions.get(learning.runId);
          const matchingResolution =
            resolution &&
            resolution.signal === learning.signal &&
            resolution.signalPath === learning.signalPath
              ? resolution
              : undefined;
          return {
            ...learning,
            resolution: matchingResolution,
          };
        }),
      );
    }

    return learnings.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
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
      "## Memory Trust",
      "",
      "- Layer: semantic",
      "- State: verified",
      "- Authority: trusted",
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
    const ingestFingerprint = this.hashText(JSON.stringify({ title, content, sourceType, sourcePathHint: input.sourcePathHint?.trim() || null }));
    const rawBasePath = `raw/ingest/${datePrefix}-${slug}.md`;
    let rawPath = await this.selectAppendOnlyIngestPath(rawBasePath, ingestFingerprint);
    const rawBody = [
      `# ${title}`,
      "",
      `- Captured at: ${timestamp}`,
      `- Source type: ${sourceType}`,
      `- Ingest fingerprint: ${ingestFingerprint}`,
      ...(input.sourcePathHint ? [`- Source hint: ${input.sourcePathHint}`] : []),
      "",
      "## Memory Trust",
      "",
      "- Layer: raw",
      "- State: immutable-source",
      "- Authority: evidence-only",
      "",
      "## Content",
      "",
      content,
      "",
    ].join("\n");
    try {
      await this.writeImmutablePage(rawPath, rawBody, ingestFingerprint);
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("different content")) throw error;
      rawPath = `${rawBasePath.slice(0, -3)}-${ingestFingerprint}.md`;
      await this.writeImmutablePage(rawPath, rawBody, ingestFingerprint);
    }

    const rawSuffix = rawPath === rawBasePath ? "" : `-${ingestFingerprint.slice(0, 12)}`;
    const summaryPath = `wiki/sources/${datePrefix}-${slug}${rawSuffix}.md`;
    const summaryBody = [
      `# ${title}`,
      "",
      "## Source",
      "",
      `- Raw path: ${rawPath}`,
      `- Source type: ${sourceType}`,
      `- Generated at: ${timestamp}`,
      ...(input.sourcePathHint ? [`- Source hint: ${input.sourcePathHint}`] : []),
      "",
      "## Memory Trust",
      "",
      "- Layer: semantic",
      "- State: generated",
      "- Authority: context-only",
      "",
      "## Summary",
      "",
      this.summarizeContent(content),
      "",
    ].join("\n");
    await this.writeIdempotentPage(summaryPath, summaryBody);
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
      rawMemory: classifyMemoryTrust(rawPath, rawBody),
      summaryMemory: classifyMemoryTrust(summaryPath, summaryBody),
    };
  }

  async query(
    input: WikiQueryInput,
    options: { appendLog?: boolean } = {},
  ): Promise<WikiQueryResponse> {
    await this.ensureWiki();
    const query = input.query.trim();
    if (!query) {
      throw new Error("Query is required.");
    }
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const sourceType = input.sourceType;
    const retrievalPolicy = input.retrievalPolicy ?? "balanced";
    const files = [
      ...await this.listMarkdownFiles(path.join(this.atelierRootResolved, "wiki")),
      ...await this.listMarkdownFiles(path.join(this.atelierRootResolved, "raw")),
    ];
    const indexEntries = await this.readWikiIndexEntries();
    const rankedMatches: Array<WikiQueryMatch & { score: number }> = [];
    const relatedPages: WikiRelatedPage[] = [];
    const contradictions: WikiContradiction[] = [];
    const queryLower = query.toLowerCase();
    const queryTerms = queryLower.split(/\s+/).filter((term) => term.length > 2);
    const relatedSeen = new Set<string>();
    const contradictionMap = new Map<string, string[]>();
    const memoryByPath = new Map<string, ReturnType<typeof classifyMemoryTrust>>();

    for (const filePath of files) {
      const content = await readFile(filePath, "utf8");
      const relativePath = this.toRelativeAtelierPath(filePath);
      const memory = classifyMemoryTrust(relativePath, content);
      memoryByPath.set(relativePath, memory);
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
      const lexical = occurrenceCount + titleBonus;
      const trustAdjustment = this.retrievalTrustAdjustment(memory.authority, retrievalPolicy);
      if (retrievalPolicy === "trusted-only" && memory.authority !== "trusted") {
        continue;
      }
      rankedMatches.push({
        path: relativePath,
        snippet,
        memory,
        retrieval: {
          lexical,
          trustAdjustment,
          total: lexical + trustAdjustment,
          reason: this.retrievalReason(memory.authority, retrievalPolicy),
        },
        score: lexical + trustAdjustment,
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
          memory: memoryByPath.get(entry.path) ?? classifyMemoryTrust(entry.path, ""),
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
      .map(({ path, snippet, memory, retrieval }) => ({ path, snippet, memory, retrieval }));

    if (options.appendLog !== false) {
      await this.appendLog({
        eventType: "query",
        title: `Wiki query: ${query}`,
        summary: `Returned ${matches.length} matches`,
        details: {
          limit,
          retrievalPolicy,
          ...(sourceType ? { sourceType } : {}),
        },
      });
    }

    return {
      query,
      retrievalPolicy,
      matches,
      relatedPages: relatedPages
        .filter((page) => retrievalPolicy !== "trusted-only" || page.memory.authority === "trusted")
        .sort((a, b) => {
          const trustDifference = this.retrievalTrustAdjustment(b.memory.authority, retrievalPolicy)
            - this.retrievalTrustAdjustment(a.memory.authority, retrievalPolicy);
          return trustDifference || a.path.localeCompare(b.path);
        })
        .slice(0, 5),
      contradictions: contradictions.slice(0, 3),
    };
  }

  private retrievalTrustAdjustment(
    authority: ReturnType<typeof classifyMemoryTrust>["authority"],
    policy: NonNullable<WikiQueryInput["retrievalPolicy"]>,
  ): number {
    if (policy === "trusted-only") return authority === "trusted" ? 4 : 0;
    if (policy === "evidence-first") return authority === "evidence-only" ? 4 : authority === "trusted" ? 3 : 0;
    return authority === "trusted" ? 4 : authority === "evidence-only" ? 2 : 0;
  }

  private retrievalReason(
    authority: ReturnType<typeof classifyMemoryTrust>["authority"],
    policy: NonNullable<WikiQueryInput["retrievalPolicy"]>,
  ): string {
    if (policy === "trusted-only") return "Included because this memory is explicitly trusted.";
    if (policy === "evidence-first") {
      return authority === "evidence-only"
        ? "Prioritized as immutable evidence."
        : authority === "trusted"
          ? "Ranked after immutable evidence as reviewed memory."
          : "Generated context receives no authority boost.";
    }
    return authority === "trusted"
      ? "Reviewed memory receives the highest authority boost."
      : authority === "evidence-only"
        ? "Immutable evidence receives a moderate authority boost."
        : "Generated context receives no authority boost.";
  }

  async reflect(input: WikiReflectionInput = {}): Promise<WikiReflectionResponse> {
    await this.ensureWiki();
    const minOccurrences = Math.min(Math.max(input.minOccurrences ?? 2, 2), 10);
    const limit = Math.min(Math.max(input.limit ?? 5, 1), 20);
    const roots = [
      path.join(this.atelierRootResolved, "runs"),
      path.join(this.atelierRootResolved, "tasks"),
      path.join(this.wikiRoot, "deliverables"),
      path.join(this.wikiRoot, "dreams"),
    ];
    const files = (await Promise.all(roots.map((root) => this.listMarkdownFiles(root))))
      .flat()
      .filter((filePath) => path.basename(filePath) !== "index.md");
    const groups = new Map<string, { pattern: string; paths: Set<string> }>();

    for (const filePath of files) {
      const relativePath = this.toRelativeAtelierPath(filePath);
      const content = await readFile(filePath, "utf8");
      if (classifyMemoryTrust(relativePath, content).layer !== "episodic") continue;
      const patternsInEpisode = new Set<string>();
      for (const line of this.extractReflectionNarrativeLines(content)) {
        const pattern = this.normalizeReflectionPattern(line);
        if (!pattern || patternsInEpisode.has(pattern)) continue;
        patternsInEpisode.add(pattern);
        const group = groups.get(pattern) ?? { pattern: this.cleanReflectionLine(line), paths: new Set<string>() };
        group.paths.add(relativePath);
        groups.set(pattern, group);
      }
    }

    const candidates = [...groups.entries()]
      .filter(([, group]) => group.paths.size >= minOccurrences)
      .sort((a, b) => b[1].paths.size - a[1].paths.size || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([normalized, group]) => {
        const slug = normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "repeated-pattern";
        const candidateId = `reflection-${slug}-${this.hashText(normalized).slice(0, 20)}`;
        const evidencePaths = [...group.paths].sort();
        const suggestedPath = `wiki/reflections/${candidateId}.md`;
        const title = `Reflection candidate: ${group.pattern.slice(0, 80)}`;
        const draftMarkdown = [
          `# ${title}`,
          "",
          "## Memory Trust",
          "",
          "- Layer: semantic",
          "- State: generated",
          "- Authority: context-only",
          "",
          "## Repeated Pattern",
          "",
          group.pattern,
          "",
          "## Evidence",
          "",
          ...evidencePaths.map((evidencePath) => `- Evidence path: ${evidencePath}`),
          "",
          "## Review Decision",
          "",
          "- Status: proposed",
          "- Operator note:",
          "",
        ].join("\n");
        return {
          id: candidateId,
          title,
          pattern: group.pattern,
          occurrenceCount: evidencePaths.length,
          evidencePaths,
          suggestedPath,
          draftMarkdown,
          memory: classifyMemoryTrust(suggestedPath, draftMarkdown),
        };
      });

    return {
      candidates,
      scannedEpisodes: files.length,
      minOccurrences,
      generatedAt: new Date().toISOString(),
    };
  }

  async readReflectionReview(input: WikiReflectionInput = {}): Promise<WikiReflectionReviewResponse> {
    const reflection = await this.reflect(input);
    const items = await Promise.all(reflection.candidates.map(async (candidate) => {
      const decisionPath = `wiki/decisions/${candidate.id}.md`;
      try {
        const decisionPage = await this.readPage(decisionPath);
        const decision = this.extractMetadata(decisionPage.content, "Decision");
        const recordedCandidateId = this.extractMetadata(decisionPage.content, "Candidate ID");
        const recordedPattern = decisionPage.content.match(/## Pattern\s*\n+([\s\S]*?)(?:\n## |$)/i)?.[1]?.trim();
        if (
          (decision !== "accepted" && decision !== "rejected")
          || recordedCandidateId !== candidate.id
          || recordedPattern !== candidate.pattern
          || decisionPage.memory.authority !== "trusted"
        ) {
          return { ...candidate, status: "pending" as const };
        }
        const decisionNote = this.extractMetadata(decisionPage.content, "Operator note") ?? undefined;
        const decisionCreatedAt = this.extractMetadata(decisionPage.content, "Created") ?? undefined;
        const promotedPath = `wiki/notes/${candidate.id}.md`;
        let promoted = false;
        try {
          const promotedPage = await this.readPage(promotedPath);
          const promotedDecisionPath = this.extractMetadata(promotedPage.content, "Decision path");
          const promotedPattern = promotedPage.content.match(/## Accepted Pattern\s*\n+([\s\S]*?)(?:\n## |$)/i)?.[1]?.trim();
          promoted = promotedPage.memory.state === "verified"
            && promotedPage.memory.authority === "trusted"
            && promotedDecisionPath === decisionPath
            && promotedPattern === candidate.pattern
            && candidate.evidencePaths.every((evidencePath) => promotedPage.memory.provenancePaths.includes(evidencePath));
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        return {
          ...candidate,
          status: promoted ? "promoted" as const : decision === "accepted" ? "accepted" as const : "rejected" as const,
          decisionPath,
          decisionNote,
          decisionCreatedAt,
          ...(promoted ? { promotedPath } : {}),
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        return { ...candidate, status: "pending" as const };
      }
    }));
    return { ...reflection, items };
  }

  async recordReflectionDecision(input: WikiReflectionDecisionInput): Promise<WikiReflectionDecisionRecord> {
    const candidateId = input.candidateId.trim();
    const note = input.note.trim().replace(/\s+/g, " ");
    if (!candidateId || !note) throw new Error("Candidate ID and operator note are required.");
    const candidate = (await this.reflect({ minOccurrences: 2, limit: 20 })).candidates.find((item) => item.id === candidateId);
    if (!candidate) throw new Error("Reflection candidate is no longer supported by current episodic evidence.");
    const decisionPath = `wiki/decisions/${candidateId}.md`;
    const createdAt = new Date().toISOString();
    const content = [
      `# Reflection Decision - ${candidate.title}`,
      "",
      `- Candidate ID: ${candidateId}`,
      `- Decision: ${input.decision}`,
      `- Operator note: ${note}`,
      `- Created: ${createdAt}`,
      "",
      "## Pattern",
      "",
      candidate.pattern,
      "",
      "## Evidence",
      "",
      ...candidate.evidencePaths.map((evidencePath) => `- Evidence path: ${evidencePath}`),
      "",
    ].join("\n");
    const created = await this.writeExclusivePage(decisionPath, content);
    if (!created) {
      const existing = await this.readPage(decisionPath);
      const existingDecision = this.extractMetadata(existing.content, "Decision");
      const existingNote = this.extractMetadata(existing.content, "Operator note");
      if (existingDecision !== input.decision || existingNote !== note) {
        throw new Error("Reflection candidate already has a different durable decision.");
      }
      return {
        candidateId,
        decision: input.decision,
        note,
        path: decisionPath,
        createdAt: this.extractMetadata(existing.content, "Created") || "unknown",
      };
    }
    await this.upsertWikiIndexEntry(decisionPath, content);
    await this.appendLog({
      eventType: "decision",
      title: `Reflection candidate ${input.decision}`,
      summary: candidate.pattern,
      details: { candidateId, decisionPath },
    });
    return { candidateId, decision: input.decision, note, path: decisionPath, createdAt };
  }

  async promoteReflection(input: WikiReflectionPromotionInput): Promise<WikiReflectionPromotionRecord> {
    const decisionPath = input.decisionPath.trim();
    if (!decisionPath.startsWith("wiki/decisions/reflection-") || !decisionPath.endsWith(".md")) {
      throw new Error("A valid reflection decision path is required.");
    }
    const decisionPage = await this.readPage(decisionPath);
    if (decisionPage.memory.state !== "verified" || decisionPage.memory.authority !== "trusted") {
      throw new Error("Reflection decision is not a trusted specialized decision record.");
    }
    if (this.extractMetadata(decisionPage.content, "Decision") !== "accepted") {
      throw new Error("Only an accepted reflection decision can be promoted.");
    }
    const candidateId = this.extractMetadata(decisionPage.content, "Candidate ID");
    if (!candidateId || decisionPath !== `wiki/decisions/${candidateId}.md`) {
      throw new Error("Reflection decision provenance is invalid.");
    }
    const pattern = decisionPage.content.match(/## Pattern\s*\n+([\s\S]*?)(?:\n## |$)/i)?.[1]?.trim();
    if (!pattern) throw new Error("Reflection decision is missing its reviewed pattern.");
    const currentCandidate = (await this.reflect({ minOccurrences: 2, limit: 20 })).candidates.find((candidate) => candidate.id === candidateId);
    if (!currentCandidate || currentCandidate.pattern !== pattern) {
      throw new Error("Reflection decision is no longer supported by current episodic evidence.");
    }
    if (!this.extractMetadata(decisionPage.content, "Operator note") || !this.extractMetadata(decisionPage.content, "Created")) {
      throw new Error("Reflection decision metadata is incomplete.");
    }
    const decisionEvidence = classifyMemoryTrust(decisionPath, decisionPage.content).provenancePaths;
    if (!currentCandidate.evidencePaths.every((evidencePath) => decisionEvidence.includes(evidencePath))) {
      throw new Error("Reflection decision evidence provenance is incomplete.");
    }
    const promotedPath = `wiki/notes/${candidateId.replace(/^reflection-/, "reflection-")}.md`;
    const evidencePaths = decisionEvidence;
    const content = [
      `# Promoted Reflection - ${pattern.slice(0, 80)}`,
      "",
      "- Review: approved",
      `- Decision path: ${decisionPath}`,
      ...evidencePaths.map((evidencePath) => `- Evidence path: ${evidencePath}`),
      "",
      "## Accepted Pattern",
      "",
      pattern,
      "",
    ].join("\n");
    const created = await this.writeExclusivePage(promotedPath, content);
    if (!created) {
      const existing = await this.readPage(promotedPath);
      if (existing.content !== content) throw new Error("Promoted reflection already exists with different content.");
      return { decisionPath, promotedPath, memory: existing.memory };
    }
    await this.upsertWikiIndexEntry(promotedPath, content);
    const page = await this.readPage(promotedPath);
    await this.appendLog({
      eventType: "decision",
      title: "Accepted reflection promoted",
      summary: pattern,
      details: { decisionPath, promotedPath },
    });
    return { decisionPath, promotedPath, memory: page.memory };
  }

  private cleanReflectionLine(line: string): string {
    return line.trim().replace(/^[-*]\s+/, "").replace(/^(?:Summary|Blocker|Issue|Lesson):\s*/i, "").trim();
  }

  private extractReflectionNarrativeLines(content: string): string[] {
    const narrativeSections = /^(?:lessons?|findings?|insights?|risks?|blockers?|issues?|summary|retrospective|what we learned)$/i;
    const lines: string[] = [];
    let inNarrativeSection = false;
    for (const rawLine of content.split("\n")) {
      const heading = rawLine.match(/^#{2,6}\s+(.+?)\s*$/)?.[1]?.trim();
      if (heading !== undefined) {
        inNarrativeSection = narrativeSections.test(heading);
        continue;
      }
      const labeled = rawLine.match(/^\s*[-*]?\s*(?:Lesson|Blocker|Issue|Summary):\s*(.+?)\s*$/i)?.[1];
      if (labeled) {
        lines.push(labeled);
        continue;
      }
      if (!inNarrativeSection || !rawLine.trim()) continue;
      lines.push(rawLine);
    }
    return lines;
  }

  private normalizeReflectionPattern(line: string): string | null {
    const cleaned = this.cleanReflectionLine(line);
    if (cleaned.length < 20 || line.trim().startsWith("#")) return null;
    if (line.trim().startsWith("```") || line.trim().startsWith("|") || /^[-:|\s]+$/.test(line)) return null;
    if (/^\[[ x-]\]\s/i.test(cleaned) || cleaned.includes(" | ")) return null;
    if (/[`✅❌⚠️]/u.test(cleaned)) return null;
    if (/^[\[{].*[\]}][,;]?$/.test(cleaned) || /[{}\[\]"]/.test(cleaned)) return null;
    if (/^(?:https?:\/\/|(?:wiki|raw|runs|tasks)\/|\.?\.?\/)[^\s]+$/i.test(cleaned)) return null;
    if (/^(?:[-*]\s*)?(?:id|path|file|url|endpoint|command|payload|result|output|input|context|instruction|memory trust|evidence):/i.test(cleaned)) return null;
    if (/^(?:none|null|undefined|n\/a|true|false|completed|pending|approved|rejected)$/i.test(cleaned)) return null;
    if (/\bcompleted execution and requests review\b/i.test(cleaned)) return null;
    if (/\batellier build loop completed\b/i.test(cleaned)) return null;
    if (/\b(?:llm wiki ingest loop|manual run) completed\b/i.test(cleaned)) return null;
    if (/\bcompleted (?:handoff )?execution\b/i.test(cleaned)) return null;
    if (/\bcompleted all steps?\b/i.test(cleaned)) return null;
    if (/\b(?:live flow )?demo completed(?: successfully)?\b/i.test(cleaned)) return null;
    if (/\bfinali[sz]ed from (?:the )?dashboard\b/i.test(cleaned)) return null;
    if (/\bcompleted with (?:[^.\n]{0,80}\s)?validation blockers?\b/i.test(cleaned)) return null;
    if (/\b(?:phase\s+\d+\s+)?finali[sz]e\b/i.test(cleaned)) return null;
    if (/\bgenerated (?:a )?run artifact\b/i.test(cleaned)) return null;
    if (/\bcompleted steps?\s*:?\s*\d+\s*\/\s*\d+\b/i.test(cleaned)) return null;
    if (/\bfake executor\b/i.test(cleaned)) return null;
    if (/\b(?:stdout|stderr)\b/i.test(cleaned)) return null;
    if (/\b(?:artifact|output|log|report|file) paths?\b/i.test(cleaned)) return null;
    if (/\bpnpm\s+(?:--\S+\s+)*(?:test|typecheck|build|lint)\b/i.test(cleaned)) return null;
    if (/^`[^`]+`\s+(?:passed|failed|succeeded|completed)\.?$/i.test(cleaned)) return null;
    if (/^(?:tests?|typecheck|build|lint|validation)(?:\s+suite)?\s+(?:passed|failed|succeeded|completed)\.?$/i.test(cleaned)) return null;
    if (/^(?:Run ID|Task ID|Agent ID|Created|Updated|Status|Type|Review|Layer|State|Authority|Date|Branch):/i.test(cleaned)) return null;
    const normalized = cleaned
      .toLowerCase()
      .replace(/(?:wiki|raw|runs|tasks)\/[a-z0-9._/-]+/gi, "<path>")
      .replace(/\b[0-9a-f]{24}\b/gi, "<id>")
      .replace(/\b\d{4}-\d{2}-\d{2}(?:t[^\s]+)?\b/gi, "<date>")
      .replace(/\s+/g, " ")
      .trim();
    return normalized.length >= 20 ? normalized : null;
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

    const reviewLearningSignals = (await this.listReviewLearnings()).filter(
      (learning) => learning.signal && learning.signalPath && !learning.resolution,
    );
    for (const learning of reviewLearningSignals) {
      addIssue({
        code: "curation_signal",
        path: learning.signalPath!,
        message: `Approved ${learning.role} learning marks this page as ${learning.signal}. Learning: ${learning.lesson.slice(0, 160)}`,
        suggestion: `Review the ${learning.signal} signal from run ${learning.runId} and record the resolution.`,
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

  private markGenericWrite(content: string): string {
    if (/^- Trust source:\s*generic-write\s*$/im.test(content)) return content;
    const lines = content.split("\n");
    const insertionIndex = lines[0]?.startsWith("#") ? 1 : 0;
    lines.splice(insertionIndex, 0, "", "- Trust source: generic-write");
    return lines.join("\n");
  }

  private hashText(value: string): string {
    return createHash("sha256").update(value).digest("hex");
  }

  private async selectAppendOnlyIngestPath(basePath: string, fingerprint: string): Promise<string> {
    const extension = ".md";
    const stem = basePath.slice(0, -extension.length);
    const candidates = [basePath, `${stem}-${fingerprint.slice(0, 12)}${extension}`];
    for (const candidate of candidates) {
      try {
        const existing = await this.readPage(candidate);
        if (this.extractMetadata(existing.content, "Ingest fingerprint") === fingerprint) return candidate;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") return candidate;
        throw error;
      }
    }
    return `${stem}-${fingerprint}${extension}`;
  }

  private async writeImmutablePage(relativePath: string, content: string, fingerprint: string): Promise<void> {
    const created = await this.writeExclusivePage(relativePath, content);
    if (created) return;
    const existing = await this.readPage(relativePath);
    if (this.extractMetadata(existing.content, "Ingest fingerprint") !== fingerprint) {
      throw new Error("Immutable raw ingest path already contains different content.");
    }
  }

  private async writeIdempotentPage(relativePath: string, content: string): Promise<void> {
    const created = await this.writeExclusivePage(relativePath, content);
    if (created) return;
    // A derived page may contain a different capture timestamp on an exact retry.
    // Its path is bound to the immutable raw fingerprint, so preserving the first version is idempotent.
  }

  private async writeExclusivePage(relativePath: string, content: string): Promise<boolean> {
    const { resolved } = this.resolveAtelierPath(relativePath);
    await mkdir(path.dirname(resolved), { recursive: true });
    try {
      await writeFile(resolved, content, { encoding: "utf8", flag: "wx" });
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") return false;
      throw error;
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
    const withoutPrefix = normalized.startsWith("atelier/") ? normalized.slice("atelier/".length) : normalized;
    if (withoutPrefix.split("/").some((segment) => segment === "." || segment === "..")) {
      throw new Error("Writable wiki path cannot contain traversal segments.");
    }
    const canonical = path.posix.normalize(withoutPrefix);
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
      "role-memory",
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
    let entries;
    try {
      entries = await readdir(root, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
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
