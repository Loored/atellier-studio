import type {
  InvokeToolInput,
  AgentToolRequest,
  ToolDefinition,
  ToolHarnessCatalogResponse,
  ToolInvocation,
  ToolInvocationResponse,
  ToolPolicyDecision,
  ToolPolicyRequest,
} from "@atellier/shared";
import { createHash, randomUUID } from "node:crypto";
import { lstat, readdir, readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import type { BuildOrchestrationOutput, Run } from "@atellier/shared";
import { RunService } from "./run.service";
import { WikiService } from "./wiki.service";

const WORKSPACE_SAFE_ROOTS = ["apps", "packages", "docs", "atelier", "scripts"] as const;
const WORKSPACE_SAFE_FILES = ["README.md", "AGENTS.md", "CODEX_MEMORY.md", "package.json", "pnpm-workspace.yaml"] as const;
const MAX_WORKSPACE_READ_BYTES = 64 * 1024;
const MAX_WORKSPACE_SEARCH_FILE_BYTES = 128 * 1024;
const MAX_WORKSPACE_SEARCH_FILES = 1_000;

const BUILT_IN_TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: "wiki.query",
    label: "Query wiki memory",
    description: "Retrieves scoped operational memory without modifying the vault.",
    classification: "read",
    autonomy: "automatic",
    executionState: "available",
    allowedRoles: ["intake", "wiki-curator", "pm", "builder", "qa", "designer"],
    inputSummary: "A bounded query, retrieval policy, and optional source filter.",
    evidenceSummary: "Returned page paths and retrieval policy are recorded with the caller run.",
  },
  {
    name: "wiki.lint",
    label: "Lint wiki memory",
    description: "Checks durable memory for broken references and structural issues.",
    classification: "read",
    autonomy: "automatic",
    executionState: "available",
    allowedRoles: ["wiki-curator", "qa"],
    inputSummary: "No free-form command input.",
    evidenceSummary: "Lint findings and checked paths are recorded with the caller run.",
  },
  {
    name: "workspace.search",
    label: "Search workspace",
    description: "Searches verified repository and Atellier workspace paths under a bounded query.",
    classification: "read",
    autonomy: "automatic",
    executionState: "available",
    allowedRoles: ["pm", "builder", "qa", "designer"],
    inputSummary: "Search text and a bounded result limit; server-owned safe roots only.",
    evidenceSummary: "Matched paths, line numbers, and the server-owned scope are recorded with the caller run.",
  },
  {
    name: "workspace.read",
    label: "Read workspace file",
    description: "Reads a verified local file with a path boundary and byte limit.",
    classification: "read",
    autonomy: "automatic",
    executionState: "available",
    allowedRoles: ["wiki-curator", "pm", "builder", "qa", "designer"],
    inputSummary: "A server-scoped relative path and optional bounded line range.",
    evidenceSummary: "Resolved path, line range, and content digest are recorded with the caller run.",
  },
  {
    name: "runs.read",
    label: "Read run evidence",
    description: "Reads a local Atellier run and its durable execution evidence.",
    classification: "read",
    autonomy: "automatic",
    executionState: "available",
    allowedRoles: ["intake", "wiki-curator", "pm", "builder", "qa", "designer"],
    inputSummary: "One runId or one or two runIds; returns bounded current operational evidence.",
    evidenceSummary: "Read run identifiers are recorded with the caller run.",
  },
];

export class ToolHarnessService {
  constructor(
    private readonly wiki: WikiService,
    private readonly runs: RunService,
    private readonly definitions: readonly ToolDefinition[] = BUILT_IN_TOOL_DEFINITIONS,
    private readonly now: () => Date = () => new Date(),
    private readonly workspaceRoot = process.cwd(),
  ) {}

  listCatalog(): ToolHarnessCatalogResponse {
    return {
      generatedAt: this.now().toISOString(),
      phase: "catalog-and-policy",
      definitions: this.definitions.map((definition) => ({
        ...definition,
        allowedRoles: [...definition.allowedRoles],
      })),
      safetySummary:
        "Only registered capabilities can be considered. All five current adapters are read-only, bounded, and write durable run receipts. Workspace access is restricted to server-owned safe paths and never accepts model-defined roots.",
    };
  }

