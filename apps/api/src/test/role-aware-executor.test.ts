import { describe, expect, it, vi } from "vitest";
import type { Agent, AgentRole } from "@atellier/shared";
import {
  RoleAwareAgentExecutorService,
  type AgentExecutorService,
  type ExecuteAgentInstructionInput,
  type ExecuteAgentInstructionResult,
} from "../services/agent-executor.service";

function makeAgent(role: AgentRole, name = `agent-${role}`): Agent {
  return {
    id: `id-${role}`,
    name,
    role,
    status: "idle",
    createdAt: "2026-05-10T00:00:00.000Z",
    updatedAt: "2026-05-10T00:00:00.000Z",
  };
}

function makeStubExecutor(label: string): AgentExecutorService & {
  execute: ReturnType<typeof vi.fn>;
} {
  const execute = vi.fn(async (input: ExecuteAgentInstructionInput) => {
    return {
      response: `${label}:${input.agent.role}`,
      needsHuman: true,
    } satisfies ExecuteAgentInstructionResult;
  });
  return { execute };
}

describe("RoleAwareAgentExecutorService", () => {
  it("dispatches to the per-role executor when one is registered for that role", async () => {
    const fallback = makeStubExecutor("fallback");
    const builderExecutor = makeStubExecutor("builder-only");

    const router = new RoleAwareAgentExecutorService(fallback, {
      builder: builderExecutor,
    });

    const result = await router.execute({
      agent: makeAgent("builder"),
      instruction: "build it",
    });

    expect(result.response).toBe("builder-only:builder");
    expect(builderExecutor.execute).toHaveBeenCalledTimes(1);
    expect(fallback.execute).not.toHaveBeenCalled();
  });

  it("falls back to the global executor for roles with no override", async () => {
    const fallback = makeStubExecutor("fallback");
    const builderExecutor = makeStubExecutor("builder-only");

    const router = new RoleAwareAgentExecutorService(fallback, {
      builder: builderExecutor,
    });

    const result = await router.execute({
      agent: makeAgent("pm"),
      instruction: "plan it",
    });

    expect(result.response).toBe("fallback:pm");
    expect(fallback.execute).toHaveBeenCalledTimes(1);
    expect(builderExecutor.execute).not.toHaveBeenCalled();
  });

  it("supports overriding multiple roles independently", async () => {
    const fallback = makeStubExecutor("fallback");
    const builderExecutor = makeStubExecutor("coder");
    const qaExecutor = makeStubExecutor("reasoner");

    const router = new RoleAwareAgentExecutorService(fallback, {
      builder: builderExecutor,
      qa: qaExecutor,
    });

    const builderResult = await router.execute({ agent: makeAgent("builder"), instruction: "x" });
    const qaResult = await router.execute({ agent: makeAgent("qa"), instruction: "y" });
    const designerResult = await router.execute({ agent: makeAgent("designer"), instruction: "z" });

    expect(builderResult.response).toBe("coder:builder");
    expect(qaResult.response).toBe("reasoner:qa");
    expect(designerResult.response).toBe("fallback:designer");

    expect(builderExecutor.execute).toHaveBeenCalledTimes(1);
    expect(qaExecutor.execute).toHaveBeenCalledTimes(1);
    expect(fallback.execute).toHaveBeenCalledTimes(1);
  });

  it("falls back when the perRole map is empty (no overrides configured)", async () => {
    const fallback = makeStubExecutor("fallback");
    const router = new RoleAwareAgentExecutorService(fallback, {});

    const result = await router.execute({ agent: makeAgent("wiki-curator"), instruction: "x" });

    expect(result.response).toBe("fallback:wiki-curator");
    expect(fallback.execute).toHaveBeenCalledTimes(1);
  });
});

export {};
