import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeGraphNode } from "@atellier/shared";
import { KnowledgeInspector } from "./KnowledgeInspector";

vi.mock("../../../api/hooks/wiki/useWikiApi", () => ({
  useWikiPageApi: vi.fn(() => ({ data: undefined, isFetching: false })),
}));

vi.mock("../../../api/hooks/runs/useRunsApi", () => ({
  useRunsApi: vi.fn(() => ({ data: [] })),
}));

describe("KnowledgeInspector", () => {
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
});
