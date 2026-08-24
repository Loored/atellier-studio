import { render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./features/knowledge/components/ForceGraphCanvas", () => ({
  ForceGraphCanvas: () => null,
}));

import App from "./App";
import { queryClient } from "./api/query/queryClient";
import { wikiService } from "./api/services/wiki.service";

const createTaskMock = vi.hoisted(() => vi.fn());
const appendLogMock = vi.hoisted(() => vi.fn());
const listRunsMock = vi.hoisted(() => vi.fn());
const updateRunReviewMock = vi.hoisted(() => vi.fn());
const promoteDeliverableMock = vi.hoisted(() => vi.fn());
const unlinkDeliverableMock = vi.hoisted(() => vi.fn());
const captureRunMemoryMock = vi.hoisted(() => vi.fn());
const retryRunMock = vi.hoisted(() => vi.fn());
const startSkillOrchestrationMock = vi.hoisted(() => vi.fn());
const getOrchestrationStatusMock = vi.hoisted(() => vi.fn());
const ingestWikiMock = vi.hoisted(() => vi.fn());
const queryWikiMock = vi.hoisted(() => vi.fn());
const lintWikiMock = vi.hoisted(() => vi.fn());
const appendWikiLogMock = vi.hoisted(() => vi.fn());
const writeWikiPageMock = vi.hoisted(() => vi.fn());
const recordDreamDecisionMock = vi.hoisted(() => vi.fn());
const createCodexRunMock = vi.hoisted(() => vi.fn());
const getCodexRunMock = vi.hoisted(() => vi.fn());
const planCodexRunMock = vi.hoisted(() => vi.fn());
const approveCodexStepMock = vi.hoisted(() => vi.fn());
const executeNextCodexMock = vi.hoisted(() => vi.fn());
const cancelCodexMock = vi.hoisted(() => vi.fn());
const finalizeCodexMock = vi.hoisted(() => vi.fn());
const readKnowledgeGraphMock = vi.hoisted(() => vi.fn());
const listKnowledgeSnapshotsMock = vi.hoisted(() => vi.fn().mockResolvedValue({ snapshots: [] }));
const readKnowledgeSnapshotDiffMock = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    generatedAt: "2026-05-16T00:00:00.000Z",
    baseId: "",
    headId: "",
    nodes: { added: 0, removed: 0, addedNodeIds: [], removedNodeIds: [] },
    edges: { added: 0, removed: 0, addedEdgeIds: [], removedEdgeIds: [] },
  }),
);
const listKnowledgeAnnotationsMock = vi.hoisted(() => vi.fn().mockResolvedValue({ annotations: [] }));
const listKnowledgeFilterPresetsMock = vi.hoisted(() => vi.fn().mockResolvedValue({ presets: [] }));
const saveKnowledgeAnnotationMock = vi.hoisted(() => vi.fn());
const createKnowledgeFilterPresetMock = vi.hoisted(() => vi.fn());
const readKnowledgeRoleMemoryMock = vi.hoisted(() => vi.fn().mockResolvedValue({ generatedAt: "2026-05-16T00:00:00.000Z", roles: [] }));

