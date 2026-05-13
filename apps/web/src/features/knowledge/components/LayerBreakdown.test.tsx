import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LayerBreakdown } from "./LayerBreakdown";

describe("LayerBreakdown", () => {
  it("renders each layer with its count and percentage", () => {
    render(
      <LayerBreakdown
        byLayer={{ wiki: 14, raw: 5, runtime: 46, meta: 8 }}
        total={73}
      />,
    );

    expect(screen.getByText("Wiki")).toBeInTheDocument();
    expect(screen.getByText("Raw")).toBeInTheDocument();
    expect(screen.getByText("Runtime")).toBeInTheDocument();
    expect(screen.getByText("Meta")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
    expect(screen.getByText("46")).toBeInTheDocument();
    expect(screen.getByText("19%")).toBeInTheDocument();
    expect(screen.getByText("63%")).toBeInTheDocument();
  });

  it("renders zero values without crashing on empty stats", () => {
    render(
      <LayerBreakdown byLayer={{ wiki: 0, raw: 0, runtime: 0, meta: 0 }} total={0} />,
    );

    expect(screen.getAllByText("0").length).toBeGreaterThanOrEqual(4);
    expect(screen.getAllByText("0%").length).toBeGreaterThanOrEqual(4);
  });
});
