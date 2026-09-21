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
  type LearningCandidate,
  type LearningCandidateDecision,
  type LearningExperiment,
  type LearningShadowObservation,
  type LearningShadowComparison,
  type EvaluationLedgerEvidencePair,
  type EvaluationLedgerEvidenceComparison,
  type EvaluationLedgerReceiptReference,
  type ControlBundle,
  type CreateControlBundleInput,
  type ControlBundleProposal,
  type ControlBundleCanary,
  type ControlBundleApproval,
  type GrantControlBundleApprovalInput,
  type ExecutionBudgetReceipt,
  type ReversibleWorkspaceChange,
  type ReversibleWorkspaceApproval,
  type ApproveReversibleWorkspaceChangeInput,
  type CodeChangeVerification,
  type RecordCodeChangeVerificationInput,
  type SupervisedCodeChange,
  type SupervisedCodeVerificationCheck,
  type SupervisedCodeVerificationReceipt,
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

  async recordLearningCandidateDecision(
    input: LearningCandidateDecision & { candidate: LearningCandidate },
  ): Promise<{ path: string; created: boolean } & LearningCandidateDecision> {
    await this.ensureWiki();
    const candidateId = input.candidateId.trim();
    const note = input.note.trim().replace(/\s+/g, " ");
    if (!candidateId || !note) throw new Error("Candidate ID and operator note are required.");
    if (input.candidate.id !== candidateId || input.candidate.evidenceDigest !== input.evidenceDigest) {
      throw new Error("Learning candidate evidence does not match the reviewed candidate.");
    }
    const createdAt = input.decidedAt || new Date().toISOString();
    const path = this.learningCandidateDecisionPath(candidateId, input.evidenceDigest);
    const content = [
      `# Learning Candidate Decision - ${input.candidate.title}`,
      "",
      `- Candidate ID: ${candidateId}`,
      `- Evidence digest: ${input.evidenceDigest}`,
      `- Decision: ${input.decision}`,
      `- Operator note: ${note}`,
      `- Created: ${createdAt}`,
      "",
      "## Candidate",
      "",
      input.candidate.rationale,
      "",
      "## Evaluation evidence",
      "",
      `- Evaluated runs: ${input.candidate.evidence.total}`,
      `- Passed: ${input.candidate.evidence.outcomes.passed}`,
      `- Needs human: ${input.candidate.evidence.outcomes["needs-human"]}`,
      `- Failed: ${input.candidate.evidence.outcomes.failed}`,
      `- Tool successes: ${input.candidate.evidence.toolInvocations.succeeded}`,
      `- Tool denied: ${input.candidate.evidence.toolInvocations.denied}`,
      `- Tool failed: ${input.candidate.evidence.toolInvocations.failed}`,
      "",
      "## Review boundary",
      "",
      "This operator decision records review of the exact candidate evidence above. It does not activate a policy, promote trusted memory, change model routing, or grant a tool permission.",
      "",
    ].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.readPage(path);
      const existingCandidateId = this.extractMetadata(existing.content, "Candidate ID");
      const existingDigest = this.extractMetadata(existing.content, "Evidence digest");
      const existingDecision = this.extractMetadata(existing.content, "Decision");
      const existingNote = this.extractMetadata(existing.content, "Operator note");
      if (existingCandidateId !== candidateId || existingDigest !== input.evidenceDigest || existingDecision !== input.decision || existingNote !== note) {
        throw new Error("Learning candidate already has a different durable decision.");
      }
      return {
        candidateId,
        evidenceDigest: input.evidenceDigest,
        decision: input.decision,
        note,
        decidedAt: this.extractMetadata(existing.content, "Created") || "unknown",
        path,
        created: false,
      };
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: `Learning candidate ${input.decision}`, summary: candidateId, details: { candidateId, evidenceDigest: input.evidenceDigest, decision: input.decision } });
    return { candidateId, evidenceDigest: input.evidenceDigest, decision: input.decision, note, decidedAt: createdAt, path, created: true };
  }

  async getLearningCandidateDecision(
    candidate: Pick<LearningCandidate, "id" | "evidenceDigest">,
  ): Promise<(LearningCandidateDecision & { path: string }) | null> {
    const decisions = await this.listLearningCandidateDecisions(candidate.id);
    return decisions.find((decision) => decision.evidenceDigest === candidate.evidenceDigest) ?? null;
  }

  async listLearningCandidateDecisions(
    candidateId: string,
  ): Promise<Array<LearningCandidateDecision & { path: string }>> {
    await this.ensureWiki();
    const normalizedCandidateId = candidateId.trim();
    if (!normalizedCandidateId) return [];
    const decisionsDir = path.join(this.wikiRoot, "decisions", "learning");
    let fileNames: string[];
    try {
      fileNames = await readdir(decisionsDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
    const decisions: Array<LearningCandidateDecision & { path: string }> = [];
    for (const fileName of fileNames.filter((name) => name.endsWith(".md")).sort()) {
      const relativePath = `wiki/decisions/learning/${fileName}`;
      const existing = await this.readPage(relativePath);
      const candidateId = this.extractMetadata(existing.content, "Candidate ID");
      const evidenceDigest = this.extractMetadata(existing.content, "Evidence digest");
      const decision = this.extractMetadata(existing.content, "Decision");
      const note = this.extractMetadata(existing.content, "Operator note");
      const decidedAt = this.extractMetadata(existing.content, "Created");
      if (
        candidateId !== normalizedCandidateId
        || !note
        || !decidedAt
        || !decision
        || !evidenceDigest
        || !["accepted", "rejected", "deferred"].includes(decision)
      ) {
        continue;
      }
      decisions.push({
        candidateId,
        evidenceDigest,
        decision: decision as LearningCandidateDecision["decision"],
        note,
        decidedAt,
        path: relativePath,
      });
    }
    return decisions.sort((left, right) => right.decidedAt.localeCompare(left.decidedAt));
  }

  async recordLearningShadowExperiment(input: {
    candidate: LearningCandidate;
    note: string;
    createdAt: string;
  }): Promise<LearningExperiment & { created: boolean }> {
    await this.ensureWiki();
    const note = input.note.trim().replace(/\s+/g, " ");
    if (!note) throw new Error("Experiment note is required.");
    const id = `shadow-${this.slugify(input.candidate.id)}-${input.candidate.evidenceDigest.slice(0, 16)}`;
    const path = `wiki/decisions/learning/experiments/${id}.md`;
    const content = [
      `# Learning Shadow Experiment - ${input.candidate.title}`, "",
      `- Experiment ID: ${id}`, `- Candidate ID: ${input.candidate.id}`,
      `- Evidence digest: ${input.candidate.evidenceDigest}`, "- Mode: shadow", "- Status: prepared",
      `- Operator note: ${note}`, `- Created: ${input.createdAt}`, "",
      "## Safety boundary", "",
      "This is a prepared observation-only experiment. It does not change policy, routing, memory, permissions, prompts, tools, or runtime behavior.", "",
    ].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (created) {
      await this.upsertWikiIndexEntry(path, content);
      await this.appendLog({ eventType: "decision", title: "Learning shadow experiment prepared", summary: input.candidate.id, details: { experimentId: id, evidenceDigest: input.candidate.evidenceDigest, mode: "shadow" } });
    }
    return { id, candidateId: input.candidate.id, evidenceDigest: input.candidate.evidenceDigest, mode: "shadow", status: "prepared", note, createdAt: input.createdAt, path, created };
  }

  async recordLearningShadowObservation(input: Omit<LearningShadowObservation, "path">): Promise<LearningShadowObservation> {
    await this.ensureWiki();
    const note = input.note.trim().replace(/\s+/g, " ");
    if (!note) throw new Error("Observation note is required.");
    const observationPath = `wiki/decisions/learning/experiments/${this.slugify(input.experimentId)}-observations.md`;
    const { resolved } = this.resolveAtelierPath(observationPath);
    await mkdir(path.dirname(resolved), { recursive: true });
    const entry = [
      `## [${input.observedAt}] observation`, `- Experiment ID: ${input.experimentId}`,
      `- Quality: ${input.quality}`,
      ...(input.durationMs === undefined ? [] : [`- Duration ms: ${input.durationMs}`]),
      ...(input.retries === undefined ? [] : [`- Retries: ${input.retries}`]),
      ...(input.needsHuman === undefined ? [] : [`- Needs human: ${input.needsHuman}`]),
      `- Note: ${note}`, "",
    ].join("\n");
    await appendFile(resolved, entry, "utf8");
    await this.appendLog({ eventType: "decision", title: "Learning shadow observation recorded", summary: input.experimentId, details: { quality: input.quality } });
    return { ...input, note, path: observationPath };
  }

  async getLearningShadowExperiment(experimentId: string): Promise<LearningExperiment | null> {
    const path = `wiki/decisions/learning/experiments/${this.slugify(experimentId)}.md`;
    const content = await this.readOptionalPage(path);
    if (!content) return null;
    const id = this.extractMetadata(content, "Experiment ID");
    const candidateId = this.extractMetadata(content, "Candidate ID");
    const evidenceDigest = this.extractMetadata(content, "Evidence digest");
    const mode = this.extractMetadata(content, "Mode");
    const status = this.extractMetadata(content, "Status");
    const note = this.extractMetadata(content, "Operator note");
    const createdAt = this.extractMetadata(content, "Created");
    if (id !== experimentId || !candidateId || !evidenceDigest || mode !== "shadow" || status !== "prepared" || !note || !createdAt) {
      throw new Error("Learning shadow experiment provenance is invalid.");
    }
    return { id, candidateId, evidenceDigest, mode, status, note, createdAt, path };
  }

  async recordEvaluationLedgerEvidencePair(input: {
    experimentId: string;
    baseline: EvaluationLedgerReceiptReference;
    shadow: EvaluationLedgerReceiptReference;
  }): Promise<EvaluationLedgerEvidencePair> {
    await this.ensureWiki();
    if (!await this.getLearningShadowExperiment(input.experimentId)) throw new Error("Learning shadow experiment does not exist.");
    const baseline = input.baseline;
    const shadow = input.shadow;
    if (baseline.runId === shadow.runId && baseline.evaluationId === shadow.evaluationId) throw new Error("Baseline and shadow must reference different Evaluation Ledger receipts.");
    if (baseline.terminalStatus !== "completed" || shadow.terminalStatus !== "completed") throw new Error("Paired evidence requires completed terminal receipts.");
    if (!baseline.contextReceiptHash || !shadow.contextReceiptHash || baseline.contextReceiptHash !== shadow.contextReceiptHash) throw new Error("Paired evidence requires the same Context Receipt hash.");
    if (!baseline.agentRole || !shadow.agentRole || baseline.agentRole !== shadow.agentRole) throw new Error("Paired evidence requires the same agent role.");
    if (!baseline.logicalStepId || !shadow.logicalStepId || baseline.logicalStepId !== shadow.logicalStepId) throw new Error("Paired evidence requires the same logical step.");
    if (!/^[a-f0-9]{64}$/.test(baseline.configurationFingerprint) || !/^[a-f0-9]{64}$/.test(shadow.configurationFingerprint)) throw new Error("Paired evidence requires exact configuration fingerprints.");
    if (baseline.configurationFingerprint === shadow.configurationFingerprint) throw new Error("Baseline and shadow must use different configuration fingerprints.");
    const comparisonKey = this.fingerprint({ contextReceiptHash: baseline.contextReceiptHash, agentRole: baseline.agentRole, logicalStepId: baseline.logicalStepId });
    const canonical = {
      experimentId: input.experimentId,
      comparisonKey,
      baseline: { runId: baseline.runId, evaluationId: baseline.evaluationId, fingerprint: baseline.fingerprint, configurationFingerprint: baseline.configurationFingerprint },
      shadow: { runId: shadow.runId, evaluationId: shadow.evaluationId, fingerprint: shadow.fingerprint, configurationFingerprint: shadow.configurationFingerprint },
    };
    const fingerprint = this.fingerprint(canonical);
    const id = `ledger-pair-${fingerprint.slice(0, 16)}`;
    const path = `wiki/decisions/learning/experiments/${this.slugify(input.experimentId)}/ledger-pairs/${id}.md`;
    const verdict = this.evaluationPairVerdict(baseline, shadow);
    const reused = (await this.listAllEvaluationLedgerEvidencePairs()).find((pair) =>
      !(pair.experimentId === input.experimentId && pair.id === id)
      && [pair.baseline, pair.shadow].some((receipt) =>
        [baseline, shadow].some((candidate) => candidate.runId === receipt.runId && candidate.evaluationId === receipt.evaluationId)));
    if (reused) throw new Error("An Evaluation Ledger receipt can belong to only one evidence pair.");
    const createdAt = new Date().toISOString();
    const content = [
      `# Evaluation Ledger Evidence Pair ${id}`, "",
      `- Pair ID: ${id}`, `- Experiment ID: ${input.experimentId}`, `- Comparison key: ${comparisonKey}`, `- Fingerprint: ${fingerprint}`, `- Verdict: ${verdict}`, `- Created: ${createdAt}`, "",
      "## Baseline receipt", "",
      ...this.evaluationReceiptMetadata("Baseline", baseline), "",
      "## Shadow receipt", "",
      ...this.evaluationReceiptMetadata("Shadow", shadow), "",
      "## Safety boundary", "",
      "This pair is derived from existing terminal Evaluation Ledger receipts. It does not change runtime configuration, routing, policy, budgets, tools, or permissions.", "",
    ].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getEvaluationLedgerEvidencePair(input.experimentId, id);
      if (existing?.fingerprint === fingerprint) return existing;
      throw new Error("Evaluation Ledger evidence pair conflicts with an existing durable record.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Paired Evaluation Ledger evidence recorded", summary: input.experimentId, details: { pairId: id, fingerprint, verdict } });
    return { id, experimentId: input.experimentId, comparisonKey, fingerprint, baseline, shadow, verdict, createdAt, path };
  }

  async getEvaluationLedgerEvidencePair(experimentId: string, pairId: string): Promise<EvaluationLedgerEvidencePair | null> {
    const path = `wiki/decisions/learning/experiments/${this.slugify(experimentId)}/ledger-pairs/${this.slugify(pairId)}.md`;
    const content = await this.readOptionalPage(path);
    if (!content) return null;
    const id = this.extractMetadata(content, "Pair ID");
    const recordedExperimentId = this.extractMetadata(content, "Experiment ID");
    const comparisonKey = this.extractMetadata(content, "Comparison key");
    const fingerprint = this.extractMetadata(content, "Fingerprint");
    const verdict = this.extractMetadata(content, "Verdict");
    const createdAt = this.extractMetadata(content, "Created");
    const baseline = this.readEvaluationReceiptMetadata(content, "Baseline");
    const shadow = this.readEvaluationReceiptMetadata(content, "Shadow");
    if (!id || id !== pairId || recordedExperimentId !== experimentId || !comparisonKey || !fingerprint || !createdAt || !baseline || !shadow || !["improving", "neutral", "regressing"].includes(verdict ?? "")) throw new Error("Evaluation Ledger evidence pair provenance is invalid.");
    const expectedKey = this.fingerprint({ contextReceiptHash: baseline.contextReceiptHash, agentRole: baseline.agentRole, logicalStepId: baseline.logicalStepId });
    const canonical = { experimentId, comparisonKey, baseline: { runId: baseline.runId, evaluationId: baseline.evaluationId, fingerprint: baseline.fingerprint, configurationFingerprint: baseline.configurationFingerprint }, shadow: { runId: shadow.runId, evaluationId: shadow.evaluationId, fingerprint: shadow.fingerprint, configurationFingerprint: shadow.configurationFingerprint } };
    if (comparisonKey !== expectedKey || this.fingerprint(canonical) !== fingerprint || this.evaluationPairVerdict(baseline, shadow) !== verdict) throw new Error("Evaluation Ledger evidence pair fingerprint is invalid.");
    return { id, experimentId, comparisonKey, fingerprint, baseline, shadow, verdict: verdict as EvaluationLedgerEvidencePair["verdict"], createdAt, path };
  }

  async listEvaluationLedgerEvidencePairs(experimentId: string): Promise<EvaluationLedgerEvidencePair[]> {
    const dir = path.join(this.wikiRoot, "decisions", "learning", "experiments", this.slugify(experimentId), "ledger-pairs");
    try {
      const names = (await readdir(dir)).filter((name) => /^ledger-pair-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getEvaluationLedgerEvidencePair(experimentId, name.slice(0, -3))))).filter((pair): pair is EvaluationLedgerEvidencePair => Boolean(pair));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async listAllEvaluationLedgerEvidencePairs(): Promise<EvaluationLedgerEvidencePair[]> {
    const experimentsDir = path.join(this.wikiRoot, "decisions", "learning", "experiments");
    try {
      const entries = await readdir(experimentsDir, { withFileTypes: true });
      const experimentIds = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
      return (await Promise.all(experimentIds.map((experimentId) => this.listEvaluationLedgerEvidencePairs(experimentId)))).flat();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async compareEvaluationLedgerEvidence(experimentId: string): Promise<EvaluationLedgerEvidenceComparison> {
    const pairs = await this.listEvaluationLedgerEvidencePairs(experimentId);
    const quality = { improving: 0, neutral: 0, regressing: 0 };
    for (const pair of pairs) quality[pair.verdict] += 1;
    const minimumPairs = 3;
    const reasons = [
      ...(pairs.length < minimumPairs ? [`Requires at least ${minimumPairs} paired Evaluation Ledger receipts.`] : []),
      ...(quality.regressing > 0 ? ["Contains one or more receipt-derived regressions."] : []),
      ...(quality.improving <= quality.neutral ? ["Does not show a strict improvement over neutral paired evidence."] : []),
    ];
    const baselineConfigurations = [...new Set(pairs.map((pair) => pair.baseline.configurationFingerprint))];
    const shadowConfigurations = [...new Set(pairs.map((pair) => pair.shadow.configurationFingerprint))];
    if (baselineConfigurations.length > 1) reasons.push("Baseline receipts do not share one exact configuration.");
    if (shadowConfigurations.length > 1) reasons.push("Shadow receipts do not share one exact configuration.");
    const evidenceDigest = this.fingerprint({ experimentId, pairs: pairs.map((pair) => ({ fingerprint: pair.fingerprint, verdict: pair.verdict })) });
    return { experimentId, pairs: pairs.length, quality, eligibility: { eligibleForProposal: reasons.length === 0, reasons, minimumPairs }, autonomousPromotion: { eligible: false, reasons: ["No independent, protected substantive-quality and holdout evidence is attached to these receipt pairs."] }, evidenceDigest, baselineConfigurationFingerprint: baselineConfigurations.length === 1 ? baselineConfigurations[0] : undefined, shadowConfigurationFingerprint: shadowConfigurations.length === 1 ? shadowConfigurations[0] : undefined, safety: "receipt-derived-only" };
  }

  async createControlBundle(input: CreateControlBundleInput): Promise<ControlBundle> {
    await this.ensureWiki();
    const createdAt = new Date().toISOString();
    const canonical = {
      modelProfiles: {
        cheap: input.modelProfiles.cheap,
        standard: input.modelProfiles.standard,
        deep: input.modelProfiles.deep,
      },
      limits: input.limits,
      allowedTools: [...new Set(input.allowedTools)].sort(),
    };
    const fingerprint = createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
    const id = `bundle-${fingerprint.slice(0, 16)}`;
    const path = `wiki/decisions/control-bundles/${id}.md`;
    const content = [`# Control Bundle ${id}`, "", `- Bundle ID: ${id}`, "- Version: 1", "- Status: draft", `- Fingerprint: ${fingerprint}`, `- Created: ${createdAt}`, `- Operator note: ${input.note.trim()}`, "", "## Configuration", "", "```json", JSON.stringify(canonical, null, 2), "```", "", "## Safety boundary", "", "This draft does not change runtime configuration, model routing, tools, permissions, or budgets.", ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) throw new Error("An identical Control Bundle already exists.");
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Control Bundle draft created", summary: id, details: { fingerprint } });
    return { id, version: 1, status: "draft", ...canonical, fingerprint, createdAt, path };
  }

  async getControlBundle(bundleId: string): Promise<ControlBundle | null> {
    const path = `wiki/decisions/control-bundles/${this.slugify(bundleId)}.md`;
    try {
      const content = (await this.readPage(path)).content;
      const fingerprint = this.extractMetadata(content, "Fingerprint"); const createdAt = this.extractMetadata(content, "Created");
      const json = content.match(/```json\n([\s\S]*?)\n```/)?.[1];
      if (!fingerprint || !createdAt || !json) throw new Error("Control Bundle provenance is invalid.");
      const config = JSON.parse(json) as unknown;
      if (!isControlBundleConfiguration(config)) throw new Error("Control Bundle configuration is invalid.");
      const canonical = {
        modelProfiles: {
          cheap: config.modelProfiles.cheap,
          standard: config.modelProfiles.standard,
          deep: config.modelProfiles.deep,
        },
        limits: {
          executionTimeoutMs: config.limits.executionTimeoutMs,
          maxRetries: config.limits.maxRetries,
          contextBytes: config.limits.contextBytes,
        },
        allowedTools: [...new Set(config.allowedTools)].sort(),
      };
      const expectedFingerprint = this.fingerprint(canonical);
      if (fingerprint !== expectedFingerprint || bundleId !== `bundle-${expectedFingerprint.slice(0, 16)}`) {
        throw new Error("Control Bundle fingerprint is invalid.");
      }
      return { id: bundleId, version: 1, status: "draft", ...canonical, fingerprint, createdAt, path };
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }

  async listControlBundles(): Promise<ControlBundle[]> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles");
    try {
      const names = (await readdir(dir)).filter((name) => /^bundle-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getControlBundle(name.slice(0, -3))))).filter((bundle): bundle is ControlBundle => Boolean(bundle));
    } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return []; throw error; }
  }

  async createControlBundleProposal(input: { experimentId: string; bundleId: string; rationale: string }): Promise<ControlBundleProposal> {
    const bundle = await this.getControlBundle(input.bundleId);
    if (!bundle) throw new Error("Control Bundle does not exist.");
    const comparison = await this.compareEvaluationLedgerEvidence(input.experimentId);
    if (!comparison.eligibility.eligibleForProposal) throw new Error(`Experiment is not eligible: ${comparison.eligibility.reasons.join(" ")}`);
    const rationale = input.rationale.trim().replace(/\s+/g, " ");
    const canonical = { experimentId: input.experimentId, bundleId: bundle.id, bundleFingerprint: bundle.fingerprint, evidenceDigest: comparison.evidenceDigest, rationale };
    const fingerprint = this.fingerprint(canonical);
    const createdAt = new Date().toISOString(); const id = `proposal-${fingerprint.slice(0, 16)}`;
    const path = `wiki/decisions/control-bundles/proposals/${id}.md`;
    const content = [`# Control Bundle Proposal ${id}`, "", `- Proposal ID: ${id}`, `- Experiment ID: ${input.experimentId}`, `- Bundle ID: ${bundle.id}`, `- Bundle fingerprint: ${bundle.fingerprint}`, `- Evidence digest: ${comparison.evidenceDigest}`, `- Fingerprint: ${fingerprint}`, "- Status: pending-approval", `- Created: ${createdAt}`, "", "## Rationale", "", rationale, "", "## Boundary", "", "This proposal requires explicit human approval and cannot activate a bundle.", ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getControlBundleProposal(id);
      if (existing?.fingerprint === fingerprint) return existing;
      throw new Error("Control Bundle proposal fingerprint conflicts with an existing record.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Control Bundle proposal recorded", summary: id, details: { proposalFingerprint: fingerprint, bundleFingerprint: bundle.fingerprint } });
    return { id, experimentId: input.experimentId, bundleId: bundle.id, bundleFingerprint: bundle.fingerprint, evidenceDigest: comparison.evidenceDigest, fingerprint, status: "pending-approval", rationale, createdAt, path };
  }

  async getControlBundleProposal(proposalId: string): Promise<ControlBundleProposal | null> {
    try {
      const record = await this.readControlBundleProposalRecord(proposalId);
      if (!record) return null;
      const canary = await this.findControlBundleCanaryForProposal(record.id);
      const approval = await this.verifyControlBundleApproval(record.id, { skipProposalLookup: true, expectedProposalFingerprint: record.fingerprint, expectedBundleFingerprint: record.bundleFingerprint });
      const comparison = await this.compareEvaluationLedgerEvidence(record.experimentId);
      const evidenceCurrent = comparison.eligibility.eligibleForProposal && comparison.evidenceDigest === record.evidenceDigest;
      const status = canary ? (canary.status === "rolled-back" ? "canary-rolled-back" : "canary-planned") : !evidenceCurrent ? "evidence-stale" : approval.approved ? "approved" : "pending-approval";
      return { ...record, status };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async listControlBundleProposals(): Promise<ControlBundleProposal[]> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles", "proposals");
    try {
      const names = (await readdir(dir)).filter((name) => /^proposal-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getControlBundleProposal(name.slice(0, -3))))).filter((proposal): proposal is ControlBundleProposal => Boolean(proposal));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async planControlBundleCanary(input: { proposalId: string; samplePercent: number }): Promise<ControlBundleCanary> {
    const proposal = await this.getControlBundleProposal(input.proposalId);
    if (!proposal) throw new Error("Control Bundle proposal does not exist.");
    const approval = await this.verifyControlBundleApproval(input.proposalId);
    if (!approval.approved || !approval.approval) throw new Error("A current durable approval is required before planning a canary.");
    if (!Number.isInteger(input.samplePercent) || input.samplePercent < 1 || input.samplePercent > 10) throw new Error("Canary sample must be an integer from 1 to 10.");
    const bundle = await this.getControlBundle(proposal.bundleId);
    if (!bundle || bundle.fingerprint !== proposal.bundleFingerprint) throw new Error("Canary proposal does not reference a verified Control Bundle.");
    const frozenBundle = this.freezeControlBundle(bundle);
    const canonical = { proposalId: proposal.id, proposalFingerprint: proposal.fingerprint, bundleId: bundle.id, bundleFingerprint: bundle.fingerprint, approvalId: approval.approval.id, samplePercent: input.samplePercent, frozenBundle };
    const fingerprint = this.fingerprint(canonical);
    const createdAt = new Date().toISOString(); const id = `canary-${fingerprint.slice(0, 16)}`; const path = `wiki/decisions/control-bundles/canaries/${id}.md`;
    const content = [`# Control Bundle Canary ${id}`, "", `- Canary ID: ${id}`, `- Proposal ID: ${proposal.id}`, `- Proposal fingerprint: ${proposal.fingerprint}`, `- Bundle ID: ${bundle.id}`, `- Bundle fingerprint: ${bundle.fingerprint}`, `- Approval ID: ${approval.approval.id}`, `- Fingerprint: ${fingerprint}`, `- Sample percent: ${input.samplePercent}`, "- Status: planned", `- Created: ${createdAt}`, "", "## Frozen runtime bundle", "", "```json", JSON.stringify(frozenBundle, null, 2), "```", "", "## Safety boundary", "", "This is a frozen canary plan. A separately selected run must receive a bounded budget receipt before any controlled assignment; no global routing changes.", ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getControlBundleCanary(id);
      if (existing?.fingerprint === fingerprint) return existing;
      throw new Error("Canary conflicts with an existing proposal assignment.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Control Bundle canary planned", summary: id, details: { proposalId: proposal.id, proposalFingerprint: proposal.fingerprint, bundleFingerprint: bundle.fingerprint, canaryFingerprint: fingerprint, samplePercent: input.samplePercent } });
    return { id, proposalId: proposal.id, proposalFingerprint: proposal.fingerprint, bundleId: bundle.id, bundleFingerprint: bundle.fingerprint, approvalId: approval.approval.id, fingerprint, frozenBundle, samplePercent: input.samplePercent, status: "planned", createdAt, path };
  }

  async getControlBundleCanary(canaryId: string): Promise<ControlBundleCanary | null> {
    try {
      const canary = await this.readControlBundleCanaryRecord(canaryId);
      if (!canary) return null;
      const proposal = await this.readControlBundleProposalRecord(canary.proposalId);
      const bundle = await this.getControlBundle(canary.bundleId);
      if (!proposal || proposal.fingerprint !== canary.proposalFingerprint || proposal.bundleFingerprint !== canary.bundleFingerprint || !bundle || bundle.fingerprint !== canary.bundleFingerprint) throw new Error("Canary references an unverified proposal or bundle.");
      return canary;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async listControlBundleCanaries(): Promise<ControlBundleCanary[]> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles", "canaries");
    try {
      const names = (await readdir(dir)).filter((name) => /^canary-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getControlBundleCanary(name.slice(0, -3))))).filter((canary): canary is ControlBundleCanary => Boolean(canary));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async rollbackControlBundleCanary(canaryId: string, reason: string): Promise<ControlBundleCanary> {
    const canary = await this.getControlBundleCanary(canaryId);
    if (!canary) throw new Error("Canary does not exist.");
    if (!reason.trim()) throw new Error("Rollback reason is required.");
    if (canary.status === "rolled-back") return canary;
    const eventPath = `wiki/decisions/control-bundles/canaries/events/${this.slugify(canaryId)}.md`;
    const event = [`# Canary Rollback ${canaryId}`, "", `- Canary ID: ${canaryId}`, `- Proposal fingerprint: ${canary.proposalFingerprint}`, `- Rolled back: ${new Date().toISOString()}`, `- Reason: ${reason.trim()}`, ""].join("\n");
    if (!await this.writeExclusivePage(eventPath, event)) throw new Error("Canary rollback already exists with conflicting evidence.");
    await this.appendLog({ eventType: "decision", title: "Control Bundle canary rolled back", summary: canaryId, details: { proposalFingerprint: canary.proposalFingerprint, reason: reason.trim() } });
    return { ...canary, status: "rolled-back", rollbackReason: reason.trim() };
  }

  async reserveCanaryExecutionBudget(input: { canaryId: string; runId: string }): Promise<ExecutionBudgetReceipt> {
    const canary = await this.getControlBundleCanary(input.canaryId);
    if (!canary) throw new Error("Canary does not exist.");
    const selectionBucket = this.canarySelectionBucket(canary.fingerprint, input.runId);
    const assignmentFingerprint = this.fingerprint({ canaryId: canary.id, canaryFingerprint: canary.fingerprint, runId: input.runId, selectionBucket, frozenBundle: canary.frozenBundle });
    const id = `budget-${assignmentFingerprint.slice(0, 16)}`;
    const path = `wiki/decisions/control-bundles/budgets/${id}.md`;
    const existing = await this.getExecutionBudgetReceiptByPath(path);
    if (existing) {
      if (existing.assignmentFingerprint === assignmentFingerprint) return existing;
      throw new Error("Execution budget receipt conflicts with an existing assignment.");
    }
    const approval = (await this.listControlBundleApprovals(canary.proposalId)).find((candidate) => candidate.id === canary.approvalId);
    const safeLimitReason = this.canaryBudgetLimitReason(canary.frozenBundle);
    const reason = canary.status !== "planned"
      ? "Canary has been rolled back."
      : !approval || approval.status !== "active"
        ? "Canary approval is no longer active."
        : selectionBucket >= canary.samplePercent
          ? `Run is outside the deterministic ${canary.samplePercent}% canary sample.`
          : safeLimitReason;
    const status: ExecutionBudgetReceipt["status"] = reason ? "blocked" : "reserved";
    const createdAt = new Date().toISOString();
    const content = [
      "# Canary Execution Budget Receipt", "",
      `- Budget receipt ID: ${id}`, `- Canary ID: ${canary.id}`, `- Canary fingerprint: ${canary.fingerprint}`, `- Proposal fingerprint: ${canary.proposalFingerprint}`,
      `- Bundle ID: ${canary.bundleId}`, `- Bundle fingerprint: ${canary.bundleFingerprint}`, `- Run ID: ${input.runId}`, `- Selection bucket: ${selectionBucket}`,
      `- Assignment fingerprint: ${assignmentFingerprint}`, `- Status: ${status}`, ...(reason ? [`- Reason: ${reason}`] : []), `- Created: ${createdAt}`, "",
      "## Frozen runtime bundle", "", "```json", JSON.stringify(canary.frozenBundle, null, 2), "```", "",
      "This receipt is the only canary assignment authority for this run. It freezes the budget before execution but does not change global model routing or scheduler autonomy.", "",
    ].join("\n");
    if (!await this.writeExclusivePage(path, content)) throw new Error("Execution budget receipt already exists for this assignment.");
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: `Canary execution budget ${status}`, summary: input.runId, details: { canaryId: canary.id, assignmentFingerprint, selectionBucket, ...(reason ? { reason } : {}) } });
    return { id, canaryId: canary.id, canaryFingerprint: canary.fingerprint, proposalFingerprint: canary.proposalFingerprint, bundleId: canary.bundleId, bundleFingerprint: canary.bundleFingerprint, runId: input.runId, selectionBucket, assignmentFingerprint, modelProfiles: canary.frozenBundle.modelProfiles, limits: canary.frozenBundle.limits, allowedTools: canary.frozenBundle.allowedTools, status, ...(reason ? { reason } : {}), createdAt, path };
  }

  async listExecutionBudgetReceipts(): Promise<ExecutionBudgetReceipt[]> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles", "budgets");
    try {
      const names = (await readdir(dir)).filter((name) => /^budget-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getExecutionBudgetReceiptByPath(`wiki/decisions/control-bundles/budgets/${name}`)))).filter((receipt): receipt is ExecutionBudgetReceipt => Boolean(receipt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async createReversibleWorkspacePreview(input: { path: string; before: string; after: string }): Promise<ReversibleWorkspaceChange> {
    const targetPath = input.path.trim().replace(/\\/g, "/");
    if (!targetPath || targetPath.startsWith("/") || targetPath.split("/").some((part) => part === ".." || part === ".")) throw new Error("Preview path must be a relative non-traversing workspace path.");
    if (input.before.length > 64_000 || input.after.length > 64_000) throw new Error("Preview content exceeds the bounded limit.");
    const beforeDigest = this.fingerprint(input.before);
    const afterDigest = this.fingerprint(input.after);
    const fingerprint = this.fingerprint({ targetPath, beforeDigest, afterDigest });
    const createdAt = new Date().toISOString(); const id = `change-${fingerprint.slice(0, 16)}`;
    const evidencePath = `wiki/decisions/reversible-changes/${id}.md`;
    const content = [`# Reversible Workspace Change ${id}`, "", `- Change ID: ${id}`, `- Target path: ${targetPath}`, `- Fingerprint: ${fingerprint}`, `- Before digest: ${beforeDigest}`, `- After digest: ${afterDigest}`, "- Status: preview", `- Created: ${createdAt}`, "", "## Before", "", "```text", input.before, "```", "", "## Proposed after", "", "```text", input.after, "```", "", "This is a preview only. No workspace file was modified.", ""].join("\n");
    const created = await this.writeExclusivePage(evidencePath, content);
    if (!created) {
      const existing = await this.getReversibleWorkspacePreview(id);
      if (existing?.fingerprint === fingerprint) return existing;
      throw new Error("Workspace preview fingerprint conflicts with an existing record.");
    }
    await this.upsertWikiIndexEntry(evidencePath, content);
    await this.appendLog({ eventType: "decision", title: "Reversible workspace preview recorded", summary: id, details: { path: targetPath, fingerprint } });
    return { id, path: targetPath, before: input.before, after: input.after, beforeDigest, afterDigest, fingerprint, status: "preview", createdAt, evidencePath };
  }

  async approveReversibleWorkspaceChange(input: ApproveReversibleWorkspaceChangeInput): Promise<ReversibleWorkspaceApproval> {
    const preview = await this.getReversibleWorkspacePreview(input.changeId);
    if (!preview) throw new Error("Workspace preview does not exist.");
    if (preview.status === "applied" || preview.status === "rolled-back") throw new Error("Workspace preview is no longer approvable in its current state.");
    const expiresAt = new Date(input.expiresAt);
    const note = input.note.trim().replace(/\s+/g, " ");
    if (!note || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) throw new Error("Approval note and future expiry are required.");
    const canonical = { changeId: preview.id, changeFingerprint: preview.fingerprint, expiresAt: input.expiresAt, note };
    const id = `approval-${this.fingerprint(canonical).slice(0, 16)}`;
    const grantedAt = new Date().toISOString(); const path = `wiki/decisions/reversible-changes/approvals/${id}.md`;
    const content = [`# Reversible Change Approval`, "", `- Approval ID: ${id}`, `- Change ID: ${preview.id}`, `- Change fingerprint: ${preview.fingerprint}`, `- Granted: ${grantedAt}`, `- Expires: ${input.expiresAt}`, `- Note: ${note}`, "", "Approval does not apply the change; apply must still verify the preview snapshot.", ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getReversibleWorkspaceApprovalByPath(path);
      if (existing && existing.changeFingerprint === preview.fingerprint) return existing;
      throw new Error("Workspace approval conflicts with an existing durable record.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Reversible workspace approval recorded", summary: preview.id, details: { changeFingerprint: preview.fingerprint, approvalId: id } });
    return { id, changeId: preview.id, changeFingerprint: preview.fingerprint, status: "active", grantedAt, expiresAt: input.expiresAt, note, path };
  }

  async getReversibleWorkspacePreview(changeId: string): Promise<ReversibleWorkspaceChange | null> {
    const evidencePath = `wiki/decisions/reversible-changes/${this.slugify(changeId)}.md`;
    try {
      const content = (await this.readPage(evidencePath)).content;
      const target = this.extractMetadata(content, "Target path");
      const fingerprint = this.extractMetadata(content, "Fingerprint");
      const beforeDigest = this.extractMetadata(content, "Before digest");
      const afterDigest = this.extractMetadata(content, "After digest");
      const createdAt = this.extractMetadata(content, "Created");
      const blocks = [...content.matchAll(/```text\n([\s\S]*?)\n```/g)].map((match) => match[1] ?? "");
      if (!target || !fingerprint || !beforeDigest || !afterDigest || !createdAt || blocks.length < 2) throw new Error("Reversible preview provenance is invalid.");
      if (this.fingerprint(blocks[0]!) !== beforeDigest || this.fingerprint(blocks[1]!) !== afterDigest || this.fingerprint({ targetPath: target, beforeDigest, afterDigest }) !== fingerprint) {
        throw new Error("Reversible preview fingerprint is invalid.");
      }
      const appliedState = await this.readOptionalPage(`wiki/decisions/reversible-changes/events/${this.slugify(changeId)}-applied.md`);
      const rolledBackState = await this.readOptionalPage(`wiki/decisions/reversible-changes/events/${this.slugify(changeId)}-rolled-back.md`);
      const recordedStatus = rolledBackState ? "rolled-back" : appliedState ? "applied" : null;
      const approval = await this.verifyReversibleWorkspaceApproval(changeId, { skipPreviewLookup: true, expectedChangeFingerprint: fingerprint });
      const status = recordedStatus === "rolled-back" ? "rolled-back" : recordedStatus === "applied" ? "applied" : approval.approved ? "approved" : "preview";
      const appliedHandle = appliedState ? this.extractMetadata(appliedState, "Rollback handle") ?? undefined : undefined;
      const latestState = rolledBackState ?? appliedState;
      const lastOperation = latestState ? this.extractMetadata(latestState, "Effect operation") : undefined;
      const lastIdempotencyKey = latestState ? this.extractMetadata(latestState, "Effect idempotency key") : undefined;
      const lastEffectFingerprint = latestState ? this.extractMetadata(latestState, "Effect fingerprint") : undefined;
      const lastRecordedAt = latestState ? this.extractMetadata(latestState, "Recorded") : undefined;
      const lastEffect: ReversibleWorkspaceChange["lastEffect"] = lastOperation && lastIdempotencyKey && lastEffectFingerprint && lastRecordedAt
        && (lastOperation === "apply" || lastOperation === "rollback")
        ? { operation: lastOperation as "apply" | "rollback", idempotencyKey: lastIdempotencyKey, fingerprint: lastEffectFingerprint, recordedAt: lastRecordedAt }
        : undefined;
      return { id: changeId, path: target, before: blocks[0]!, after: blocks[1]!, beforeDigest, afterDigest, fingerprint, status, rollbackHandle: appliedHandle, lastEffect, createdAt, evidencePath };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async listReversibleWorkspaceChanges(): Promise<ReversibleWorkspaceChange[]> {
    const dir = path.join(this.wikiRoot, "decisions", "reversible-changes");
    try {
      const names = (await readdir(dir)).filter((name) => /^change-.+\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getReversibleWorkspacePreview(name.slice(0, -3))))).filter((change): change is ReversibleWorkspaceChange => Boolean(change));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async listReversibleWorkspaceApprovals(changeId: string): Promise<ReversibleWorkspaceApproval[]> {
    const dir = path.join(this.wikiRoot, "decisions", "reversible-changes", "approvals");
    try {
      const names = (await readdir(dir)).filter((name) => /^approval-.+\.md$/.test(name)).sort();
      const approvals = await Promise.all(names.map((name) => this.getReversibleWorkspaceApprovalByPath(`wiki/decisions/reversible-changes/approvals/${name}`)));
      return approvals
        .filter((approval): approval is ReversibleWorkspaceApproval => approval !== null)
        .filter((approval) => approval.changeId === changeId)
        .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async verifyReversibleWorkspaceApproval(changeId: string, options: { skipPreviewLookup?: boolean; expectedChangeFingerprint?: string } = {}): Promise<{ approved: boolean; approval?: ReversibleWorkspaceApproval }> {
    const preview = options.skipPreviewLookup ? undefined : await this.getReversibleWorkspacePreview(changeId);
    const fingerprint = options.expectedChangeFingerprint ?? preview?.fingerprint;
    if (!fingerprint) return { approved: false };
    const approvals = await this.listReversibleWorkspaceApprovals(changeId);
    const approval = approvals.find((candidate) => candidate.changeFingerprint === fingerprint && candidate.status === "active");
    return approval ? { approved: true, approval } : { approved: false };
  }

  async recordCodeChangeVerification(input: RecordCodeChangeVerificationInput): Promise<CodeChangeVerification> {
    const preview = await this.getReversibleWorkspacePreview(input.changeId);
    if (!preview) throw new Error("Workspace preview does not exist.");
    const canonical = { changeId: preview.id, changeFingerprint: preview.fingerprint, commandLabel: input.commandLabel, passed: input.passed, summary: input.summary.trim() };
    const id = `verification-${this.fingerprint(canonical).slice(0, 16)}`;
    const verifiedAt = new Date().toISOString(); const path = `wiki/decisions/reversible-changes/verifications/${id}.md`;
    const content = [`# Code Change Verification`, "", `- Verification ID: ${id}`, `- Change ID: ${preview.id}`, `- Change fingerprint: ${preview.fingerprint}`, `- Check: ${input.commandLabel}`, `- Passed: ${input.passed}`, `- Verified: ${verifiedAt}`, `- Summary: ${input.summary.trim()}`, ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getCodeChangeVerificationByPath(path);
      if (existing && existing.changeFingerprint === preview.fingerprint) return existing;
      throw new Error("Code verification conflicts with an existing durable record.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Code verification recorded", summary: preview.id, details: { changeFingerprint: preview.fingerprint, commandLabel: input.commandLabel, passed: input.passed } });
    return { changeId: preview.id, changeFingerprint: preview.fingerprint, commandLabel: input.commandLabel, passed: input.passed, summary: input.summary.trim(), verifiedAt, path };
  }

  async listCodeChangeVerifications(changeId: string): Promise<CodeChangeVerification[]> {
    const dir = path.join(this.wikiRoot, "decisions", "reversible-changes", "verifications");
    try {
      const names = (await readdir(dir)).filter((name) => /^verification-.+\.md$/.test(name)).sort();
      const verifications = await Promise.all(names.map((name) => this.getCodeChangeVerificationByPath(`wiki/decisions/reversible-changes/verifications/${name}`)));
      return verifications
        .filter((verification): verification is CodeChangeVerification => verification !== null)
        .filter((verification) => verification.changeId === changeId)
        .sort((left, right) => right.verifiedAt.localeCompare(left.verifiedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async verifyCodeChangeVerification(changeId: string): Promise<boolean> {
    const preview = await this.getReversibleWorkspacePreview(changeId);
    if (!preview) return false;
    const verifications = await this.listCodeChangeVerifications(changeId);
    return verifications.some((verification) => verification.changeFingerprint === preview.fingerprint && verification.passed);
  }

  async recordReversibleWorkspaceState(input: {
    changeId: string;
    status: "applied" | "rolled-back";
    idempotencyKey: string;
    effectFingerprint: string;
    rollbackHandle: string;
  }): Promise<ReversibleWorkspaceChange> {
    const preview = await this.getReversibleWorkspacePreview(input.changeId);
    if (!preview) throw new Error("Workspace preview does not exist.");
    if (input.status === "applied" && preview.status !== "approved") throw new Error("Only an approved workspace preview can be applied.");
    if (input.status === "rolled-back" && preview.status !== "applied") throw new Error("Only an applied workspace change can be rolled back.");
    const eventPath = `wiki/decisions/reversible-changes/events/${this.slugify(input.changeId)}-${input.status}.md`;
    const content = [
      `# Reversible Workspace State ${input.changeId}`,
      "",
      `- Change ID: ${input.changeId}`,
      `- Change fingerprint: ${preview.fingerprint}`,
      `- Status: ${input.status}`,
      `- Effect operation: ${input.status === "applied" ? "apply" : "rollback"}`,
      `- Effect idempotency key: ${input.idempotencyKey}`,
      `- Effect fingerprint: ${input.effectFingerprint}`,
      `- Rollback handle: ${input.rollbackHandle}`,
      `- Recorded: ${new Date().toISOString()}`,
      "",
    ].join("\n");
    if (!await this.writeExclusivePage(eventPath, content)) throw new Error("Workspace state already exists with conflicting evidence.");
    await this.appendLog({ eventType: "decision", title: `Reversible workspace change ${input.status}`, summary: input.changeId, details: { changeFingerprint: preview.fingerprint, idempotencyKey: input.idempotencyKey, effectFingerprint: input.effectFingerprint } });
    return {
      ...preview,
      status: input.status,
      rollbackHandle: preview.rollbackHandle ?? input.rollbackHandle,
      lastEffect: {
        operation: input.status === "applied" ? "apply" : "rollback",
        idempotencyKey: input.idempotencyKey,
        fingerprint: input.effectFingerprint,
        recordedAt: this.extractMetadata(content, "Recorded")!,
      },
    };
  }

  async recordSupervisedCodeChangePrepared(input: Omit<SupervisedCodeChange, "status" | "verificationReceipts" | "evidencePath">): Promise<SupervisedCodeChange> {
    const preview = await this.getReversibleWorkspacePreview(input.changeId);
    if (!preview || preview.fingerprint !== input.changeFingerprint || !preview.path.startsWith("apps/") && !preview.path.startsWith("packages/")) {
      throw new Error("Supervised code change must reference a verified code preview.");
    }
    const evidencePath = `wiki/decisions/supervised-code-changes/${this.slugify(input.id)}.md`;
    const content = [
      `# Supervised Code Change ${input.id}`,
      "",
      `- Supervised change ID: ${input.id}`,
      `- Workspace change ID: ${input.changeId}`,
      `- Change fingerprint: ${input.changeFingerprint}`,
      `- Target path: ${input.targetPath}`,
      `- Worktree path: ${input.worktreePath}`,
      `- Base revision: ${input.baseRevision}`,
      `- Created: ${input.createdAt}`,
      "",
      "## Server verification plan",
      "",
      "```json",
      JSON.stringify(input.verificationPlan),
      "```",
      "",
      "The approved preview is applied only inside this server-owned isolated worktree. This record does not apply or merge the preview into the primary checkout.",
      "",
    ].join("\n");
    const created = await this.writeExclusivePage(evidencePath, content);
    if (!created) {
      const existing = await this.getSupervisedCodeChange(input.id);
      if (existing?.changeFingerprint === input.changeFingerprint) return existing;
      throw new Error("Supervised code change conflicts with existing evidence.");
    }
    await this.upsertWikiIndexEntry(evidencePath, content);
    await this.appendLog({ eventType: "decision", title: "Supervised code change prepared", summary: input.id, details: { changeId: input.changeId, changeFingerprint: input.changeFingerprint, baseRevision: input.baseRevision } });
    return { ...input, status: "prepared", verificationReceipts: [], evidencePath };
  }

  async getSupervisedCodeChange(id: string): Promise<SupervisedCodeChange | null> {
    const evidencePath = `wiki/decisions/supervised-code-changes/${this.slugify(id)}.md`;
    try {
      const content = (await this.readPage(evidencePath)).content;
      const recordedId = this.extractMetadata(content, "Supervised change ID");
      const changeId = this.extractMetadata(content, "Workspace change ID");
      const changeFingerprint = this.extractMetadata(content, "Change fingerprint");
      const targetPath = this.extractMetadata(content, "Target path");
      const worktreePath = this.extractMetadata(content, "Worktree path");
      const baseRevision = this.extractMetadata(content, "Base revision");
      const createdAt = this.extractMetadata(content, "Created");
      const planText = content.match(/```json\n([\s\S]*?)\n```/)?.[1];
      const verificationPlan = planText ? JSON.parse(planText) : null;
      if (!recordedId || recordedId !== id || !changeId || !changeFingerprint || !targetPath || !worktreePath || !baseRevision || !createdAt || !Array.isArray(verificationPlan) || !verificationPlan.every((check) => ["api-typecheck", "web-typecheck", "api-tests", "web-tests"].includes(check))) {
        throw new Error("Supervised code change provenance is invalid.");
      }
      const receipts = await this.listSupervisedCodeVerificationReceipts(id);
      receipts.sort((left, right) => verificationPlan.indexOf(left.check) - verificationPlan.indexOf(right.check));
      const discarded = await this.readOptionalPage(`wiki/decisions/supervised-code-changes/events/${this.slugify(id)}-discarded.md`);
      const status = discarded
        ? "discarded"
        : receipts.some((receipt) => receipt.status === "failed")
          ? "verification-failed"
          : receipts.length === verificationPlan.length && receipts.every((receipt) => receipt.status === "passed")
            ? "verified"
            : "prepared";
      return {
        id,
        changeId,
        changeFingerprint,
        targetPath,
        worktreePath,
        baseRevision,
        status,
        verificationPlan: verificationPlan as SupervisedCodeVerificationCheck[],
        verificationReceipts: receipts,
        createdAt,
        evidencePath,
        discardedAt: discarded ? this.extractMetadata(discarded, "Discarded") ?? undefined : undefined,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  async listSupervisedCodeChanges(): Promise<SupervisedCodeChange[]> {
    const dir = path.join(this.wikiRoot, "decisions", "supervised-code-changes");
    try {
      const names = (await readdir(dir)).filter((name) => /^supervised-[a-f0-9]{16}\.md$/.test(name)).sort();
      return (await Promise.all(names.map((name) => this.getSupervisedCodeChange(name.slice(0, -3))))).filter((change): change is SupervisedCodeChange => Boolean(change));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async recordSupervisedCodeVerification(input: SupervisedCodeVerificationReceipt & { supervisedChangeId: string }): Promise<SupervisedCodeVerificationReceipt> {
    const supervised = await this.getSupervisedCodeChange(input.supervisedChangeId);
    if (!supervised) throw new Error("Supervised code change does not exist.");
    if (!supervised.verificationPlan.includes(input.check)) throw new Error("Verification is outside this supervised code change plan.");
    const eventPath = `wiki/decisions/supervised-code-changes/events/${this.slugify(input.supervisedChangeId)}-verification-${input.check}.md`;
    const content = [
      "# Supervised Code Verification", "",
      `- Supervised change ID: ${input.supervisedChangeId}`,
      `- Check: ${input.check}`,
      `- Command: ${input.command}`,
      `- Status: ${input.status}`,
      `- Exit code: ${input.exitCode ?? "null"}`,
      `- Duration ms: ${input.durationMs}`,
      `- Termination: ${input.termination ?? "completed"}`,
      `- Stdout path: ${input.stdoutPath}`,
      `- Stderr path: ${input.stderrPath}`,
      `- Effect idempotency key: ${input.idempotencyKey}`,
      `- Effect fingerprint: ${input.fingerprint}`,
      `- Recorded: ${input.recordedAt}`,
      "",
    ].join("\n");
    const created = await this.writeExclusivePage(eventPath, content);
    if (!created) {
      const existing = await this.getSupervisedCodeVerificationReceipt(eventPath);
      if (existing?.fingerprint === input.fingerprint) return existing;
      throw new Error("Supervised verification conflicts with existing evidence.");
    }
    await this.appendLog({ eventType: "decision", title: `Supervised code verification ${input.status}`, summary: input.supervisedChangeId, details: { check: input.check, fingerprint: input.fingerprint, exitCode: input.exitCode } });
    return input;
  }

  async recordSupervisedCodeChangeDiscarded(input: { id: string; discardedAt: string }): Promise<SupervisedCodeChange> {
    const supervised = await this.getSupervisedCodeChange(input.id);
    if (!supervised) throw new Error("Supervised code change does not exist.");
    const eventPath = `wiki/decisions/supervised-code-changes/events/${this.slugify(input.id)}-discarded.md`;
    const content = ["# Supervised Code Change Discarded", "", `- Supervised change ID: ${input.id}`, `- Change fingerprint: ${supervised.changeFingerprint}`, `- Discarded: ${input.discardedAt}`, ""].join("\n");
    if (!await this.writeExclusivePage(eventPath, content)) return { ...supervised, status: "discarded", discardedAt: (await this.readOptionalPage(eventPath)) ? this.extractMetadata((await this.readOptionalPage(eventPath))!, "Discarded") ?? undefined : undefined };
    await this.appendLog({ eventType: "decision", title: "Supervised code change discarded", summary: input.id, details: { changeFingerprint: supervised.changeFingerprint } });
    return { ...supervised, status: "discarded", discardedAt: input.discardedAt };
  }

  async grantControlBundleApproval(input: GrantControlBundleApprovalInput): Promise<ControlBundleApproval> {
    const proposal = await this.getControlBundleProposal(input.proposalId);
    if (!proposal) throw new Error("Control Bundle proposal does not exist.");
    if (proposal.status === "evidence-stale") throw new Error("Control Bundle proposal evidence is stale or no longer eligible.");
    if (proposal.status === "canary-planned" || proposal.status === "canary-rolled-back") throw new Error("Control Bundle proposal has already entered its canary lifecycle.");
    const now = new Date(); const expiresAt = new Date(input.expiresAt); const note = input.note.trim().replace(/\s+/g, " ");
    if (!note || Number.isNaN(expiresAt.getTime()) || expiresAt <= now) throw new Error("Approval expiry must be in the future and include a note.");
    const canonical = { proposalId: proposal.id, proposalFingerprint: proposal.fingerprint, bundleFingerprint: proposal.bundleFingerprint, scope: input.scope, expiresAt: input.expiresAt, note };
    const id = `approval-${this.fingerprint(canonical).slice(0, 16)}`;
    const grantedAt = now.toISOString(); const path = `wiki/decisions/control-bundles/approvals/${id}.md`;
    const content = [`# Control Bundle Approval`, "", `- Approval ID: ${id}`, `- Proposal ID: ${proposal.id}`, `- Proposal fingerprint: ${proposal.fingerprint}`, `- Bundle fingerprint: ${proposal.bundleFingerprint}`, `- Scope: ${input.scope}`, `- Granted: ${grantedAt}`, `- Expires: ${input.expiresAt}`, `- Note: ${note}`, "", "This approval authorizes only a future canary planning/assignment step; it does not change runtime by itself.", ""].join("\n");
    const created = await this.writeExclusivePage(path, content);
    if (!created) {
      const existing = await this.getControlBundleApprovalByPath(path);
      if (existing && existing.proposalFingerprint === proposal.fingerprint) return existing;
      throw new Error("Control Bundle approval conflicts with an existing durable record.");
    }
    await this.upsertWikiIndexEntry(path, content);
    await this.appendLog({ eventType: "decision", title: "Control Bundle approval recorded", summary: proposal.id, details: { proposalFingerprint: proposal.fingerprint, approvalId: id } });
    return { id, proposalId: proposal.id, proposalFingerprint: proposal.fingerprint, bundleFingerprint: proposal.bundleFingerprint, scope: input.scope, status: "active", grantedAt, expiresAt: input.expiresAt, note, path };
  }

  async listControlBundleApprovals(proposalId?: string): Promise<ControlBundleApproval[]> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles", "approvals");
    try {
      const names = (await readdir(dir)).filter((name) => /^approval-.+\.md$/.test(name)).sort();
      const approvals = await Promise.all(names.map((name) => this.getControlBundleApprovalByPath(`wiki/decisions/control-bundles/approvals/${name}`)));
      return approvals
        .filter((approval): approval is ControlBundleApproval => approval !== null)
        .filter((approval) => !proposalId || approval.proposalId === proposalId)
        .sort((left, right) => right.grantedAt.localeCompare(left.grantedAt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  async verifyControlBundleApproval(proposalId: string, options: { skipProposalLookup?: boolean; expectedProposalFingerprint?: string; expectedBundleFingerprint?: string } = {}): Promise<{ approved: boolean; approval?: ControlBundleApproval }> {
    const proposal = options.skipProposalLookup ? undefined : await this.getControlBundleProposal(proposalId);
    if (proposal?.status === "evidence-stale") return { approved: false };
    const fingerprint = options.expectedProposalFingerprint ?? proposal?.fingerprint;
    const bundleFingerprint = options.expectedBundleFingerprint ?? proposal?.bundleFingerprint;
    if (!fingerprint) return { approved: false };
    const approvals = await this.listControlBundleApprovals(proposalId);
    const approval = approvals.find((candidate) => candidate.proposalFingerprint === fingerprint && candidate.bundleFingerprint === bundleFingerprint && candidate.status === "active");
    return approval ? { approved: true, approval } : { approved: false };
  }

  async compareLearningShadowExperiment(experimentId: string): Promise<LearningShadowComparison> {
    const observationPath = `wiki/decisions/learning/experiments/${this.slugify(experimentId)}-observations.md`;
    let content = "";
    try { content = (await this.readPage(observationPath)).content; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const quality = { better: 0, same: 0, worse: 0 };
    for (const value of content.matchAll(/^- Quality:\s*(better|same|worse)\s*$/gm)) quality[value[1] as keyof typeof quality] += 1;
    const observations = quality.better + quality.same + quality.worse;
    const verdict = observations === 0 ? "insufficient-evidence" : quality.better > quality.worse ? "improving" : quality.worse > quality.better ? "regressing" : "neutral";
    const minimumObservations = 3;
    const reasons = [
      ...(observations < minimumObservations ? [`Requires at least ${minimumObservations} observations.`] : []),
      ...(quality.worse > 0 ? ["Contains one or more observed regressions."] : []),
      ...(quality.better <= quality.same ? ["Does not show a strict quality improvement over neutral observations."] : []),
    ];
    return { experimentId, observations, quality, verdict, safety: "observation-only", eligibility: { eligibleForProposal: reasons.length === 0, reasons, minimumObservations } };
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
    ].filter((filePath) => !this.isLocalGeneratedDeliverablePath(filePath));
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
      .filter((filePath) => path.basename(filePath) !== "index.md")
      .filter((filePath) => !this.isLocalGeneratedDeliverablePath(filePath));
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

  private fingerprint(value: unknown): string {
    return createHash("sha256").update(typeof value === "string" ? value : JSON.stringify(value)).digest("hex");
  }

  private evaluationReceiptMetadata(prefix: "Baseline" | "Shadow", receipt: EvaluationLedgerReceiptReference): string[] {
    return [
      `- ${prefix} run ID: ${receipt.runId}`,
      `- ${prefix} evaluation ID: ${receipt.evaluationId}`,
      `- ${prefix} fingerprint: ${receipt.fingerprint}`,
      `- ${prefix} terminal status: ${receipt.terminalStatus}`,
      `- ${prefix} outcome: ${receipt.outcome}`,
      `- ${prefix} validation passed: ${receipt.validationPassed}`,
      `- ${prefix} needs human: ${receipt.needsHuman}`,
      `- ${prefix} model profile: ${receipt.modelProfile}`,
      `- ${prefix} configuration fingerprint: ${receipt.configurationFingerprint}`,
      `- ${prefix} agent role: ${receipt.agentRole ?? ""}`,
      `- ${prefix} logical step ID: ${receipt.logicalStepId ?? ""}`,
      `- ${prefix} Context Receipt hash: ${receipt.contextReceiptHash}`,
      `- ${prefix} duration ms: ${receipt.durationMs}`,
      `- ${prefix} recorded: ${receipt.recordedAt}`,
    ];
  }

  private readEvaluationReceiptMetadata(content: string, prefix: "Baseline" | "Shadow"): EvaluationLedgerReceiptReference | null {
    const runId = this.extractMetadata(content, `${prefix} run ID`);
    const evaluationId = this.extractMetadata(content, `${prefix} evaluation ID`);
    const fingerprint = this.extractMetadata(content, `${prefix} fingerprint`);
    const terminalStatus = this.extractMetadata(content, `${prefix} terminal status`);
    const outcome = this.extractMetadata(content, `${prefix} outcome`);
    const validationPassed = this.extractMetadata(content, `${prefix} validation passed`);
    const needsHuman = this.extractMetadata(content, `${prefix} needs human`);
    const modelProfile = this.extractMetadata(content, `${prefix} model profile`);
    const configurationFingerprint = this.extractMetadata(content, `${prefix} configuration fingerprint`);
    const agentRole = this.extractMetadata(content, `${prefix} agent role`);
    const logicalStepId = this.extractMetadata(content, `${prefix} logical step ID`);
    const contextReceiptHash = this.extractMetadata(content, `${prefix} Context Receipt hash`);
    const durationMs = Number(this.extractMetadata(content, `${prefix} duration ms`));
    const recordedAt = this.extractMetadata(content, `${prefix} recorded`);
    if (!runId || !evaluationId || !/^[a-f0-9]{64}$/.test(fingerprint ?? "") || !/^[a-f0-9]{64}$/.test(configurationFingerprint ?? "") || terminalStatus !== "completed" || !["passed", "needs-human", "failed", "cancelled"].includes(outcome ?? "") || !["true", "false"].includes(validationPassed ?? "") || !["true", "false"].includes(needsHuman ?? "") || !["cheap", "standard", "deep"].includes(modelProfile ?? "") || !agentRole || !logicalStepId || !contextReceiptHash || !Number.isFinite(durationMs) || durationMs < 0 || !recordedAt) return null;
    return {
      runId,
      evaluationId,
      fingerprint: fingerprint!,
      terminalStatus,
      outcome: outcome as EvaluationLedgerReceiptReference["outcome"],
      validationPassed: validationPassed === "true",
      needsHuman: needsHuman === "true",
      modelProfile: modelProfile as EvaluationLedgerReceiptReference["modelProfile"],
      configurationFingerprint: configurationFingerprint!,
      agentRole,
      logicalStepId,
      contextReceiptHash,
      durationMs,
      recordedAt,
    };
  }

  private evaluationPairVerdict(baseline: EvaluationLedgerReceiptReference, shadow: EvaluationLedgerReceiptReference): EvaluationLedgerEvidencePair["verdict"] {
    const shadowPassed = shadow.outcome === "passed" && shadow.validationPassed && !shadow.needsHuman;
    const baselinePassed = baseline.outcome === "passed" && baseline.validationPassed && !baseline.needsHuman;
    if (shadowPassed && !baselinePassed) return "improving";
    if (!shadowPassed && baselinePassed) return "regressing";
    if (!shadowPassed) return "neutral";
    if (shadow.durationMs <= baseline.durationMs * 0.9) return "improving";
    if (shadow.durationMs >= baseline.durationMs * 1.1) return "regressing";
    return "neutral";
  }

  private freezeControlBundle(bundle: ControlBundle): Pick<ControlBundle, "modelProfiles" | "limits" | "allowedTools"> {
    return {
      modelProfiles: { cheap: bundle.modelProfiles.cheap, standard: bundle.modelProfiles.standard, deep: bundle.modelProfiles.deep },
      limits: { ...bundle.limits },
      allowedTools: [...new Set(bundle.allowedTools)].sort(),
    };
  }

  private canarySelectionBucket(canaryFingerprint: string, runId: string): number {
    return Number.parseInt(this.fingerprint(`${canaryFingerprint}:${runId}`).slice(0, 8), 16) % 100;
  }

  private canaryBudgetLimitReason(bundle: Pick<ControlBundle, "limits" | "allowedTools">): string | undefined {
    if (bundle.limits.executionTimeoutMs > 240_000) return "Canary timeout exceeds the 240000ms local safety ceiling.";
    if (bundle.limits.maxRetries > 3) return "Canary retries exceed the local safety ceiling of 3.";
    if (bundle.limits.contextBytes > 64_000) return "Canary context budget exceeds the 64000-byte safety ceiling.";
    if (bundle.allowedTools.some((tool) => !/^(wiki\.(query|lint)|workspace\.(read|search)|runs\.read)$/.test(tool))) return "Canary contains a tool outside the bounded read-only catalog.";
    return undefined;
  }

  private async listSupervisedCodeVerificationReceipts(supervisedChangeId: string): Promise<SupervisedCodeVerificationReceipt[]> {
    const dir = path.join(this.wikiRoot, "decisions", "supervised-code-changes", "events");
    try {
      const names = (await readdir(dir))
        .filter((name) => name.startsWith(`${this.slugify(supervisedChangeId)}-verification-`) && name.endsWith(".md"))
        .sort();
      return (await Promise.all(names.map((name) => this.getSupervisedCodeVerificationReceipt(`wiki/decisions/supervised-code-changes/events/${name}`))))
        .filter((receipt): receipt is SupervisedCodeVerificationReceipt => Boolean(receipt));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }

  private async getSupervisedCodeVerificationReceipt(relativePath: string): Promise<SupervisedCodeVerificationReceipt | null> {
    const content = await this.readOptionalPage(relativePath);
    if (!content) return null;
    const check = this.extractMetadata(content, "Check");
    const command = this.extractMetadata(content, "Command");
    const status = this.extractMetadata(content, "Status");
    const exitCodeText = this.extractMetadata(content, "Exit code");
    const durationMs = Number(this.extractMetadata(content, "Duration ms"));
    const termination = this.extractMetadata(content, "Termination") ?? "completed";
    const stdoutPath = this.extractMetadata(content, "Stdout path");
    const stderrPath = this.extractMetadata(content, "Stderr path");
    const idempotencyKey = this.extractMetadata(content, "Effect idempotency key");
    const fingerprint = this.extractMetadata(content, "Effect fingerprint");
    const recordedAt = this.extractMetadata(content, "Recorded");
    const exitCode = exitCodeText === "null" ? null : Number(exitCodeText);
    if (!check || !["api-typecheck", "web-typecheck", "api-tests", "web-tests"].includes(check) || !command || !["passed", "failed"].includes(status ?? "") || !["completed", "timed-out", "cancelled"].includes(termination) || !Number.isFinite(exitCode) && exitCode !== null || !Number.isFinite(durationMs) || durationMs < 0 || !stdoutPath || !stderrPath || !idempotencyKey || !/^[a-f0-9]{64}$/.test(fingerprint ?? "") || !recordedAt) {
      throw new Error("Supervised code verification provenance is invalid.");
    }
    return { check: check as SupervisedCodeVerificationCheck, command, status: status as SupervisedCodeVerificationReceipt["status"], exitCode, durationMs, termination: termination as NonNullable<SupervisedCodeVerificationReceipt["termination"]>, stdoutPath, stderrPath, idempotencyKey, fingerprint: fingerprint!, recordedAt };
  }

  private async readOptionalPage(relativePath: string): Promise<string | null> {
    try {
      return (await this.readPage(relativePath)).content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async readControlBundleProposalRecord(proposalId: string): Promise<Omit<ControlBundleProposal, "status"> | null> {
    const path = `wiki/decisions/control-bundles/proposals/${this.slugify(proposalId)}.md`;
    const content = await this.readOptionalPage(path);
    if (!content) return null;
    const experimentId = this.extractMetadata(content, "Experiment ID");
    const bundleId = this.extractMetadata(content, "Bundle ID");
    const bundleFingerprint = this.extractMetadata(content, "Bundle fingerprint");
    const evidenceDigest = this.extractMetadata(content, "Evidence digest");
    const fingerprint = this.extractMetadata(content, "Fingerprint");
    const createdAt = this.extractMetadata(content, "Created");
    const rationale = content.match(/## Rationale\n\n([\s\S]*?)\n\n## Boundary/)?.[1]?.trim();
    if (!experimentId || !bundleId || !bundleFingerprint || !fingerprint || !createdAt || !rationale) throw new Error("Control Bundle proposal provenance is invalid.");
    const bundle = await this.getControlBundle(bundleId);
    if (!bundle || bundle.fingerprint !== bundleFingerprint) throw new Error("Control Bundle proposal references an unverified bundle.");
    const legacyCanonical = { experimentId, bundleId, bundleFingerprint, rationale };
    const canonical = evidenceDigest
      ? { experimentId, bundleId, bundleFingerprint, evidenceDigest, rationale }
      : legacyCanonical;
    if (this.fingerprint(canonical) !== fingerprint) throw new Error("Control Bundle proposal fingerprint is invalid.");
    return { id: proposalId, experimentId, bundleId, bundleFingerprint, evidenceDigest: evidenceDigest ?? "legacy-unpaired-evidence", fingerprint, rationale, createdAt, path };
  }

  private async readControlBundleCanaryRecord(canaryId: string): Promise<ControlBundleCanary | null> {
    const path = `wiki/decisions/control-bundles/canaries/${this.slugify(canaryId)}.md`;
    const content = await this.readOptionalPage(path);
    if (!content) return null;
    const proposalId = this.extractMetadata(content, "Proposal ID");
    const proposalFingerprint = this.extractMetadata(content, "Proposal fingerprint");
    const bundleId = this.extractMetadata(content, "Bundle ID");
    const bundleFingerprint = this.extractMetadata(content, "Bundle fingerprint");
    const approvalId = this.extractMetadata(content, "Approval ID");
    const fingerprint = this.extractMetadata(content, "Fingerprint");
    const samplePercent = Number(this.extractMetadata(content, "Sample percent"));
    const createdAt = this.extractMetadata(content, "Created");
    const json = content.match(/## Frozen runtime bundle\n\n```json\n([\s\S]*?)\n```/)?.[1];
    if (!proposalId || !proposalFingerprint || !bundleId || !bundleFingerprint || !approvalId || !fingerprint || !Number.isInteger(samplePercent) || !createdAt || !json) throw new Error("Canary provenance is invalid.");
    const frozenBundle = JSON.parse(json) as Pick<ControlBundle, "modelProfiles" | "limits" | "allowedTools">;
    if (!frozenBundle.modelProfiles || !frozenBundle.limits || !Array.isArray(frozenBundle.allowedTools)) throw new Error("Canary frozen bundle is invalid.");
    const canonical = { proposalId, proposalFingerprint, bundleId, bundleFingerprint, approvalId, samplePercent, frozenBundle: this.freezeControlBundle({ id: bundleId, version: 1, status: "draft", fingerprint: bundleFingerprint, createdAt, path: "", ...frozenBundle }) };
    if (this.fingerprint(canonical) !== fingerprint || `canary-${fingerprint.slice(0, 16)}` !== canaryId) throw new Error("Canary fingerprint is invalid.");
    const rollback = await this.readOptionalPage(`wiki/decisions/control-bundles/canaries/events/${this.slugify(canaryId)}.md`);
    const rollbackReason = rollback ? this.extractMetadata(rollback, "Reason") ?? undefined : undefined;
    return { id: canaryId, proposalId, proposalFingerprint, bundleId, bundleFingerprint, approvalId, fingerprint, frozenBundle: canonical.frozenBundle, samplePercent, status: rollback ? "rolled-back" : "planned", ...(rollbackReason ? { rollbackReason } : {}), createdAt, path };
  }

  private async getExecutionBudgetReceiptByPath(relativePath: string): Promise<ExecutionBudgetReceipt | null> {
    const content = await this.readOptionalPage(relativePath);
    if (!content) return null;
    const id = this.extractMetadata(content, "Budget receipt ID");
    const canaryId = this.extractMetadata(content, "Canary ID");
    const canaryFingerprint = this.extractMetadata(content, "Canary fingerprint");
    const proposalFingerprint = this.extractMetadata(content, "Proposal fingerprint");
    const bundleId = this.extractMetadata(content, "Bundle ID");
    const bundleFingerprint = this.extractMetadata(content, "Bundle fingerprint");
    const runId = this.extractMetadata(content, "Run ID");
    const selectionBucket = Number(this.extractMetadata(content, "Selection bucket"));
    const assignmentFingerprint = this.extractMetadata(content, "Assignment fingerprint");
    const status = this.extractMetadata(content, "Status");
    const reason = this.extractMetadata(content, "Reason") ?? undefined;
    const createdAt = this.extractMetadata(content, "Created");
    const json = content.match(/## Frozen runtime bundle\n\n```json\n([\s\S]*?)\n```/)?.[1];
    if (!id || !canaryId || !/^[a-f0-9]{64}$/.test(canaryFingerprint ?? "") || !/^[a-f0-9]{64}$/.test(proposalFingerprint ?? "") || !bundleId || !/^[a-f0-9]{64}$/.test(bundleFingerprint ?? "") || !runId || !Number.isInteger(selectionBucket) || selectionBucket < 0 || selectionBucket > 99 || !/^[a-f0-9]{64}$/.test(assignmentFingerprint ?? "") || !["reserved", "blocked"].includes(status ?? "") || !createdAt || !json) throw new Error("Execution budget receipt provenance is invalid.");
    const frozenBundle = JSON.parse(json) as Pick<ControlBundle, "modelProfiles" | "limits" | "allowedTools">;
    if (!frozenBundle.modelProfiles || !frozenBundle.limits || !Array.isArray(frozenBundle.allowedTools)) throw new Error("Execution budget receipt frozen bundle is invalid.");
    const normalized = this.freezeControlBundle({ id: bundleId, version: 1, status: "draft", fingerprint: bundleFingerprint!, createdAt, path: "", ...frozenBundle });
    const expectedAssignment = this.fingerprint({ canaryId, canaryFingerprint, runId, selectionBucket, frozenBundle: normalized });
    if (id !== `budget-${assignmentFingerprint!.slice(0, 16)}` || assignmentFingerprint !== expectedAssignment) throw new Error("Execution budget receipt fingerprint is invalid.");
    return { id, canaryId, canaryFingerprint: canaryFingerprint!, proposalFingerprint: proposalFingerprint!, bundleId, bundleFingerprint: bundleFingerprint!, runId, selectionBucket, assignmentFingerprint, modelProfiles: normalized.modelProfiles, limits: normalized.limits, allowedTools: normalized.allowedTools, status: status as ExecutionBudgetReceipt["status"], ...(reason ? { reason } : {}), createdAt, path: relativePath };
  }

  private async findControlBundleCanaryForProposal(proposalId: string): Promise<ControlBundleCanary | null> {
    const dir = path.join(this.wikiRoot, "decisions", "control-bundles", "canaries");
    try {
      const names = (await readdir(dir)).filter((name) => /^canary-.+\.md$/.test(name)).sort();
      for (const name of names) {
        const canary = await this.readControlBundleCanaryRecord(name.slice(0, -3));
        if (canary?.proposalId === proposalId) return canary;
      }
      return null;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  private async getControlBundleApprovalByPath(relativePath: string): Promise<ControlBundleApproval | null> {
    const content = await this.readOptionalPage(relativePath);
    if (!content) return null;
    const id = this.extractMetadata(content, "Approval ID");
    const proposalId = this.extractMetadata(content, "Proposal ID");
    const proposalFingerprint = this.extractMetadata(content, "Proposal fingerprint");
    const bundleFingerprint = this.extractMetadata(content, "Bundle fingerprint");
    const scope = this.extractMetadata(content, "Scope");
    const grantedAt = this.extractMetadata(content, "Granted");
    const expiresAt = this.extractMetadata(content, "Expires");
    const note = this.extractMetadata(content, "Note");
    if (!id || !proposalId || !proposalFingerprint || !bundleFingerprint || scope !== "control-bundle-canary" || !grantedAt || !expiresAt || !note) throw new Error("Control Bundle approval provenance is invalid.");
    return { id, proposalId, proposalFingerprint, bundleFingerprint, scope, status: new Date(expiresAt) > new Date() ? "active" : "expired", grantedAt, expiresAt, note, path: relativePath };
  }

  private async getReversibleWorkspaceApprovalByPath(relativePath: string): Promise<ReversibleWorkspaceApproval | null> {
    const content = await this.readOptionalPage(relativePath);
    if (!content) return null;
    const id = this.extractMetadata(content, "Approval ID");
    const changeId = this.extractMetadata(content, "Change ID");
    const changeFingerprint = this.extractMetadata(content, "Change fingerprint");
    const grantedAt = this.extractMetadata(content, "Granted");
    const expiresAt = this.extractMetadata(content, "Expires");
    const note = this.extractMetadata(content, "Note");
    if (!id || !changeId || !changeFingerprint || !grantedAt || !expiresAt || !note) throw new Error("Workspace approval provenance is invalid.");
    return { id, changeId, changeFingerprint, status: new Date(expiresAt) > new Date() ? "active" : "expired", grantedAt, expiresAt, note, path: relativePath };
  }

  private async getCodeChangeVerificationByPath(relativePath: string): Promise<CodeChangeVerification | null> {
    const content = await this.readOptionalPage(relativePath);
    if (!content) return null;
    const changeId = this.extractMetadata(content, "Change ID");
    const changeFingerprint = this.extractMetadata(content, "Change fingerprint");
    const commandLabel = this.extractMetadata(content, "Check");
    const passed = this.extractMetadata(content, "Passed");
    const verifiedAt = this.extractMetadata(content, "Verified");
    const summary = this.extractMetadata(content, "Summary");
    if (!changeId || !changeFingerprint || !commandLabel || !verifiedAt || !summary || !["api-typecheck", "web-typecheck", "focused-tests"].includes(commandLabel)) throw new Error("Code verification provenance is invalid.");
    return { changeId, changeFingerprint, commandLabel: commandLabel as CodeChangeVerification["commandLabel"], passed: passed === "true", summary, verifiedAt, path: relativePath };
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

  private isLocalGeneratedDeliverablePath(filePath: string): boolean {
    const relativePath = this.toRelativeAtelierPath(filePath);
    return this.isDeliverableMarkdownPath(relativePath) && this.isGeneratedDeliverableFileName(path.basename(relativePath));
  }

  private isGeneratedDeliverableFileName(fileName: string): boolean {
    return /^(?:[0-9a-f]{24}|[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})-/i.test(fileName);
  }

  private async refreshDeliverablesIndex(): Promise<void> {
    const deliverablesDir = path.join(this.wikiRoot, "deliverables");
    await mkdir(deliverablesDir, { recursive: true });
    const fileNames = await readdir(deliverablesDir);
    const markdownFiles = fileNames
      .filter((fileName) => fileName.endsWith(".md") && fileName !== "index.md")
      .filter((fileName) => !this.isGeneratedDeliverableFileName(fileName))
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
      "# Curated Deliverables Index",
      "",
      "This index contains only deliberately curated deliverables. Run-generated ObjectId/UUID deliverables remain local operational evidence and are available from their run, but are excluded from durable wiki memory and default retrieval.",
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

  private learningCandidateDecisionPath(candidateId: string, evidenceDigest: string): string {
    return `wiki/decisions/learning/${this.slugify(candidateId).slice(0, 48)}-${evidenceDigest.slice(0, 16)}.md`;
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

function isControlBundleConfiguration(value: unknown): value is Pick<ControlBundle, "modelProfiles" | "limits" | "allowedTools"> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const candidate = value as Record<string, unknown>;
  const profiles = candidate.modelProfiles;
  const limits = candidate.limits;
  return Boolean(
    profiles && typeof profiles === "object" && !Array.isArray(profiles)
    && ["cheap", "standard", "deep"].every((key) => typeof (profiles as Record<string, unknown>)[key] === "string" && String((profiles as Record<string, unknown>)[key]).trim().length > 0)
    && limits && typeof limits === "object" && !Array.isArray(limits)
    && ["executionTimeoutMs", "maxRetries", "contextBytes"].every((key) => Number.isInteger((limits as Record<string, unknown>)[key]) && Number((limits as Record<string, unknown>)[key]) > 0)
    && Array.isArray(candidate.allowedTools)
    && candidate.allowedTools.every((tool) => typeof tool === "string" && tool.trim().length > 0),
  );
}