  evaluatePolicy(input: ToolPolicyRequest): ToolPolicyDecision {
    const definition = this.definitions.find((candidate) => candidate.name === input.toolName);
    if (!definition) {
      return denied(input, "tool-unregistered", "Only explicitly registered capabilities are available to the harness.");
    }
    if (!definition.allowedRoles.includes(input.agentRole)) {
      return denied(
        input,
        "role-not-authorized",
        `${input.agentRole} is not allowed to use ${definition.name}.`,
        definition.classification,
      );
    }
    if (definition.executionState !== "available") {
      return denied(
        input,
        "tool-not-executable",
        `${definition.name} is catalogued but its bounded adapter is not available yet.`,
        definition.classification,
      );
    }
    if (definition.autonomy === "human-only") {
      return denied(
        input,
        "human-only-tool",
        `${definition.name} is reserved for a human operator.`,
        definition.classification,
      );
    }
    if (definition.autonomy === "approval-required") {
      if (hasActiveApproval(input, this.now())) {
        return {
          action: "allow",
          reasonCode: "approval-granted",
          reason: `A valid human approval grant exists for ${definition.name}.`,
          toolName: definition.name,
          agentRole: input.agentRole,
          classification: definition.classification,
          evidenceRequired: true,
        };
      }
      return {
        action: "require-approval",
        reasonCode: "approval-required",
        reason: `${definition.name} needs an explicit human approval grant before execution.`,
        toolName: definition.name,
        agentRole: input.agentRole,
        classification: definition.classification,
        evidenceRequired: true,
      };
    }
    return {
      action: "allow",
      reasonCode: "read-only-allowed",
      reason: `${definition.name} is an allowed read-only capability for ${input.agentRole}.`,
      toolName: definition.name,
      agentRole: input.agentRole,
      classification: definition.classification,
      evidenceRequired: true,
    };
  }

  async invoke(input: InvokeToolInput, options?: { allowedTools?: readonly string[] }): Promise<ToolInvocationResponse> {
    const parentRun = await this.runs.getById(input.parentRunId);
    if (!parentRun) {
      throw new ToolHarnessParentRunNotFoundError(input.parentRunId);
    }

    const definition = this.definitions.find((candidate) => candidate.name === input.toolName);
    const policy = options?.allowedTools && !options.allowedTools.includes(input.toolName)
      ? denied(input, "budget-tool-denied", `${input.toolName} is not allowed by the bound execution budget.`, definition?.classification)
      : this.evaluatePolicy(input);
    const requestedAt = this.now().toISOString();
    const inputDigest = digest(input.input);
    if (policy.action !== "allow") {
      const invocation = await this.persistInvocation(parentRun, {
        id: randomUUID(),
        parentRunId: parentRun.id,
        toolName: input.toolName,
        agentRole: input.agentRole,
        classification: definition?.classification,
        status: "denied",
        policy,
        inputDigest,
        outputSummary: policy.reason,
        evidencePaths: [],
        requestedAt,
        completedAt: this.now().toISOString(),
      });
      return { invocation };
    }

    try {
      const execution = await this.executeReadOnlyTool(input, parentRun);
      const invocation = await this.persistInvocation(parentRun, {
        id: randomUUID(),
        parentRunId: parentRun.id,
        toolName: input.toolName,
        agentRole: input.agentRole,
        classification: definition!.classification,
        status: "succeeded",
        policy,
        inputDigest,
        outputSummary: execution.summary,
        evidencePaths: execution.evidencePaths,
        requestedAt,
        completedAt: this.now().toISOString(),
      });
      return { invocation, result: execution.result };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool invocation failed.";
      const invocation = await this.persistInvocation(parentRun, {
        id: randomUUID(),
        parentRunId: parentRun.id,
        toolName: input.toolName,
        agentRole: input.agentRole,
        classification: definition?.classification,
        status: "failed",
        policy,
        inputDigest,
        outputSummary: message,
        evidencePaths: [],
        requestedAt,
        completedAt: this.now().toISOString(),
      });
      return { invocation };
    }
  }

