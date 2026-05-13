import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { KnowledgeGraphNode } from "@atellier/shared";
import { SearchBar } from "./SearchBar";

function makeNode(overrides: Partial<KnowledgeGraphNode> & { id: string; label: string }): KnowledgeGraphNode {
  return {
    type: "wiki-page",
    layer: "wiki",
    quality: "verified",
    ...overrides,
  } as KnowledgeGraphNode;
}

describe("SearchBar", () => {
  it("shows matches as the user types and commits via Enter", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const matches = [
      makeNode({ id: "wiki-page:wiki/log.md", label: "log", path: "wiki/log.md" }),
      makeNode({ id: "wiki-page:wiki/index.md", label: "index", path: "wiki/index.md" }),
    ];

    render(
      <SearchBar query="log" onQueryChange={vi.fn()} matches={matches} onPick={onPick} />,
    );

    const input = screen.getByPlaceholderText("Buscar nodos…");
    await user.click(input);

    expect(screen.getByText("log")).toBeInTheDocument();
    expect(screen.getByText("index")).toBeInTheDocument();

    await user.keyboard("{Enter}");
    expect(onPick).toHaveBeenCalledWith("wiki-page:wiki/log.md");
  });

  it("clears the query when the user presses Escape", async () => {
    const user = userEvent.setup();
    const onQueryChange = vi.fn();

    render(
      <SearchBar query="log" onQueryChange={onQueryChange} matches={[]} onPick={vi.fn()} />,
    );

    const input = screen.getByPlaceholderText("Buscar nodos…");
    await user.click(input);
    await user.keyboard("{Escape}");

    expect(onQueryChange).toHaveBeenCalledWith("");
  });

  it("navigates matches with the arrow keys before committing", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    const matches = [
      makeNode({ id: "wiki-page:a.md", label: "a" }),
      makeNode({ id: "wiki-page:b.md", label: "b" }),
      makeNode({ id: "wiki-page:c.md", label: "c" }),
    ];

    render(
      <SearchBar query="a" onQueryChange={vi.fn()} matches={matches} onPick={onPick} />,
    );

    const input = screen.getByPlaceholderText("Buscar nodos…");
    await user.click(input);
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");

    expect(onPick).toHaveBeenCalledWith("wiki-page:c.md");
  });
});
