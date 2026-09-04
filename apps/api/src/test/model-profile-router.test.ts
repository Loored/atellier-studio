import { describe, expect, it } from "vitest";
import { classifyModelProfile } from "../services/model-profile-router";

describe("classifyModelProfile", () => {
  it("routes short routine work to cheap", () => {
    expect(classifyModelProfile("Check the status")).toBe("cheap");
  });
  it("routes ordinary work to standard", () => {
    expect(classifyModelProfile("Prepare a bounded implementation plan")).toBe("standard");
  });
  it("routes risky architectural work to deep", () => {
    expect(classifyModelProfile("Plan the production Mongo migration and rollback")).toBe("deep");
  });
  it("keeps long requests conservative", () => {
    expect(classifyModelProfile(`Summarize ${"the operational context ".repeat(30)}`)).toBe("standard");
  });
});
