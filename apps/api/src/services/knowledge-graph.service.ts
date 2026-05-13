import { stat } from "node:fs/promises";
import * as path from "node:path";
import type {
  Agent,
  KnowledgeGraphEdge,
  KnowledgeGraphLayer,
  KnowledgeGraphNode,
  KnowledgeGraphNodeType,
  KnowledgeGraphQualityState,
  KnowledgeGraphResponse,
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
};

const MARKDOWN_LINK = /\[[^\]]+\]\(([^)\s#]+)(?:#[^)]*)?\)/g;
const RAW_PATH_FIELD = /^- Raw path:\s*(.+)$/m;
const PATH_MENTION = /(?<![\w/])((?:wiki|raw|runs|tasks)\/[\w./-]+\.(?:md|pdf|txt|json|csv|jsonl|yaml|yml))\b/gi;

export class KnowledgeGraphService {
  constructor(
    private readonly agents: AgentService,
    private readonly tasks: TaskService,
    private readonly runs: RunService,
    private readonly wiki: WikiService,
    private readonly atelierRoot?: string,
  ) {}

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

    const nodeList = [...nodes.values()].sort((a, b) => a.id.localeCompare(b.id));
    const edgeList = [...edges.values()].sort((a, b) => a.id.localeCompare(b.id));
    return {
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
