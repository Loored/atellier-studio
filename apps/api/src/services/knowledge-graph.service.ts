import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import * as path from "node:path";
import type {
  Agent,
  KnowledgeFilterPreset,
  KnowledgeFilterPresetCreateInput,
  KnowledgeGraphEdge,
  KnowledgeGraphLayer,
  KnowledgeGraphNode,
  KnowledgeNodeAnnotation,
  KnowledgeNodeAnnotationUpsertInput,
  KnowledgeGraphNodeType,
  KnowledgeGraphQualityState,
  KnowledgeGraphResponse,
  KnowledgeGraphSnapshotDiffResponse,
  RoleMemoryEntry,
  RoleMemoryResponse,
  Run,
  Task,
} from "@atellier/shared";
import {
  AGENT_ROLES,
  KNOWLEDGE_GRAPH_LAYERS,
  KNOWLEDGE_GRAPH_NODE_TYPES,
  KNOWLEDGE_GRAPH_QUALITY_STATES,
} from "@atellier/shared";
import type { AgentService } from "./agent.service";
import type { RunService } from "./run.service";
import type { TaskService } from "./task.service";
import type { WikiService } from "./wiki.service";

const NODE_TYPE_LAYER: Record<KnowledgeGraphNodeType, KnowledgeGraphLayer> = {
  agent: "runtime",
  role: "meta",
  task: "runtime",
  run: "runtime",
  "wiki-page": "wiki",
  deliverable: "wiki",
  "lint-issue": "meta",
  "raw-source": "raw",
  "runtime-log": "runtime",
  "dream-decision": "meta",
};

const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
const RAW_PATH_FIELD = /^- Raw path:\s*(.+)$/m;
const PATH_MENTION = /(?<![\w/])((?:wiki|raw|runs|tasks)\/[\w./-]+\.(?:md|pdf|txt|json|csv|jsonl|yaml|yml))\b/gi;

export type KnowledgeGraphSnapshotMeta = {
  id: string;
  generatedAt: string;
  stats: KnowledgeGraphResponse["stats"];
};

const SNAPSHOT_RING_SIZE = 48;
const SNAPSHOT_MIN_INTERVAL_MS = 60 * 60 * 1000;
const SNAPSHOT_DIR = path.join("_runtime", "graph-snapshots");
const ANNOTATIONS_FILE = path.join("_runtime", "graph-annotations.json");
const FILTER_PRESETS_FILE = path.join("_runtime", "graph-filter-presets.json");

export class KnowledgeGraphService {
  private snapshots: KnowledgeGraphResponse[] = [];
  private readonly snapshotDirAbsolute: string | null;
  private readonly annotationsFileAbsolute: string | null;
  private readonly filterPresetsFileAbsolute: string | null;

  constructor(
    private readonly agents: AgentService,
    private readonly tasks: TaskService,
    private readonly runs: RunService,
    private readonly wiki: WikiService,
    private readonly atelierRoot?: string,
  ) {
    this.snapshotDirAbsolute = atelierRoot
      ? path.resolve(atelierRoot, SNAPSHOT_DIR)
      : null;
    this.annotationsFileAbsolute = atelierRoot
      ? path.resolve(atelierRoot, ANNOTATIONS_FILE)
      : null;
    this.filterPresetsFileAbsolute = atelierRoot
      ? path.resolve(atelierRoot, FILTER_PRESETS_FILE)
      : null;
  }

  async initialize(): Promise<void> {
    await this.loadPersistedSnapshots();
  }