vi.mock("./api/services/agents.service", () => ({
  agentsService: {
    list: vi.fn().mockResolvedValue([
      {
        id: "agent-1",
        name: "Builder Agent",
        role: "builder",
        status: "idle",
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
    ]),
    create: vi.fn(),
    updateStatus: vi.fn(),
  },
}));

vi.mock("./api/services/tasks.service", () => ({
  tasksService: {
    list: vi.fn().mockResolvedValue([
      {
        id: "task-1",
        title: "Prepare project spine",
        status: "active",
        priority: "high",
        sourceIds: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
    ]),
    create: createTaskMock,
    update: vi.fn(),
  },
}));

vi.mock("./api/services/runs.service", () => ({
  runsService: {
    list: listRunsMock,
    create: vi.fn(),
    appendLog: appendLogMock,
    complete: vi.fn(),
    updateReview: updateRunReviewMock,
    promoteDeliverable: promoteDeliverableMock,
    unlinkDeliverable: unlinkDeliverableMock,
    captureMemory: captureRunMemoryMock,
    retry: retryRunMock,
  },
}));

vi.mock("./api/services/orchestrations.service", () => ({
  orchestrationsService: {
    listSkills: vi.fn().mockResolvedValue([
      {
        id: "atellier-build-loop",
        name: "Atellier Build Loop",
        description: "Coordinates planning, building, runtime validation, QA, fixing, and memory capture.",
        steps: [
          {
            id: "scope",
            label: "Scope the work",
            phase: "plan",
            agentRole: "pm",
            agentName: "Pepe PM",
            objective: "Turn the goal into a small execution plan.",
          },
          {
            id: "qa",
            label: "Test and report blockers",
            phase: "qa",
            agentRole: "qa",
            agentName: "Jaco QA",
            objective: "Review the result and report defects.",
          },
        ],
      },
      {
        id: "wiki-dream-loop",
        name: "Wiki Dream Loop",
        description: "Periodic curator pass over the wiki.",
        steps: [
          {
            id: "audit",
            label: "Audit the wiki",
            phase: "wiki",
            agentRole: "wiki-curator",
            agentName: "Wiki Curator",
            objective: "Surface structural issues.",
          },
          {
            id: "draft-report",
            label: "Draft the dream report",
            phase: "wiki",
            agentRole: "wiki-curator",
            agentName: "Wiki Curator",
            objective: "Draft the report.",
          },
        ],
      },
    ]),
    startSkillRun: startSkillOrchestrationMock,
    getStatus: getOrchestrationStatusMock,
  },
}));

vi.mock("./api/services/wiki.service", () => ({
  wikiService: {
    readIndex: vi.fn().mockResolvedValue({
      path: "atelier/wiki/index.md",
      content: "# Atellier Studio Wiki Index",
      ready: true,
    }),
    readLog: vi.fn().mockResolvedValue({
      path: "atelier/wiki/log.md",
      content:
        "# Atellier Studio Wiki Log\n\n## [2026-05-04T00:00:00.000Z] initialization | Milestone 0 wiki log created",
      ready: true,
    }),
    appendLog: appendWikiLogMock,
    readPage: vi.fn(),
    ingest: ingestWikiMock,
    query: queryWikiMock,
    lint: lintWikiMock,
    writePage: writeWikiPageMock,
    recordDreamDecision: recordDreamDecisionMock,
  },
}));

vi.mock("./api/services/system.service", () => ({
  systemService: {
    readHealth: vi.fn().mockResolvedValue({
      status: "ok",
      service: "atellier-api",
      storageMode: "memory",
      executorMode: "openai",
      executorModel: "gpt-4.1-mini",
      modelProfile: "standard",
      mongo: { connected: false, state: "disconnected" },
      metrics: { agentsTotal: 1, waitingAgents: 0, activeRuns: 1 },
      memory: { rssBytes: 1000, heapUsedBytes: 500 },
    }),
  },
}));

vi.mock("./api/services/codex-worker.service", () => ({
  codexWorkerService: {
    create: createCodexRunMock,
    get: getCodexRunMock,
    plan: planCodexRunMock,
    approveStep: approveCodexStepMock,
    executeNext: executeNextCodexMock,
    cancel: cancelCodexMock,
    finalize: finalizeCodexMock,
  },
}));

vi.mock("./api/services/knowledge.service", () => ({
  knowledgeService: {
    readGraph: readKnowledgeGraphMock,
    listSnapshots: listKnowledgeSnapshotsMock,
    readSnapshotDiff: readKnowledgeSnapshotDiffMock,
    readRoleMemory: readKnowledgeRoleMemoryMock,
    listAnnotations: listKnowledgeAnnotationsMock,
    listFilterPresets: listKnowledgeFilterPresetsMock,
    saveAnnotation: saveKnowledgeAnnotationMock,
    createFilterPreset: createKnowledgeFilterPresetMock,
  },
}));

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "confirm", {
      writable: true,
      value: vi.fn(() => true),
    });
    vi.clearAllMocks();
    queryClient.clear();
    listRunsMock.mockResolvedValue([
      {
        id: "run-1",
        type: "manual",
        status: "running",
        logs: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
      {
        id: "run-2",
        type: "review",
        status: "completed",
        reviewStatus: "pending",
        logs: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
      {
        id: "run-3",
        type: "build",
        status: "completed",
        reviewStatus: "approved",
        deliverablePath: "wiki/deliverables/run-3.md",
        logs: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
    ]);
    createTaskMock.mockResolvedValue({
      id: "task-2",
      title: "Review V3",
      status: "inbox",
      priority: "medium",
      sourceIds: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    appendLogMock.mockResolvedValue({
      id: "run-1",
      type: "manual",
      status: "running",
      logs: [
        {
          timestamp: "2026-05-04T00:00:00.000Z",
          level: "info",
          message: "Reviewed V3",
        },
      ],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    updateRunReviewMock.mockResolvedValue({
      id: "run-1",
      type: "manual",
      status: "completed",
      reviewStatus: "approved",
      logs: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    promoteDeliverableMock.mockResolvedValue({
      id: "run-2",
      type: "review",
      status: "completed",
      reviewStatus: "pending",
      deliverablePath: "wiki/deliverables/run-2.md",
      logs: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    unlinkDeliverableMock.mockResolvedValue({
      id: "run-3",
      type: "build",
      status: "completed",
      reviewStatus: "approved",
      logs: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    captureRunMemoryMock.mockResolvedValue({
      run: {
        id: "run-2",
        type: "review",
        status: "completed",
        reviewStatus: "pending",
        logs: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
      wikiPath: "wiki/synthesis/run-run-2-review-memory-captured-from-dashboard.md",
      logPath: "wiki/log.md",
    });
    retryRunMock.mockResolvedValue({
      id: "run-retry",
      type: "orchestration",
      status: "queued",
      logs: [],
      createdAt: "2026-05-04T00:00:00.000Z",
      updatedAt: "2026-05-04T00:00:00.000Z",
    });
    startSkillOrchestrationMock.mockResolvedValue({ runId: "run-4" });
    getOrchestrationStatusMock.mockResolvedValue({
      orchestrationRunId: "run-4",
      skillId: "atellier-build-loop",
      goal: "Build orchestration",
      status: "completed",
      steps: [],
      activeStep: null,
      nextStep: null,
    });
    ingestWikiMock.mockResolvedValue({
      rawPath: "raw/ingest/2026-05-05-client-meeting-notes.md",
      summaryPagePath: "wiki/sources/2026-05-05-client-meeting-notes.md",
      logPath: "wiki/log.md",
      proposedTasks: ["- [ ] Client meeting notes (source: wiki/sources/2026-05-05-client-meeting-notes.md)"],
    });
    queryWikiMock.mockResolvedValue({
      query: "raw sources",
      matches: [
        {
          path: "wiki/sources/2026-05-05-client-meeting-notes.md",
          snippet: "preserve raw sources first",
        },
      ],
      relatedPages: [
        {
          path: "wiki/sources/2026-05-05-client-meeting-notes.md",
          summary: "preserve raw sources first",
          reason: "Source summary shares query terms.",
        },
      ],
      contradictions: [
        {
          primaryPath: "wiki/sources/2026-05-05-client-meeting-notes.md",
          conflictingPath: "wiki/notes/raw-policy.md",
          reason: "Multiple wiki index entries share the summary \"raw sources\" and should be reviewed together.",
        },
      ],
    });
    lintWikiMock.mockResolvedValue({
      ok: false,
      issues: [
        {
          code: "broken_link",
          path: "wiki/sources/broken-source.md",
          message: "Raw source reference is missing: raw/ingest/does-not-exist.md",
          suggestion: "Fix the Raw path reference or restore the missing raw source.",
        },
      ],
      checkedAt: "2026-05-05T00:00:00.000Z",
    });
    writeWikiPageMock.mockResolvedValue({
      path: "wiki/notes/wiki-brain-v2.md",
      content: "# Wiki Brain v2\n\n- Safe write route active.",
      ready: true,
    });
    recordDreamDecisionMock.mockResolvedValue({
      id: "decision-1",
      path: "wiki/decisions/2026-05-13-dream-decision-1.md",
      reportPath: "wiki/dreams/2026-05-11-dream-report.md",
      proposal: "Keep the report as a proposed maintenance page.",
      decision: "accepted",
      createdAt: "2026-05-13T00:00:00.000Z",
    });
    createCodexRunMock.mockResolvedValue({ id: "codex-run-1" });
    getCodexRunMock.mockResolvedValue({
      run: {
        id: "codex-run-1",
        status: "queued",
        output: {
          finalize: {
            runLog: "runs/2026-05-05-codex-worker-codex-run-1.md",
            finalizedAt: "2026-05-05T00:00:00.000Z",
            evidence: {
              completedSteps: 2,
              totalSteps: 2,
              changedFiles: ["apps/api/src/services/codex-worker.service.ts"],
              testEvidence: ["pnpm test:web passed"],
            },
          },
        },
      },
      mode: "approved_step",
      profile: "standard",
      goal: "Implement a safe API change",
      steps: [
        {
          id: "step-1",
          summary: "Inspect relevant files and constraints",
          status: "pending",
          needsApproval: false,
          riskLevel: "low",
          command: "rg --files",
          workingDirectory: ".",
          output: "Fake executor completed step.",
          stdoutPath: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stdout.log",
          stderrPath: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stderr.log",
          evidence: {
            summary: "Fake executor completed step.",
            capturedAt: "2026-05-05T00:00:00.000Z",
            command: "rg --files",
            workingDirectory: ".",
            notes: [
              "Executed by the fake executor.",
              "stdout written to runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stdout.log",
              "stderr written to runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stderr.log",
            ],
            artifacts: [
              { label: "stdout", path: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stdout.log" },
              { label: "stderr", path: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stderr.log" },
            ],
          },
        },
        {
          id: "step-2",
          summary: "Implement bounded change and update tests",
          status: "pending",
          needsApproval: true,
          riskLevel: "medium",
          command: "pnpm test:api",
          workingDirectory: ".",
        },
      ],
    });
    planCodexRunMock.mockResolvedValue({});
    approveCodexStepMock.mockResolvedValue({});
    executeNextCodexMock.mockResolvedValue({});
    cancelCodexMock.mockResolvedValue({});
    finalizeCodexMock.mockResolvedValue({});
    readKnowledgeGraphMock.mockResolvedValue({
      generatedAt: "2026-05-12T00:00:00.000Z",
      nodes: [
        {
          id: "agent:agent-1",
          type: "agent",
          layer: "runtime",
          label: "Builder Agent",
          sourceId: "agent-1",
          role: "builder",
          status: "idle",
          quality: "verified",
        },
        {
          id: "role:builder",
          type: "role",
          layer: "meta",
          label: "builder",
          role: "builder",
          quality: "verified",
        },
      ],
      edges: [
        {
          id: "edge:agent:agent-1->role:builder:agent_has_role",
          type: "agent_has_role",
          from: "agent:agent-1",
          to: "role:builder",
          label: "has role",
          quality: "verified",
        },
      ],
      stats: {
        nodes: 2,
        edges: 1,
        byNodeType: {
          agent: 1,
          role: 1,
          task: 0,
          run: 0,
          "wiki-page": 0,
          deliverable: 0,
          "lint-issue": 0,
          "raw-source": 0,
          "runtime-log": 0,
        },
        byQuality: {
          verified: 2,
          proposed: 0,
          contradicted: 0,
          stale: 0,
          orphaned: 0,
          generated: 0,
        },
        byLayer: {
          wiki: 0,
          raw: 0,
          runtime: 1,
          meta: 1,
        },
      },
    });
    vi.mocked(wikiService.readPage).mockResolvedValue({
      path: "runs/2026-05-05-codex-worker-codex-run-1.md",
      ready: true,
      content: "# Run Log - Codex Worker Finalize\n\nFinalized from dashboard codex worker panel.",
    });
  });

  it("renders the dashboard with operational data", async () => {
    render(<App />);

    // Dashboard h1 now reads "Dashboard"
    expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByText("Builder Agent")).toBeInTheDocument();
    expect(await screen.findByText("Prepare project spine")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Wiki Log" })).toBeInTheDocument();
    // Executor mode badge in header shows the mode name
    expect((await screen.findAllByText("openai")).length).toBeGreaterThan(0);
  });

  it("renders the knowledge graph view from the graph API chain", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Graph" }));

    expect(await screen.findByRole("heading", { name: "Knowledge Graph" })).toBeInTheDocument();
    expect(await screen.findByText("Composición por capa")).toBeInTheDocument();
    expect((await screen.findAllByRole("button", { name: /WIKI/i })).length).toBeGreaterThan(0);
    expect(await screen.findByPlaceholderText("Buscar nodos…")).toBeInTheDocument();
    expect(readKnowledgeGraphMock).toHaveBeenCalled();
  });

  it("creates a task through the dashboard form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Task title"), "Review V3");
    await user.click(screen.getAllByRole("button", { name: /create/i })[0]);

    await waitFor(() => {
      expect(createTaskMock).toHaveBeenCalledWith({
        title: "Review V3",
        priority: "medium",
        status: "inbox",
      });
    });
  });

  it("appends a run log through the runs timeline", async () => {
    const user = userEvent.setup();
    render(<App />);

    // RunsTimeline is now in the dedicated Runs view, not the Dashboard
    await user.click(await screen.findByRole("button", { name: "Runs" }));
    await user.type(await screen.findByLabelText("Run log message for manual run"), "Reviewed V3");
    await user.click(screen.getByRole("button", { name: "Append log" }));

    await waitFor(() => {
      expect(appendLogMock).toHaveBeenCalledWith("run-1", {
        level: "info",
        message: "Reviewed V3",
      });
    });
  });

  it("retries a failed orchestration from the runs timeline", async () => {
    listRunsMock.mockResolvedValue([
      {
        id: "run-retry",
        type: "orchestration",
        status: "failed",
        logs: [
          {
            timestamp: "2026-05-04T00:00:00.000Z",
            level: "error",
            message: "fetch failed",
          },
        ],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
    ]);
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Runs" }));
    await user.click(await screen.findByRole("button", { name: "Retry orchestration run" }));

    await waitFor(() => {
      expect(retryRunMock).toHaveBeenCalledWith("run-retry");
    });
  });

  it("updates run review status from the runs timeline", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Runs" }));
    const approveButtons = await screen.findAllByRole("button", { name: /approve/i });
    await user.click(approveButtons[0]);

    await waitFor(() => {
      expect(updateRunReviewMock).toHaveBeenCalledWith("run-2", {
        reviewStatus: "approved",
      });
    });
  });

  it("shows review counters and combines review filter with run search", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Runs" }));

    expect((await screen.findAllByText(/pending/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/approved/i)).length).toBeGreaterThan(0);
    expect((await screen.findAllByText(/changes/i)).length).toBeGreaterThan(0);

    const reviewSelects = screen.getAllByRole("combobox");
    await user.selectOptions(reviewSelects[1] as HTMLElement, "approved");
    await user.type(screen.getByLabelText("Run search"), "run-3");

    expect(await screen.findByRole("button", { name: /unlink/i })).toBeInTheDocument();
    expect(screen.queryByText(/No runs match current filters/i)).not.toBeInTheDocument();
  });

  it("promotes a completed run to deliverable from timeline", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Runs" }));
    const promoteButton = await screen.findByRole("button", { name: /promote/i });
    await user.click(promoteButton);

    await waitFor(() => {
      expect(promoteDeliverableMock).toHaveBeenCalledWith("run-2");
    });
  });

  it("unlinks a deliverable from a completed run", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Runs" }));
    const unlinkButton = await screen.findByRole("button", { name: /unlink/i });
    await user.click(unlinkButton);

    await waitFor(() => {
      expect(unlinkDeliverableMock).toHaveBeenCalledWith("run-3");
    });
  });

  it("captures completed review run memory to the wiki", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Review" }));
    const captureButtons = await screen.findAllByRole("button", { name: /capture memory/i });
    await user.click(captureButtons[0]);

    await waitFor(() => {
      expect(captureRunMemoryMock).toHaveBeenCalledWith("run-2", {
        summary: "Review memory captured from dashboard.",
      });
    });
    expect(await screen.findByText(/Captured memory: wiki\/synthesis\/run-run-2-review-memory-captured-from-dashboard\.md/i)).toBeInTheDocument();
  });

  it("filters deliverables by type and review", async () => {
    const user = userEvent.setup();
    render(<App />);

    const deliverablesHeading = await screen.findByRole("heading", { name: "Deliverables" });
    const deliverablesPanel = deliverablesHeading.closest("section");
    expect(deliverablesPanel).not.toBeNull();
    const scoped = within(deliverablesPanel as HTMLElement);

    const [allTypeSelect, allReviewSelect] = scoped.getAllByRole("combobox");

    await user.selectOptions(allTypeSelect, "build");
    await user.selectOptions(allReviewSelect, "approved");

    expect(await screen.findByText("wiki/deliverables/run-3.md")).toBeInTheDocument();
    expect(screen.queryByText("wiki/deliverables/run-2.md")).not.toBeInTheDocument();
  });

  it("starts a skill orchestration from the dashboard", async () => {
    const user = userEvent.setup();
    render(<App />);

    await screen.findByText("Atellier Build Loop");
    const orchestrationHeading = await screen.findByRole("heading", { name: "Orchestration" });
    const orchestrationPanel = orchestrationHeading.closest("section");
    expect(orchestrationPanel).not.toBeNull();
    const scoped = within(orchestrationPanel as HTMLElement);

    await user.type(scoped.getByLabelText("Orchestration goal"), "Build orchestration");
    await user.type(scoped.getByLabelText("Orchestration context"), "Use the existing run spine.");
    await user.click(scoped.getByRole("button", { name: /start/i }));

    await waitFor(() => {
      expect(startSkillOrchestrationMock).toHaveBeenCalledWith({
        skillId: "atellier-build-loop",
        goal: "Build orchestration",
        context: "Use the existing run spine.",
      });
    });
  });

  it("runs wiki ingest and query actions from the wiki panel", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Title"), "Client meeting notes");
    await user.type(screen.getByLabelText("Content"), "Need to preserve raw sources first.");
    const sourceTypeSelects = screen.getAllByLabelText("Source type");
    await user.selectOptions(sourceTypeSelects[0] as HTMLElement, "research");
    await user.click(screen.getByRole("button", { name: /ingest source/i }));

    await waitFor(() => {
      expect(ingestWikiMock).toHaveBeenCalledWith({
        title: "Client meeting notes",
        content: "Need to preserve raw sources first.",
        sourceType: "research",
      });
    });

    await user.type(screen.getByLabelText("Search term"), "raw sources");
    await user.selectOptions(screen.getAllByLabelText("Source type")[1] as HTMLElement, "note");
    await user.click(screen.getByRole("button", { name: /query wiki/i }));

    await waitFor(() => {
      expect(queryWikiMock).toHaveBeenCalledWith({
        query: "raw sources",
        limit: 5,
        sourceType: "note",
      });
    });
    expect(await screen.findByText(/related pages/i)).toBeInTheDocument();
    expect(await screen.findByText(/possible contradictions/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /promote to draft/i }));
    expect((screen.getByLabelText("Wiki path") as HTMLInputElement).value).toContain("wiki/decisions/query-");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Source");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Draft Provenance");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("Suggested page type: decision");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Suggested Structure");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Suggested Follow-ups");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Related Pages");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Review Notes");

    await user.clear(screen.getByLabelText("Wiki path"));
    await user.clear(screen.getByLabelText("Markdown content"));
    await user.type(screen.getByLabelText("Wiki path"), "wiki/notes/wiki-brain-v2.md");
    await user.type(screen.getByLabelText("Markdown content"), "# Wiki Brain v2\n\n- Safe write route active.");
    await user.click(screen.getByRole("button", { name: /save wiki page/i }));

    await waitFor(() => {
      expect(writeWikiPageMock).toHaveBeenCalledWith({
        path: "wiki/notes/wiki-brain-v2.md",
        content: "# Wiki Brain v2\n\n- Safe write route active.",
      });
    });
    await waitFor(() => {
      expect(appendWikiLogMock).toHaveBeenCalledWith({
        eventType: "wiki_write",
        title: "Promoted wiki query result to draft",
        summary: "Created draft from wiki/notes/wiki-brain-v2.md",
        details: {
          sourcePath: "wiki/sources/2026-05-05-client-meeting-notes.md",
          query: "raw sources",
          relatedPages: 1,
          contradictions: 1,
      },
    });
    listKnowledgeSnapshotsMock.mockResolvedValue({ snapshots: [] });
    listKnowledgeAnnotationsMock.mockResolvedValue({ annotations: [] });
    listKnowledgeFilterPresetsMock.mockResolvedValue({ presets: [] });
    saveKnowledgeAnnotationMock.mockResolvedValue({
      nodeId: "run:run-1",
      note: "sample",
      tags: ["sample"],
      updatedAt: "2026-05-13T00:00:00.000Z",
    });
    createKnowledgeFilterPresetMock.mockResolvedValue({
      id: "preset-1",
      name: "Preset",
      nodeTypeFilter: "all",
      qualityFilter: "all",
      activeLayers: ["wiki", "raw", "runtime", "meta"],
      dreamDecisionFilter: "all",
      densityMode: "auto",
      createdAt: "2026-05-13T00:00:00.000Z",
      updatedAt: "2026-05-13T00:00:00.000Z",
    });
  });

    await user.click(screen.getByRole("button", { name: /run wiki lint/i }));
    expect(await screen.findByText(/Fix the Raw path reference or restore the missing raw source\./i)).toBeInTheDocument();
  });

  it("runs a wiki dream and saves the approved report", async () => {
    const user = userEvent.setup();
    const dreamReport = [
      "# Dream Report",
      "",
      "Suggested filename: wiki/dreams/2026-05-11-dream-report.md",
      "",
      "## Summary",
      "",
      "- Grounded paths reviewed.",
      "",
      "## Proposed actions",
      "",
      "1. Keep the report as a proposed maintenance page.",
    ].join("\n");

    startSkillOrchestrationMock.mockResolvedValueOnce({ runId: "dream-run-1" });
    getOrchestrationStatusMock.mockResolvedValueOnce({
      orchestrationRunId: "dream-run-1",
      skillId: "wiki-dream-loop",
      goal: "Periodic curator pass — propose wiki maintenance but apply nothing.",
      status: "completed",
      steps: [
        {
          stepId: "draft-report",
          label: "Draft the dream report",
          phase: "wiki",
          agentRole: "wiki-curator",
          agentName: "Wiki Curator",
          runId: "dream-draft-run",
          status: "completed",
          isActive: false,
        },
      ],
      activeStep: null,
      nextStep: null,
    });
    listRunsMock.mockResolvedValue([
      {
        id: "dream-draft-run",
        type: "manual",
        status: "completed",
        output: {
          response: dreamReport,
        },
        logs: [],
        createdAt: "2026-05-11T00:00:00.000Z",
        updatedAt: "2026-05-11T00:00:00.000Z",
      },
    ]);
    writeWikiPageMock.mockResolvedValueOnce({
      path: "wiki/dreams/2026-05-11-dream-report.md",
      content: dreamReport,
      ready: true,
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: /dream now/i }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("OPENAI execution is active"));
    await waitFor(() => {
      expect(startSkillOrchestrationMock).toHaveBeenCalledWith({
        skillId: "wiki-dream-loop",
        goal: "Periodic curator pass — propose wiki maintenance but apply nothing.",
        context: "Triggered from the Wiki view. Save only the report after explicit operator approval.",
      });
    });

    expect(await screen.findByText(/Grounded paths reviewed\./i)).toBeInTheDocument();
    expect(screen.getByText(/Report path: wiki\/dreams\/2026-05-11-dream-report\.md/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /save report/i }));
    await waitFor(() => {
      expect(writeWikiPageMock).toHaveBeenCalledWith({
        path: "wiki/dreams/2026-05-11-dream-report.md",
        content: dreamReport,
      });
    });
    expect(await screen.findByText(/Saved: wiki\/dreams\/2026-05-11-dream-report\.md/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /accept/i }));
    await waitFor(() => {
      expect(recordDreamDecisionMock).toHaveBeenCalledWith({
        reportPath: "wiki/dreams/2026-05-11-dream-report.md",
        proposal: "Keep the report as a proposed maintenance page.",
        decision: "accepted",
      });
    });
    expect(await screen.findByText(/Decision saved: accepted/i)).toBeInTheDocument();
  });

  it("runs codex worker panel actions", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(await screen.findByRole("button", { name: /create run/i }));
    expect(window.confirm).toHaveBeenCalledWith(
      expect.stringContaining("OpenAI execution is active"),
    );
    await waitFor(() => expect(createCodexRunMock).toHaveBeenCalled());

    await user.click(screen.getByRole("button", { name: "Plan" }));
    await waitFor(() => expect(planCodexRunMock).toHaveBeenCalledWith("codex-run-1"));

    await user.click(screen.getByRole("button", { name: "Approve step" }));
    await waitFor(() => expect(approveCodexStepMock).toHaveBeenCalledWith("codex-run-1", "step-2"));

    await user.click(screen.getByRole("button", { name: "Execute next" }));
    await waitFor(() => expect(executeNextCodexMock).toHaveBeenCalledWith("codex-run-1"));
    expect(screen.getByText(/stdout written to/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Step output step-1/i)).toHaveTextContent("Fake executor completed step.");

    expect(screen.getByRole("button", { name: "Finalize" })).toBeDisabled();
    expect(screen.getByText(/Finalize blocked:/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalize evidence:/i)).toBeInTheDocument();
    expect(screen.getByText(/completed steps/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelCodexMock).toHaveBeenCalledWith("codex-run-1"));

    expect(screen.getByRole("button", { name: "Finalize" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Open run log" }));
    expect(await screen.findByText(/Run Log - Codex Worker Finalize/i)).toBeInTheDocument();
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalized at:/i)).toBeInTheDocument();
  });
});
