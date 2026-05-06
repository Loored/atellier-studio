import { render, screen, waitFor } from "@testing-library/react";
import { within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { queryClient } from "./api/query/queryClient";
import { wikiService } from "./api/services/wiki.service";

const createTaskMock = vi.hoisted(() => vi.fn());
const appendLogMock = vi.hoisted(() => vi.fn());
const updateRunReviewMock = vi.hoisted(() => vi.fn());
const promoteDeliverableMock = vi.hoisted(() => vi.fn());
const unlinkDeliverableMock = vi.hoisted(() => vi.fn());
const startSkillOrchestrationMock = vi.hoisted(() => vi.fn());
const ingestWikiMock = vi.hoisted(() => vi.fn());
const queryWikiMock = vi.hoisted(() => vi.fn());
const lintWikiMock = vi.hoisted(() => vi.fn());
const writeWikiPageMock = vi.hoisted(() => vi.fn());
const createCodexRunMock = vi.hoisted(() => vi.fn());
const getCodexRunMock = vi.hoisted(() => vi.fn());
const planCodexRunMock = vi.hoisted(() => vi.fn());
const approveCodexStepMock = vi.hoisted(() => vi.fn());
const executeNextCodexMock = vi.hoisted(() => vi.fn());
const cancelCodexMock = vi.hoisted(() => vi.fn());
const finalizeCodexMock = vi.hoisted(() => vi.fn());

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
    list: vi.fn().mockResolvedValue([
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
    ]),
    create: vi.fn(),
    appendLog: appendLogMock,
    complete: vi.fn(),
    updateReview: updateRunReviewMock,
    promoteDeliverable: promoteDeliverableMock,
    unlinkDeliverable: unlinkDeliverableMock,
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
    ]),
    startSkillRun: startSkillOrchestrationMock,
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
    appendLog: vi.fn(),
    readPage: vi.fn(),
    ingest: ingestWikiMock,
    query: queryWikiMock,
    lint: lintWikiMock,
    writePage: writeWikiPageMock,
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

describe("App", () => {
  beforeEach(() => {
    Object.defineProperty(window, "confirm", {
      writable: true,
      value: vi.fn(() => true),
    });
    vi.clearAllMocks();
    queryClient.clear();
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
    startSkillOrchestrationMock.mockResolvedValue({
      skillId: "atellier-build-loop",
      goal: "Build orchestration",
      orchestrationRun: {
        id: "run-4",
        type: "orchestration",
        status: "completed",
        logs: [],
        createdAt: "2026-05-04T00:00:00.000Z",
        updatedAt: "2026-05-04T00:00:00.000Z",
      },
      steps: [],
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
    });
    lintWikiMock.mockResolvedValue({
      ok: true,
      issues: [],
      checkedAt: "2026-05-05T00:00:00.000Z",
    });
    writeWikiPageMock.mockResolvedValue({
      path: "wiki/notes/wiki-brain-v2.md",
      content: "# Wiki Brain v2\n\n- Safe write route active.",
      ready: true,
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
          output: "Fake executor completed step.",
          stdoutPath: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stdout.log",
          stderrPath: "runs/artifacts/2026-05-05-codex-worker-codex-run-1-step-1-step-1.stderr.log",
        },
        {
          id: "step-2",
          summary: "Implement bounded change and update tests",
          status: "pending",
          needsApproval: true,
          riskLevel: "medium",
          command: "pnpm test:api",
        },
      ],
    });
    planCodexRunMock.mockResolvedValue({});
    approveCodexStepMock.mockResolvedValue({});
    executeNextCodexMock.mockResolvedValue({});
    cancelCodexMock.mockResolvedValue({});
    finalizeCodexMock.mockResolvedValue({});
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
    expect(await screen.findByText("openai")).toBeInTheDocument();
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

    await user.click(screen.getByRole("button", { name: /promote to draft/i }));
    expect((screen.getByLabelText("Wiki path") as HTMLInputElement).value).toContain("wiki/notes/query-");
    expect((screen.getByLabelText("Markdown content") as HTMLTextAreaElement).value).toContain("## Source");

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
    expect(screen.getByText(/stdout:/i)).toBeInTheDocument();
    expect(screen.getByText(/Fake executor completed step\./i)).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Finalize" })).toBeDisabled();
    expect(screen.getByText(/Finalize blocked:/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(cancelCodexMock).toHaveBeenCalledWith("codex-run-1"));

    expect(screen.getByRole("button", { name: "Finalize" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Open run log" }));
    expect(await screen.findByText(/Run Log - Codex Worker Finalize/i)).toBeInTheDocument();
    expect(screen.getByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/Finalized at:/i)).toBeInTheDocument();
  });
});
