import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { queryClient } from "./api/query/queryClient";

const createTaskMock = vi.hoisted(() => vi.fn());
const appendLogMock = vi.hoisted(() => vi.fn());

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
    ]),
    create: vi.fn(),
    appendLog: appendLogMock,
    complete: vi.fn(),
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
  },
}));

describe("App", () => {
  beforeEach(() => {
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
  });

  it("renders the dashboard with operational data", async () => {
    render(<App />);

    expect(await screen.findByText("Atellier Studio")).toBeInTheDocument();
    expect(await screen.findByText("Builder Agent")).toBeInTheDocument();
    expect(await screen.findByText("Prepare project spine")).toBeInTheDocument();
    expect(await screen.findByText("Wiki Log")).toBeInTheDocument();
  });

  it("creates a task through the dashboard form", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.type(await screen.findByLabelText("Task title"), "Review V3");
    await user.click(screen.getByRole("button", { name: /create/i }));

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

    await user.type(await screen.findByLabelText("Run log message for manual run"), "Reviewed V3");
    await user.click(screen.getByRole("button", { name: "Append log" }));

    await waitFor(() => {
      expect(appendLogMock).toHaveBeenCalledWith("run-1", {
        level: "info",
        message: "Reviewed V3",
      });
    });
  });
});
