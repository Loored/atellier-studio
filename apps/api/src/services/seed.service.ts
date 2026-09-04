import type { AgentRole } from "@atellier/shared";
import type { AgentService } from "./agent.service";
import type { TaskService } from "./task.service";
import type { RunService } from "./run.service";

type SeedSpec = {
  agentName: string;
  role: AgentRole;
  tasks: Array<{
    title: string;
    description: string;
    status: "inbox" | "active" | "blocked" | "done";
    priority: "low" | "medium" | "high";
  }>;
  runs?: Array<{
    type: "manual" | "ingest" | "query" | "build" | "review" | "lint" | "orchestration";
    summary: string;
  }>;
};

const SEED: ReadonlyArray<SeedSpec> = [
  {
    agentName: "Pepe PM",
    role: "pm",
    tasks: [
      { title: "Define spike for Knowledge Graph quality view", description: "Sketch the curation funnel.", status: "active", priority: "high" },
      { title: "Plan release notes for Wiki Dream", description: "Capture before/after.", status: "inbox", priority: "medium" },
    ],
    runs: [{ type: "orchestration", summary: "Scoped graph curation funnel into 3 milestones." }],
  },
  {
    agentName: "Toto Builder",
    role: "builder",
    tasks: [
      { title: "Wire layer breakdown to backend stats", description: "Replace heuristic with stats.byLayer.", status: "done", priority: "high" },
      { title: "Persist viewport across refetches", description: "Skip zoomToFit when initialFitDoneRef is set.", status: "done", priority: "high" },
    ],
    runs: [
      { type: "build", summary: "Implemented force-directed canvas with clustering by layer." },
      { type: "build", summary: "Added URL-synced filters and SearchBar with keyboard nav." },
    ],
  },
  {
    agentName: "Jaco QA",
    role: "qa",
    tasks: [
      { title: "Smoke-test polling under load", description: "Verify the canvas stays responsive at 200 nodes.", status: "active", priority: "medium" },
      { title: "Verify markdown render in inspector", description: "Cover headings, lists, code, links.", status: "done", priority: "medium" },
    ],
    runs: [{ type: "review", summary: "Confirmed no regressions in 72 API tests." }],
  },
  {
    agentName: "Veronika Designer",
    role: "designer",
    tasks: [
      { title: "Polish hover tooltip typography", description: "Tighten badge contrast.", status: "inbox", priority: "low" },
    ],
  },
  {
    agentName: "Wiki Curator",
    role: "wiki-curator",
    tasks: [
      { title: "Promote graph direction note to wiki/synthesis", description: "Pull from runs/.", status: "active", priority: "medium" },
      { title: "Lint orphan wiki pages", description: "Run wiki-dream and capture report.", status: "inbox", priority: "medium" },
    ],
    runs: [{ type: "ingest", summary: "Captured 2026-05-12 review memory into wiki/synthesis." }],
  },
  {
    agentName: "Carla Intake",
    role: "intake",
    tasks: [
      { title: "Triage Anthropic Code with Claude 2026 keynote takeaways", description: "Sort into raw/ingest.", status: "done", priority: "high" },
    ],
  },
];

export async function seedDemoData(services: {
  agents: AgentService;
  tasks: TaskService;
  runs: RunService;
}): Promise<{ agentsCreated: number; tasksCreated: number; runsCreated: number }> {
  const existing = await services.agents.list();
  if (existing.length > 0) return { agentsCreated: 0, tasksCreated: 0, runsCreated: 0 };

  let agentsCreated = 0;
  let tasksCreated = 0;
  let runsCreated = 0;

  for (const spec of SEED) {
    const agent = await services.agents.create({
      name: spec.agentName,
      role: spec.role,
      status: "idle",
    });
    agentsCreated += 1;

    let firstTaskId: string | undefined;
    for (const task of spec.tasks) {
      const created = await services.tasks.create({
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedAgentId: agent.id,
        sourceIds: [],
      });
      tasksCreated += 1;
      firstTaskId ??= created.id;
    }

    for (const run of spec.runs ?? []) {
      const created = await services.runs.create({
        agentId: agent.id,
        taskId: firstTaskId,
        type: run.type,
        input: { summary: run.summary },
      });
      runsCreated += 1;
      await services.runs.appendLog(created.id, { level: "info", message: run.summary });
    }
  }

  return { agentsCreated, tasksCreated, runsCreated };
}
