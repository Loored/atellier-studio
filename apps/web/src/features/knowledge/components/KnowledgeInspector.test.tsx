import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KnowledgeGraphNode } from "@atellier/shared";
import { KnowledgeInspector } from "./KnowledgeInspector";

const useKnowledgeRoleMemoryApiMock = vi.hoisted(() => vi.fn());

vi.mock("../../../api/hooks/wiki/useWikiApi", () => ({
  useWikiPageApi: vi.fn(() => ({ data: undefined, isFetching: false })),
}));

vi.mock("../../../api/hooks/runs/useRunsApi", () => ({
  useRunsApi: vi.fn(() => ({ data: [] })),
}));

vi.mock("../../../api/hooks/knowledge/useKnowledgeApi", () => ({
  useKnowledgeRoleMemoryApi: useKnowledgeRoleMemoryApiMock,
}));

describe("KnowledgeInspector", () => {
  beforeEach(() => {
    useKnowledgeRoleMemoryApiMock.mockReturnValue({
      data: { generatedAt: "2026-05-16T00:00:00.000Z", roles: [] },
    });
  });

  it("navigates to report wiki node from dream decision details", async () => {
    const user = userEvent.setup();
    const onSelectNode = vi.fn();
    const node: KnowledgeGraphNode = {
      id: "dream-decision:wiki/decisions/2026-05-13-dream-decision-1.md",
      type: "dream-decision",
      layer: "meta",
      label: "Dream accepted",
      path: "wiki/decisions/2026-05-13-dream-decision-1.md",
      quality: "verified",
      metadata: {
        decision: "accepted",
        reportPath: "wiki/dreams/2026-05-13-dream-report.md",
        proposal: "Link orphan pages.",
      },
    };

    render(
      <KnowledgeInspector
        node={node}
        edges={[]}
        nodeLabelById={new Map()}
        onSelectNode={onSelectNode}
        annotation={null}
        isSavingAnnotation={false}
        onSaveAnnotation={vi.fn(async () => {})}
      />,
    );

    await user.click(screen.getByRole("button", { name: "wiki/dreams/2026-05-13-dream-report.md" }));
    expect(onSelectNode).toHaveBeenCalledWith("wiki-page:wiki/dreams/2026-05-13-dream-report.md");
  });

  it("shows durable approved learnings for a role node", () => {
    useKnowledgeRoleMemoryApiMock.mockReturnValue({
      data: {
        generatedAt: "2026-05-16T00:00:00.000Z",
        roles: [
          {
            role: "qa",
            stats: {
              agents: 1,
              tasks: 2,
              runs: 3,
              completed: 2,
              blocked: 0,
              failed: 0,
              pendingReview: 0,
              curatedLearnings: 1,
              curationSignals: 1,
            },
            focus: [],
            blockers: [],
            recentRuns: [],
            learnings: [
              {
                runId: "run-3",
                role: "qa",
                lesson: "Preserve validation evidence for approved deliverables.",
                memoryPath: "wiki/synthesis/run-3.md",
                roleMemoryPath: "wiki/role-memory/qa.md",
                logPath: "wiki/log.md",
                signal: "stale",
                signalPath: "wiki/deliverables/run-3.md",
                capturedAt: "2026-05-16T00:00:00.000Z",
              },
            ],
          },
        ],
      },
    });
    const node: KnowledgeGraphNode = {
      id: "role:qa",
      type: "role",
      layer: "meta",
      label: "QA",
      role: "qa",
      quality: "verified",
    };

    render(
      <KnowledgeInspector
        node={node}
        edges={[]}
        nodeLabelById={new Map()}
        onSelectNode={vi.fn()}
        annotation={null}
        isSavingAnnotation={false}
        onSaveAnnotation={vi.fn(async () => {})}
      />,
    );

    expect(screen.getByText(/Curated learnings: 1 · Curation signals: 1/)).toBeInTheDocument();
    expect(screen.getByText(/Preserve validation evidence for approved deliverables/)).toHaveTextContent(
      "stale: wiki/deliverables/run-3.md",
    );
  });
});