  private async executeReadOnlyTool(input: InvokeToolInput, _parentRun: Run): Promise<{
    result: unknown;
    summary: string;
    evidencePaths: string[];
  }> {
    if (input.toolName === "wiki.query") {
      const query = requiredString(input.input, "query", 500);
      const limit = boundedInteger(input.input.limit, 5, 1, 10);
      const retrievalPolicy = optionalOneOf(input.input.retrievalPolicy, ["balanced", "evidence-first", "trusted-only"] as const);
      const result = await this.wiki.query({ query, limit, retrievalPolicy });
      const evidencePaths = uniquePaths([
        ...result.matches.map((match) => match.path),
        ...result.relatedPages.map((page) => page.path),
      ]);
      return {
        result,
        summary: `Wiki query returned ${result.matches.length} matches and ${result.relatedPages.length} related pages.`,
        evidencePaths,
      };
    }
    if (input.toolName === "wiki.lint") {
      if (Object.keys(input.input).length > 0) throw new ToolHarnessInputError("wiki.lint accepts no input.");
      const result = await this.wiki.lint({ recordLog: false });
      return {
        result,
        summary: result.ok ? "Wiki lint completed without issues." : `Wiki lint found ${result.issues.length} issue(s).`,
        evidencePaths: uniquePaths(result.issues.map((issue) => issue.path)),
      };
    }
    if (input.toolName === "runs.read") {
      assertOnlyInputKeys(input.input, ["runId", "runIds"]);
      const runIds = input.input.runIds;
      if (input.input.runId !== undefined && runIds !== undefined) throw new ToolHarnessInputError("Specify runId or runIds, not both.");
      const ids = Array.isArray(runIds) ? runIds : [requiredString(input.input, "runId", 80)];
      if (ids.length < 1 || ids.length > 2 || ids.some((id) => typeof id !== "string" || id.length < 1 || id.length > 80)
        || new Set(ids).size !== ids.length) throw new ToolHarnessInputError("runs.read accepts one or two distinct run IDs.");
      const runs = await Promise.all(ids.map((id) => this.runs.getById(id as string)));
      if (runs.some((run) => !run)) throw new ToolHarnessInputError("A requested run does not exist.");
      const summaries = await Promise.all(runs.map(async (run) => {
        const parent = run!;
        const output = parent.output as BuildOrchestrationOutput | undefined;
        const buildStep = parent.type === "orchestration" ? output?.steps?.find((step) => step.stepId === "build") : undefined;
        const buildRun = buildStep ? await this.runs.getById(buildStep.runId) : undefined;
        return summarizeRun(parent, buildRun ?? undefined);
      }));
      const result = Array.isArray(runIds) ? summaries : summaries[0];
      return {
        result,
        summary: `Read bounded current evidence for ${ids.join(", ")}.`,
        evidencePaths: runs.flatMap((run) => [run!.deliverablePath, run!.memory?.wikiPath, run!.memory?.logPath]).filter((path): path is string => Boolean(path)),
      };
    }
    if (input.toolName === "workspace.read") {
      assertOnlyInputKeys(input.input, ["path", "startLine", "endLine"]);
      const requestedPath = requiredString(input.input, "path", 240);
      const startLine = boundedInteger(input.input.startLine, 1, 1, 20_000);
      const endLine = boundedInteger(input.input.endLine, Math.min(startLine + 299, 20_000), startLine, Math.min(startLine + 299, 20_000));
      const file = await this.readWorkspaceFile(requestedPath);
      const lines = file.content.split("\n");
      const selectedLines = lines.slice(startLine - 1, endLine);
      const result = {
        path: file.path,
        startLine,
        endLine: Math.min(endLine, lines.length),
        totalLines: lines.length,
        content: selectedLines.join("\n"),
        contentDigest: digestText(file.content),
      };
      return {
        result,
        summary: `Read ${file.path} lines ${result.startLine}-${result.endLine} of ${result.totalLines}.`,
        evidencePaths: [file.path],
      };
    }
    if (input.toolName === "workspace.search") {
      assertOnlyInputKeys(input.input, ["query", "limit"]);
      const query = requiredString(input.input, "query", 200);
      const limit = boundedInteger(input.input.limit, 20, 1, 50);
      const result = await this.searchWorkspace(query, limit);
      return {
        result,
        summary: `Workspace search found ${result.matches.length} match(es) in ${result.scannedFiles} file(s).`,
        evidencePaths: uniquePaths(result.matches.map((match) => match.path)),
      };
    }
    throw new ToolHarnessInputError(`${input.toolName} does not have a read-only adapter.`);
  }

  private async readWorkspaceFile(requestedPath: string): Promise<{ path: string; content: string }> {
    const normalizedPath = normalizeWorkspacePath(requestedPath);
    const root = await realpath(this.workspaceRoot);
    const resolved = path.resolve(root, normalizedPath);
    const rootPrefix = `${root}${path.sep}`;
    if (!resolved.startsWith(rootPrefix) || !isSafeWorkspacePath(normalizedPath)) {
      throw new ToolHarnessInputError("Workspace path is outside the server-owned readable scope.");
    }
    const entry = await lstat(resolved);
    if (!entry.isFile() || entry.isSymbolicLink()) {
      throw new ToolHarnessInputError("Workspace path must be a regular file.");
    }
    const target = await realpath(resolved);
    if (!target.startsWith(rootPrefix)) {
      throw new ToolHarnessInputError("Workspace path resolves outside the readable scope.");
    }
    if (entry.size > MAX_WORKSPACE_READ_BYTES) {
      throw new ToolHarnessInputError(`Workspace file exceeds the ${MAX_WORKSPACE_READ_BYTES} byte read limit.`);
    }
    const content = await readFile(resolved, "utf8");
    if (content.includes("\0")) throw new ToolHarnessInputError("Workspace path is not a text file.");
    return { path: normalizedPath, content };
  }