  async listAnnotations(): Promise<KnowledgeNodeAnnotation[]> {
    const all = await this.readAnnotationsMap();
    return Object.values(all).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async upsertAnnotation(input: KnowledgeNodeAnnotationUpsertInput): Promise<KnowledgeNodeAnnotation> {
    const nodeId = input.nodeId.trim();
    if (!nodeId) {
      throw new Error("Annotation nodeId is required.");
    }
    const note = input.note.trim();
    if (!note) {
      throw new Error("Annotation note is required.");
    }
    const tags = (input.tags ?? []).map((tag) => tag.trim().toLowerCase()).filter((tag) => tag.length > 0);
    const updatedAt = new Date().toISOString();
    const next: KnowledgeNodeAnnotation = { nodeId, note, tags: Array.from(new Set(tags)), updatedAt };
    const all = await this.readAnnotationsMap();
    all[nodeId] = next;
    await this.writeJsonFile(this.annotationsFileAbsolute, all);
    return next;
  }

  async listFilterPresets(): Promise<KnowledgeFilterPreset[]> {
    const presets = await this.readFilterPresets();
    return presets.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
  }

  async createFilterPreset(input: KnowledgeFilterPresetCreateInput): Promise<KnowledgeFilterPreset> {
    const name = input.name.trim();
    if (!name) {
      throw new Error("Filter preset name is required.");
    }
    const now = new Date().toISOString();
    const preset: KnowledgeFilterPreset = {
      id: `preset-${now.replace(/[:.]/g, "-")}`,
      name,
      nodeTypeFilter: input.nodeTypeFilter,
      qualityFilter: input.qualityFilter,
      activeLayers: input.activeLayers,
      dreamDecisionFilter: input.dreamDecisionFilter,
      densityMode: input.densityMode,
      createdAt: now,
      updatedAt: now,
    };
    const presets = await this.readFilterPresets();
    presets.push(preset);
    await this.writeJsonFile(this.filterPresetsFileAbsolute, presets);
    return preset;
  }

  listSnapshots(): KnowledgeGraphSnapshotMeta[] {
    return this.snapshots.map((snapshot) => ({
      id: snapshot.generatedAt,
      generatedAt: snapshot.generatedAt,
      stats: snapshot.stats,
    }));
  }

  getSnapshot(id: string): KnowledgeGraphResponse | null {
    return this.snapshots.find((snapshot) => snapshot.generatedAt === id) ?? null;
  }

  buildSnapshotDiff(baseId: string, headId: string): KnowledgeGraphSnapshotDiffResponse | null {
    const base = this.getSnapshot(baseId);
    const head = this.getSnapshot(headId);
    if (!base || !head) return null;

    const baseNodeIds = new Set(base.nodes.map((node) => node.id));
    const headNodeIds = new Set(head.nodes.map((node) => node.id));
    const addedNodeIds = [...headNodeIds].filter((id) => !baseNodeIds.has(id)).sort();
    const removedNodeIds = [...baseNodeIds].filter((id) => !headNodeIds.has(id)).sort();

    const baseEdgeIds = new Set(base.edges.map((edge) => edge.id));
    const headEdgeIds = new Set(head.edges.map((edge) => edge.id));
    const addedEdgeIds = [...headEdgeIds].filter((id) => !baseEdgeIds.has(id)).sort();
    const removedEdgeIds = [...baseEdgeIds].filter((id) => !headEdgeIds.has(id)).sort();

    return {
      generatedAt: new Date().toISOString(),
      baseId,
      headId,
      nodes: {
        added: addedNodeIds.length,
        removed: removedNodeIds.length,
        addedNodeIds: addedNodeIds.slice(0, 25),
        removedNodeIds: removedNodeIds.slice(0, 25),
      },
      edges: {
        added: addedEdgeIds.length,
        removed: removedEdgeIds.length,
        addedEdgeIds: addedEdgeIds.slice(0, 25),
        removedEdgeIds: removedEdgeIds.slice(0, 25),
      },
    };
  }

  private async recordSnapshot(response: KnowledgeGraphResponse): Promise<void> {
    const last = this.snapshots[this.snapshots.length - 1];
    if (last) {
      const lastTime = Date.parse(last.generatedAt);
      if (
        !Number.isNaN(lastTime) &&
        Date.parse(response.generatedAt) - lastTime < SNAPSHOT_MIN_INTERVAL_MS
      ) {
        return;
      }
    }
    this.snapshots.push(response);
    if (this.snapshots.length > SNAPSHOT_RING_SIZE) {
      this.snapshots.shift();
    }
    await this.persistSnapshots();
  }

  private async fileMtime(relativePath: string): Promise<string | undefined> {
    if (!this.atelierRoot) return undefined;
    try {
      const absolute = path.resolve(this.atelierRoot, relativePath);
      const stats = await stat(absolute);
      return stats.mtime.toISOString();
    } catch {
      return undefined;
    }
  }

  async buildGraph(): Promise<KnowledgeGraphResponse> {
    const [agents, tasks, runs, wikiPaths, rawPaths, runtimePaths, lint] = await Promise.all([
      this.agents.list(),
      this.tasks.list(),
      this.runs.list(),
      this.wiki.listWikiMarkdownPaths(),
      this.wiki.listRawAssetPaths(),
      this.wiki.listRuntimeMarkdownPaths(),
      this.wiki.lint(),
    ]);

    const nodes = new Map<string, KnowledgeGraphNode>();
    const edges = new Map<string, KnowledgeGraphEdge>();

    for (const role of AGENT_ROLES) {
      this.addNode(nodes, {
        id: this.roleNodeId(role),
        type: "role",
        layer: NODE_TYPE_LAYER.role,
        label: role,
        role,
        quality: "verified",
      });
    }

    for (const agent of agents) {
      this.addAgent(nodes, agent);
      this.addEdge(edges, {
        id: `edge:${this.agentNodeId(agent.id)}->${this.roleNodeId(agent.role)}:agent_has_role`,
        type: "agent_has_role",
        from: this.agentNodeId(agent.id),
        to: this.roleNodeId(agent.role),
        label: "has role",
        quality: "verified",
      });
    }

    for (const task of tasks) {
      this.addTask(nodes, task);
      if (task.assignedAgentId) {
        const agentNodeId = this.agentNodeId(task.assignedAgentId);
        if (nodes.has(agentNodeId)) {
          this.addEdge(edges, {
            id: `edge:${agentNodeId}->${this.taskNodeId(task.id)}:agent_assigned_task`,
            type: "agent_assigned_task",
            from: agentNodeId,
            to: this.taskNodeId(task.id),
            label: "assigned task",
            quality: "verified",
          });
        }
      }
    }

    for (const run of runs) {
      this.addRun(nodes, run);
      if (run.agentId) {
        const agentNodeId = this.agentNodeId(run.agentId);
        if (nodes.has(agentNodeId)) {
          this.addEdge(edges, {
            id: `edge:${this.runNodeId(run.id)}->${agentNodeId}:run_by_agent`,
            type: "run_by_agent",
            from: this.runNodeId(run.id),
            to: agentNodeId,
            label: "run by agent",
            quality: "verified",
            createdAt: run.createdAt,
          });
        }
      }
      if (run.taskId) {
        const taskNodeId = this.taskNodeId(run.taskId);
        if (nodes.has(taskNodeId)) {
          this.addEdge(edges, {
            id: `edge:${this.runNodeId(run.id)}->${taskNodeId}:run_for_task`,
            type: "run_for_task",
            from: this.runNodeId(run.id),
            to: taskNodeId,
            label: "run for task",
            quality: "verified",
            createdAt: run.createdAt,
          });
        }
      }
      if (run.deliverablePath) {
        const deliverableNodeId = this.deliverableNodeId(run.deliverablePath);
        this.addNode(nodes, {
          id: deliverableNodeId,
          type: "deliverable",
          layer: NODE_TYPE_LAYER.deliverable,
          label: this.labelFromPath(run.deliverablePath),
          path: run.deliverablePath,
          quality: run.reviewStatus === "approved" ? "verified" : "generated",
          reviewStatus: run.reviewStatus,
          createdAt: run.updatedAt,
          updatedAt: run.updatedAt,
        });
        this.addEdge(edges, {
          id: `edge:${this.runNodeId(run.id)}->${deliverableNodeId}:run_created_deliverable`,
          type: "run_created_deliverable",
          from: this.runNodeId(run.id),
          to: deliverableNodeId,
          label: "created deliverable",
          quality: run.reviewStatus === "approved" ? "verified" : "generated",
          createdAt: run.updatedAt,
        });
      }
    }

    const curatedWikiPaths = wikiPaths.filter((wikiPath) => !this.isGeneratedMemoryArtifactPath(wikiPath));
    for (const wikiPath of curatedWikiPaths) {
      const updatedAt = await this.fileMtime(wikiPath);
      this.addNode(nodes, {
        id: this.wikiPageNodeId(wikiPath),
        type: "wiki-page",
        layer: NODE_TYPE_LAYER["wiki-page"],
        label: this.labelFromPath(wikiPath),
        path: wikiPath,
        quality: "verified",
        updatedAt,
      });
      const deliverableNodeId = this.deliverableNodeId(wikiPath);
      if (nodes.has(deliverableNodeId)) {
        this.addEdge(edges, {
          id: `edge:${deliverableNodeId}->${this.wikiPageNodeId(wikiPath)}:deliverable_is_wiki_page`,
          type: "deliverable_is_wiki_page",
          from: deliverableNodeId,
          to: this.wikiPageNodeId(wikiPath),
          label: "is wiki page",
          quality: "verified",
        });
      }
    }

    for (const rawPath of rawPaths) {
      const updatedAt = await this.fileMtime(rawPath);
      this.addNode(nodes, {
        id: this.rawSourceNodeId(rawPath),
        type: "raw-source",
        layer: NODE_TYPE_LAYER["raw-source"],
        label: this.labelFromPath(rawPath),
        path: rawPath,
        quality: "verified",
        updatedAt,
      });
    }

    for (const runtimePath of runtimePaths) {
      const updatedAt = await this.fileMtime(runtimePath);
      this.addNode(nodes, {
        id: this.runtimeLogNodeId(runtimePath),
        type: "runtime-log",
        layer: NODE_TYPE_LAYER["runtime-log"],
        label: this.labelFromPath(runtimePath),
        path: runtimePath,
        quality: "verified",
        updatedAt,
      });
    }

    for (const issue of lint.issues) {
      const quality: KnowledgeGraphQualityState = issue.code === "stale_index_entry" ? "stale" : "orphaned";
      const issueNodeId = `lint:${issue.code}:${issue.path}`;
      this.addNode(nodes, {
        id: issueNodeId,
        type: "lint-issue",
        layer: NODE_TYPE_LAYER["lint-issue"],
        label: issue.code,
        path: issue.path,
        quality,
        status: issue.code,
        updatedAt: lint.checkedAt,
        metadata: {
          message: issue.message,
          suggestion: issue.suggestion ?? null,
        },
      });
      const wikiPageNodeId = this.wikiPageNodeId(issue.path);
      if (nodes.has(wikiPageNodeId)) {
        this.addEdge(edges, {
          id: `edge:${wikiPageNodeId}->${issueNodeId}:wiki_page_has_lint_issue`,
          type: "wiki_page_has_lint_issue",
          from: wikiPageNodeId,
          to: issueNodeId,
          label: "has lint issue",
          quality,
          createdAt: lint.checkedAt,
        });
      }
    }

    await this.addWikiInternalLinkEdges(curatedWikiPaths, nodes, edges);
    await this.addDreamDecisionNodesAndEdges(curatedWikiPaths, nodes, edges);
    await this.applyAnnotations(nodes);

    const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
    const edgeList = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
    const response: KnowledgeGraphResponse = {
      generatedAt: new Date().toISOString(),
      nodes: nodeList,
      edges: edgeList,
      stats: {
        nodes: nodeList.length,
        edges: edgeList.length,
        byNodeType: this.countByNodeType(nodeList),
        byQuality: this.countByQuality(nodeList),
        byLayer: this.countByLayer(nodeList),
      },
    };
    await this.recordSnapshot(response);
    return response;
  }

  async buildRoleMemory(): Promise<RoleMemoryResponse> {
    const [agents, tasks, runs] = await Promise.all([this.agents.list(), this.tasks.list(), this.runs.list()]);
    const generatedAt = new Date().toISOString();
    const roles: RoleMemoryEntry[] = AGENT_ROLES.map((role) => {
      const roleAgents = agents.filter((agent) => agent.role === role);
      const roleAgentIds = new Set(roleAgents.map((agent) => agent.id));
      const roleTasks = tasks.filter((task) => task.assignedAgentId && roleAgentIds.has(task.assignedAgentId));
      const roleRuns = runs
        .filter((run) => run.agentId && roleAgentIds.has(run.agentId))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      const pendingReview = roleRuns.filter((run) => run.reviewStatus === "pending").length;
      const blocked = roleRuns.filter((run) => run.status === "blocked").length;
      const failed = roleRuns.filter((run) => run.status === "failed").length;
      const completed = roleRuns.filter((run) => run.status === "completed").length;
      const blockers = this.extractBlockerSignals(roleRuns);

      const focus: string[] = [];
      if (blocked + failed > 0) {
        focus.push(`Address ${blocked + failed} blocked/failed run(s) before starting new work.`);
      }
      if (pendingReview > 0) {
        focus.push(`Close ${pendingReview} pending review item(s) to keep delivery flow moving.`);
      }
      if (focus.length === 0) {
        focus.push("No active friction detected. Keep cadence with small, verifiable run slices.");
      }

      return {
        role,
        agentIds: roleAgents.map((agent) => agent.id),
        agentNames: roleAgents.map((agent) => agent.name),
        stats: {
          agents: roleAgents.length,
          tasks: roleTasks.length,
          runs: roleRuns.length,
          completed,
          blocked,
          failed,
          pendingReview,
        },
        recentRuns: roleRuns.slice(0, 5).map((run) => ({
          runId: run.id,
          type: run.type,
          status: run.status,
          reviewStatus: run.reviewStatus,
          taskId: run.taskId,
          updatedAt: run.updatedAt,
        })),
        blockers,
        focus,
      };
    });

    return { generatedAt, roles };
  }

  private async applyAnnotations(nodes: Map<string, KnowledgeGraphNode>): Promise<void> {
    const annotations = await this.readAnnotationsMap();
    for (const [nodeId, annotation] of Object.entries(annotations)) {
      const node = nodes.get(nodeId);
      if (!node) continue;
      nodes.set(nodeId, {
        ...node,
        metadata: {
          ...(node.metadata ?? {}),
          annotationNote: annotation.note,
          annotationTags: annotation.tags.join(","),
          annotationUpdatedAt: annotation.updatedAt,
        },
      });
    }
  }

  private async readAnnotationsMap(): Promise<Record<string, KnowledgeNodeAnnotation>> {
    const raw = await this.readJsonFile<Record<string, KnowledgeNodeAnnotation>>(this.annotationsFileAbsolute);
    return raw ?? {};
  }

  private async readFilterPresets(): Promise<KnowledgeFilterPreset[]> {
    const raw = await this.readJsonFile<KnowledgeFilterPreset[]>(this.filterPresetsFileAbsolute);
    return Array.isArray(raw) ? raw : [];
  }

  private async readJsonFile<T>(absolutePath: string | null): Promise<T | null> {
    if (!absolutePath) return null;
    try {
      const content = await readFile(absolutePath, "utf8");
      return JSON.parse(content) as T;
    } catch {
      return null;
    }
  }

  private async writeJsonFile<T>(absolutePath: string | null, value: T): Promise<void> {
    if (!absolutePath) return;
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, JSON.stringify(value, null, 2), "utf8");
  }

