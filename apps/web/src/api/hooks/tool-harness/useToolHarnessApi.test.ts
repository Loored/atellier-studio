import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { queryKeys } from "../../query/queryKeys";
import { refreshToolHarnessState } from "./useToolHarnessApi";

describe("Tool Harness API cache recovery", () => {
  it("refreshes governance state and system health through centralized query keys", async () => {
    const invalidateQueries = vi.fn().mockResolvedValue(undefined);

    await refreshToolHarnessState({ invalidateQueries } as unknown as QueryClient);

    expect(invalidateQueries).toHaveBeenCalledTimes(2);
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.toolHarness.all });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: queryKeys.system.health });
  });
});