  private async searchWorkspace(query: string, limit: number): Promise<{
    query: string;
    scope: string[];
    scannedFiles: number;
    matches: Array<{ path: string; line: number; excerpt: string }>;
    truncated: boolean;
  }> {
    const files = await this.listWorkspaceFiles();
    const matches: Array<{ path: string; line: number; excerpt: string }> = [];
    const normalizedQuery = query.toLocaleLowerCase();
    let scannedFiles = 0;
    for (const filePath of files) {
      if (matches.length >= limit) break;
      let content: string;
      try {
        const metadata = await stat(path.join(this.workspaceRoot, filePath));
        if (!metadata.isFile() || metadata.size > MAX_WORKSPACE_SEARCH_FILE_BYTES) continue;
        content = await readFile(path.join(this.workspaceRoot, filePath), "utf8");
      } catch {
        continue;
      }
      if (content.includes("\0")) continue;
      scannedFiles += 1;
      for (const [index, line] of content.split("\n").entries()) {
        if (!line.toLocaleLowerCase().includes(normalizedQuery)) continue;
        matches.push({ path: filePath, line: index + 1, excerpt: line.trim().slice(0, 300) });
        if (matches.length >= limit) break;
      }
    }
    return {
      query,
      scope: [...WORKSPACE_SAFE_ROOTS],
      scannedFiles,
      matches,
      truncated: files.length >= MAX_WORKSPACE_SEARCH_FILES || matches.length >= limit,
    };
  }

  private async listWorkspaceFiles(): Promise<string[]> {
    const files: string[] = [];
    const walk = async (relativeDirectory: string): Promise<void> => {
      if (files.length >= MAX_WORKSPACE_SEARCH_FILES) return;
      const absoluteDirectory = path.join(this.workspaceRoot, relativeDirectory);
      let entries;
      try {
        entries = await readdir(absoluteDirectory, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
        if (files.length >= MAX_WORKSPACE_SEARCH_FILES) return;
        const relativePath = path.posix.join(relativeDirectory, entry.name);
        if (!isSafeWorkspacePath(relativePath)) continue;
        if (entry.isDirectory()) await walk(relativePath);
        else if (entry.isFile() && !entry.isSymbolicLink()) files.push(relativePath);
      }
    };
    for (const root of WORKSPACE_SAFE_ROOTS) await walk(root);
    for (const fileName of WORKSPACE_SAFE_FILES) {
      if (files.length >= MAX_WORKSPACE_SEARCH_FILES) break;
      if (isSafeWorkspacePath(fileName)) files.push(fileName);
    }
    return [...new Set(files)].sort();
  }

  private async persistInvocation(parentRun: Run, invocation: ToolInvocation): Promise<ToolInvocation> {
    const stored = await this.runs.recordToolInvocation(parentRun.id, invocation);
    if (!stored) throw new ToolHarnessParentRunNotFoundError(parentRun.id);
    await this.runs.appendLog(parentRun.id, {
      level: invocation.status === "failed" ? "error" : invocation.status === "denied" ? "warn" : "info",
      message: `Tool ${invocation.toolName} ${invocation.status}: ${invocation.outputSummary}`.slice(0, 1000),
    });
    return invocation;
  }
}

export class ToolHarnessParentRunNotFoundError extends Error {
  override readonly name = "ToolHarnessParentRunNotFoundError";