  private async loadPersistedSnapshots(): Promise<void> {
    if (!this.snapshotDirAbsolute) return;
    await mkdir(this.snapshotDirAbsolute, { recursive: true });
    const fileNames = await readdir(this.snapshotDirAbsolute);
    const snapshots: KnowledgeGraphResponse[] = [];
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) continue;
      try {
        const absolute = path.join(this.snapshotDirAbsolute, fileName);
        const content = await readFile(absolute, "utf8");
        const parsed = JSON.parse(content) as Partial<KnowledgeGraphResponse>;
        if (
          typeof parsed.generatedAt !== "string" ||
          !Array.isArray(parsed.nodes) ||
          !Array.isArray(parsed.edges) ||
          typeof parsed.stats !== "object" ||
          parsed.stats === null
        ) {
          continue;
        }
        snapshots.push(parsed as KnowledgeGraphResponse);
      } catch {
        // Ignore malformed snapshot files so startup remains resilient.
      }
    }
    snapshots.sort((a, b) => Date.parse(a.generatedAt) - Date.parse(b.generatedAt));
    this.snapshots = snapshots.slice(-SNAPSHOT_RING_SIZE);
  }

  private async persistSnapshots(): Promise<void> {
    if (!this.snapshotDirAbsolute) return;
    await mkdir(this.snapshotDirAbsolute, { recursive: true });
    const activeFiles = new Set<string>();
    for (const snapshot of this.snapshots) {
      const fileName = `${snapshot.generatedAt.replace(/[:.]/g, "-")}.json`;
      activeFiles.add(fileName);
      const absolute = path.join(this.snapshotDirAbsolute, fileName);
      await writeFile(absolute, JSON.stringify(snapshot, null, 2), "utf8");
    }
    const fileNames = await readdir(this.snapshotDirAbsolute);
    for (const fileName of fileNames) {
      if (!fileName.endsWith(".json")) continue;
      if (activeFiles.has(fileName)) continue;
      await rm(path.join(this.snapshotDirAbsolute, fileName), { force: true });
    }
  }

  private async addDreamDecisionNodesAndEdges(
    curatedWikiPaths: string[],
    nodes: Map<string, KnowledgeGraphNode>,
    edges: Map<string, KnowledgeGraphEdge>,
  ): Promise<void> {
    const decisionPaths = curatedWikiPaths.filter((wikiPath) => wikiPath.startsWith("wiki/decisions/"));
    if (decisionPaths.length === 0) return;
    const pages = await this.wiki.readPagesByPaths(decisionPaths);
    for (const page of pages) {
      const createdAt = this.captureField(page.content, "Created at");
      const reportPath = this.captureField(page.content, "Report path");
      const decision = this.captureField(page.content, "Decision");
      const taskId = this.captureField(page.content, "Task ID");
      const proposal = this.captureSection(page.content, "Proposal");
      if (!reportPath || !decision) continue;

      const decisionNodeId = `dream-decision:${page.path}`;
      this.addNode(nodes, {
        id: decisionNodeId,
        type: "dream-decision",
        layer: NODE_TYPE_LAYER["dream-decision"],
        label: `Dream ${decision}`,
        path: page.path,
        quality: decision === "accepted" ? "verified" : decision === "deferred" ? "proposed" : "contradicted",
        createdAt: createdAt ?? undefined,
        updatedAt: createdAt ?? undefined,
        metadata: {
          decision,
          reportPath,
          proposal: proposal ?? null,
          taskId: taskId ?? null,
        },
      });

      const reportNodeId = this.wikiPageNodeId(reportPath);
      if (nodes.has(reportNodeId)) {
        this.addEdge(edges, {
          id: `edge:${decisionNodeId}->${reportNodeId}:dream_decision_for_report`,
          type: "dream_decision_for_report",
          from: decisionNodeId,
          to: reportNodeId,
          label: "decision for report",
          quality: decision === "accepted" ? "verified" : decision === "deferred" ? "proposed" : "contradicted",
          createdAt: createdAt ?? undefined,
        });
      }
    }
  }

  private captureField(content: string, name: string): string | null {
    const regex = new RegExp(`^- ${name}:\\s*(.+)$`, "m");
    const value = content.match(regex)?.[1]?.trim();
    return value && value.length > 0 ? value : null;
  }

  private captureSection(content: string, sectionName: string): string | null {
    const regex = new RegExp(`## ${sectionName}\\n\\n([\\s\\S]*?)(?:\\n## |$)`);
    const section = content.match(regex)?.[1]?.trim();
    return section && section.length > 0 ? section : null;
  }

  private async addWikiInternalLinkEdges(
    curatedWikiPaths: string[],
    nodes: Map<string, KnowledgeGraphNode>,
    edges: Map<string, KnowledgeGraphEdge>,
  ): Promise<void> {
    const pages = await this.wiki.readPagesByPaths(curatedWikiPaths);
    for (const page of pages) {
      const fromId = this.wikiPageNodeId(page.path);
      if (!nodes.has(fromId)) continue;

      const pageDir = this.dirname(page.path);
      const linkTargets = new Set<string>();
      for (const match of page.content.matchAll(MARKDOWN_LINK)) {
        const target = match[1]?.trim();
        if (!target || target.startsWith("http://") || target.startsWith("https://") || target.startsWith("mailto:")) {
          continue;
        }
        const resolved = this.resolveRelativeAtelierPath(pageDir, target);
        if (!resolved) continue;
        if (!/\.(md|markdown|pdf|txt|json|csv|jsonl|yaml|yml)$/i.test(resolved)) continue;
        linkTargets.add(resolved);
      }

      for (const match of page.content.matchAll(PATH_MENTION)) {
        const target = match[1];
        if (!target) continue;
        const normalized = target.startsWith("atelier/") ? target.slice("atelier/".length) : target;
        linkTargets.add(normalized);
      }

      for (const target of linkTargets) {
        const wikiTargetId = this.wikiPageNodeId(target);
        if (nodes.has(wikiTargetId) && wikiTargetId !== fromId) {
          this.addEdge(edges, {
            id: `edge:${fromId}->${wikiTargetId}:wiki_page_links_to`,
            type: "wiki_page_links_to",
            from: fromId,
            to: wikiTargetId,
            label: "links to",
            quality: "verified",
          });
          continue;
        }
        const rawTargetId = this.rawSourceNodeId(target);
        if (nodes.has(rawTargetId)) {
          this.addEdge(edges, {
            id: `edge:${fromId}->${rawTargetId}:wiki_page_mentions_raw_source`,
            type: "wiki_page_mentions_raw_source",
            from: fromId,
            to: rawTargetId,
            label: "mentions",
            quality: "verified",
          });
          continue;
        }
        const runtimeTargetId = this.runtimeLogNodeId(target);
        if (nodes.has(runtimeTargetId)) {
          this.addEdge(edges, {
            id: `edge:${fromId}->${runtimeTargetId}:wiki_page_mentions_runtime_log`,
            type: "wiki_page_mentions_runtime_log",
            from: fromId,
            to: runtimeTargetId,
            label: "mentions",
            quality: "verified",
          });
        }
      }

      const rawPathField = page.content.match(RAW_PATH_FIELD)?.[1]?.trim();
      if (rawPathField) {
        const resolvedRaw = rawPathField.startsWith("atelier/")
          ? rawPathField.slice("atelier/".length)
          : rawPathField;
        const rawTargetId = this.rawSourceNodeId(resolvedRaw);
        if (nodes.has(rawTargetId)) {
          this.addEdge(edges, {
            id: `edge:${fromId}->${rawTargetId}:wiki_page_mentions_raw_source`,
            type: "wiki_page_mentions_raw_source",
            from: fromId,
            to: rawTargetId,
            label: "raw path",
            quality: "verified",
          });
        }
      }
    }
  }

  private addAgent(nodes: Map<string, KnowledgeGraphNode>, agent: Agent): void {
    this.addNode(nodes, {
      id: this.agentNodeId(agent.id),
      type: "agent",
      layer: NODE_TYPE_LAYER.agent,
      label: agent.name,
      sourceId: agent.id,
      role: agent.role,
      status: agent.status,
      quality: "verified",
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    });
  }

  private addTask(nodes: Map<string, KnowledgeGraphNode>, task: Task): void {
    this.addNode(nodes, {
      id: this.taskNodeId(task.id),
      type: "task",
      layer: NODE_TYPE_LAYER.task,
      label: task.title,
      sourceId: task.id,
      status: task.status,
      quality: task.status === "inbox" ? "proposed" : "verified",
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      metadata: {
        priority: task.priority,
      },
    });
  }

  private addRun(nodes: Map<string, KnowledgeGraphNode>, run: Run): void {
    this.addNode(nodes, {
      id: this.runNodeId(run.id),
      type: "run",
      layer: NODE_TYPE_LAYER.run,
      label: `${run.type} run`,
      sourceId: run.id,
      status: run.status,
      reviewStatus: run.reviewStatus,
      quality: run.status === "completed" ? "verified" : "proposed",
      createdAt: run.createdAt,
      updatedAt: run.updatedAt,
      metadata: {
        type: run.type,
        logCount: run.logs.length,
      },
    });
  }

  private addNode(nodes: Map<string, KnowledgeGraphNode>, node: KnowledgeGraphNode): void {
    nodes.set(node.id, node);
  }

  private addEdge(edges: Map<string, KnowledgeGraphEdge>, edge: KnowledgeGraphEdge): void {
    edges.set(edge.id, edge);
  }

  private countByNodeType(nodes: KnowledgeGraphNode[]): Record<KnowledgeGraphNodeType, number> {
    const counts = Object.fromEntries(KNOWLEDGE_GRAPH_NODE_TYPES.map((type) => [type, 0])) as Record<
      KnowledgeGraphNodeType,
      number
    >;
    for (const node of nodes) {
      counts[node.type] += 1;
    }
    return counts;
  }

  private countByQuality(nodes: KnowledgeGraphNode[]): Record<KnowledgeGraphQualityState, number> {
    const counts = Object.fromEntries(KNOWLEDGE_GRAPH_QUALITY_STATES.map((quality) => [quality, 0])) as Record<
      KnowledgeGraphQualityState,
      number
    >;
    for (const node of nodes) {
      counts[node.quality] += 1;
    }
    return counts;
  }

  private countByLayer(nodes: KnowledgeGraphNode[]): Record<KnowledgeGraphLayer, number> {
    const counts = Object.fromEntries(KNOWLEDGE_GRAPH_LAYERS.map((layer) => [layer, 0])) as Record<
      KnowledgeGraphLayer,
      number
    >;
    for (const node of nodes) {
      counts[node.layer] += 1;
    }
    return counts;
  }

  private labelFromPath(input: string): string {
    const filename = input.split("/").pop() ?? input;
    return filename.replace(/\.md$/, "");
  }

  private dirname(relativePath: string): string {
    const idx = relativePath.lastIndexOf("/");
    return idx < 0 ? "" : relativePath.slice(0, idx);
  }

  private resolveRelativeAtelierPath(baseDir: string, target: string): string | null {
    const normalizedTarget = target.replace(/^\.\//, "");
    if (normalizedTarget.startsWith("/")) return null;
    const segments = baseDir ? baseDir.split("/") : [];
    for (const part of normalizedTarget.split("/")) {
      if (part === "" || part === ".") continue;
      if (part === "..") {
        segments.pop();
        continue;
      }
      segments.push(part);
    }
    return segments.join("/");
  }

  private isGeneratedMemoryArtifactPath(wikiPath: string): boolean {
    return (
      /^wiki\/deliverables\/[0-9a-f]{24}-.*\.md$/.test(wikiPath) ||
      /^wiki\/deliverables\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-.*\.md$/.test(wikiPath)
    );
  }

  private extractBlockerSignals(runs: Run[]): string[] {
    const scores = new Map<string, number>();
    for (const run of runs) {
      const runHasIssue = run.status === "blocked" || run.status === "failed";
      for (const log of run.logs) {
        const message = log.message.trim();
        if (!message) continue;
        const containsSignal = /block|error|fail|missing|timeout|permission|invalid|not found/i.test(message);
        if (!containsSignal && !runHasIssue) continue;
        const normalized = message.replace(/\s+/g, " ").slice(0, 160);
        scores.set(normalized, (scores.get(normalized) ?? 0) + (runHasIssue ? 2 : 1));
      }
    }
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message]) => message);
  }

  private roleNodeId(role: string): string {
    return `role:${role}`;
  }

  private agentNodeId(id: string): string {
    return `agent:${id}`;
  }

  private taskNodeId(id: string): string {
    return `task:${id}`;
  }

  private runNodeId(id: string): string {
    return `run:${id}`;
  }

  private wikiPageNodeId(wikiPath: string): string {
    return `wiki-page:${wikiPath}`;
  }

  private deliverableNodeId(wikiPath: string): string {
    return `deliverable:${wikiPath}`;
  }

  private rawSourceNodeId(rawPath: string): string {
    return `raw-source:${rawPath}`;
  }

  private runtimeLogNodeId(runtimePath: string): string {
    return `runtime-log:${runtimePath}`;
  }
}