  constructor(runId: string) {
    super(`Parent run ${runId} does not exist.`);
  }
}

export class ToolHarnessInputError extends Error {
  override readonly name = "ToolHarnessInputError";
}

/**
 * A tool request is accepted only as an entire model response. This avoids
 * treating examples, prose, or prompt-injected fragments as executable input.
 */
export function parseAgentToolRequest(response: string): AgentToolRequest | null {
  const match = response.trim().match(/^TOOL_REQUEST:\s*(\{[\s\S]*\})$/);
  if (!match) return null;
  try {
    const value = JSON.parse(match[1]) as Record<string, unknown>;
    const toolName = typeof value.toolName === "string" ? value.toolName.trim() : "";
    if (!toolName || toolName.length > 100 || !value.input || typeof value.input !== "object" || Array.isArray(value.input)) {
      return null;
    }
    return { toolName, input: value.input as Record<string, unknown> };
  } catch {
    return null;
  }
}

function hasActiveApproval(input: ToolPolicyRequest, now: Date): boolean {
  if (!input.approval || input.approval.grantedBy !== "human" || input.approval.toolName !== input.toolName) {
    return false;
  }
  return !input.approval.expiresAt || new Date(input.approval.expiresAt).getTime() > now.getTime();
}

function denied(
  input: ToolPolicyRequest,
  reasonCode: Extract<ToolPolicyDecision["reasonCode"], "tool-unregistered" | "tool-not-executable" | "role-not-authorized" | "human-only-tool" | "budget-tool-denied">,
  reason: string,
  classification?: ToolPolicyDecision["classification"],
): ToolPolicyDecision {
  return {
    action: "deny",
    reasonCode,
    reason,
    toolName: input.toolName,
    agentRole: input.agentRole,
    classification,
    evidenceRequired: true,
  };
}

function requiredString(input: Record<string, unknown>, key: string, maxLength: number): string {
  const value = input[key];
  if (typeof value !== "string" || !value.trim() || value.trim().length > maxLength) {
    throw new ToolHarnessInputError(`${key} must be a non-empty string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function assertOnlyInputKeys(input: Record<string, unknown>, allowed: string[]): void {
  const unexpected = Object.keys(input).filter((key) => !allowed.includes(key));
  if (unexpected.length > 0) {
    throw new ToolHarnessInputError(`Tool input contains unsupported field(s): ${unexpected.join(", ")}.`);
  }
}

function normalizeWorkspacePath(value: string): string {
  const normalized = value.trim().replace(/\\/g, "/");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") || normalized.split("/").some((segment) => segment === "." || segment === ".." || !segment)) {
    throw new ToolHarnessInputError("Workspace path must be a relative, non-traversing path.");
  }
  return path.posix.normalize(normalized);
}

function isSafeWorkspacePath(relativePath: string): boolean {
  const normalized = relativePath.replace(/\\/g, "/");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment.startsWith(".") || segment === ".env" || segment.startsWith(".env."))) return false;
  if ((WORKSPACE_SAFE_FILES as readonly string[]).includes(normalized)) return true;
  return (WORKSPACE_SAFE_ROOTS as readonly string[]).some((root) => normalized === root || normalized.startsWith(`${root}/`));
}

function boundedInteger(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new ToolHarnessInputError(`limit must be an integer from ${min} to ${max}.`);
  }
  return value;
}

function optionalOneOf<T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new ToolHarnessInputError(`retrievalPolicy must be one of: ${allowed.join(", ")}.`);
  }
  return value as T[number];
}

function uniquePaths(paths: string[]): string[] {
  return [...new Set(paths.filter(Boolean))].slice(0, 20);
}

function digest(value: Record<string, unknown>): string {
  return createHash("sha256").update(JSON.stringify(value, Object.keys(value).sort())).digest("hex");
}

function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function summarizeRun(run: Run, buildRun?: Run) {
  const output = run.output as BuildOrchestrationOutput | undefined;
  const buildOutput = buildRun?.output as { validation?: { passed?: boolean; issues?: { code?: string; message?: string }[] } } | undefined;
  return {
    id: run.id,
    type: run.type,
    status: run.status,
    reviewStatus: run.reviewStatus,
    deliverablePath: run.deliverablePath,
    memoryPaths: [run.memory?.wikiPath, run.memory?.logPath].filter((path): path is string => Boolean(path)),
    logCount: run.logs.length,
    toolInvocationCount: run.toolInvocations?.length ?? 0,
    ...(run.type === "orchestration" && {
      readiness: output?.readiness,
      validationPassed: output?.validation?.passed,
      validationIssues: output?.validation?.issues?.slice(0, 5).map((issue) => ({ code: issue.code, message: issue.message.slice(0, 180) })),
      firstPassBuilderValid: buildOutput?.validation?.passed ?? null,
      deterministicRepairCount: output?.repair?.attemptsUsed ?? 0,
      semanticRepairCount: output?.semanticRepair?.attemptsUsed ?? 0,
      qaChecklistComplete: output?.qaChecklist?.complete ?? null,
      qaPassCount: output?.qaChecklist?.items?.filter((item) => item.status === "pass").length ?? 0,
      qaFailCount: output?.qaChecklist?.items?.filter((item) => item.status === "fail").length ?? 0,
      qaChecklist: output?.qaChecklist?.items?.slice(0, 4).map((item) => ({ criterion: item.criterion.slice(0, 80), status: item.status, evidence: item.evidence.slice(0, 100) })),
    }),
    recentErrors: run.logs.filter((log) => log.level !== "info").slice(-3).map((log) => log.message.slice(0, 180)),
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
