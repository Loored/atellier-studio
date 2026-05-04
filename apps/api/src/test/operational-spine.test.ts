import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Agent, AgentMessage, Run, RunAgentResult, Task, WikiPageResponse } from "@atellier/shared";
import { buildServer } from "../server";

describe("operational spine routes", () => {
  let server: FastifyInstance;
  let atelierRoot: string;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-api-test-"));
    server = await buildServer({
      storageMode: "memory",
      atelierRoot,
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("responds to health checks", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: "ok",
      service: "atellier-api",
    });
  });

  it("uses local-first CORS and baseline API security headers", async () => {
    const localResponse = await server.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "http://127.0.0.1:5174",
      },
    });

    expect(localResponse.statusCode).toBe(200);
    expect(localResponse.headers["access-control-allow-origin"]).toBe("http://127.0.0.1:5174");
    expect(localResponse.headers["referrer-policy"]).toBe("no-referrer");
    expect(localResponse.headers["x-content-type-options"]).toBe("nosniff");
    expect(localResponse.headers["x-frame-options"]).toBe("DENY");

    const remoteResponse = await server.inject({
      method: "GET",
      url: "/health",
      headers: {
        origin: "https://example.com",
      },
    });

    expect(remoteResponse.statusCode).toBe(200);
    expect(remoteResponse.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("creates tasks", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "Prepare project spine",
        priority: "high",
      },
    });

    expect(response.statusCode).toBe(201);
    const task = response.json<Task>();
    expect(task.id).toEqual(expect.any(String));
    expect(task.title).toBe("Prepare project spine");
    expect(task.status).toBe("inbox");
    expect(task.priority).toBe("high");
  });

  it("rejects oversized task titles and run log messages", async () => {
    const oversizedTaskResponse = await server.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "x".repeat(161),
      },
    });

    expect(oversizedTaskResponse.statusCode).toBe(400);

    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "manual",
        status: "running",
      },
    });
    const run = createRunResponse.json<Run>();

    const oversizedLogResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/log`,
      payload: {
        message: "x".repeat(1001),
      },
    });

    expect(oversizedLogResponse.statusCode).toBe(400);
  });

  it("creates runs, appends run logs, and writes wiki log on completion", async () => {
    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "manual",
        status: "running",
      },
    });

    expect(createRunResponse.statusCode).toBe(201);
    const run = createRunResponse.json<Run>();

    const appendLogResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/log`,
      payload: {
        level: "info",
        message: "Started manual run",
      },
    });

    expect(appendLogResponse.statusCode).toBe(200);
    expect(appendLogResponse.json<Run>().logs).toHaveLength(1);

    const completeResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/complete`,
      payload: {
        summary: "Manual run accepted",
        output: {
          result: "ok",
        },
      },
    });

    expect(completeResponse.statusCode).toBe(200);
    expect(completeResponse.json<Run>().status).toBe("completed");

    const wikiLogResponse = await server.inject({
      method: "GET",
      url: "/wiki/log",
    });

    expect(wikiLogResponse.statusCode).toBe(200);
    const wikiLog = wikiLogResponse.json<WikiPageResponse>();
    expect(wikiLog.ready).toBe(true);
    expect(wikiLog.content).toContain("run_completed | Manual run accepted");
    expect(wikiLog.content).toContain(`Run ID: ${run.id}`);
  });

  it("executes agent runs and persists agent chat messages", async () => {
    const createAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: {
        name: "Builder Agent",
        role: "builder",
      },
    });

    expect(createAgentResponse.statusCode).toBe(201);
    const agent = createAgentResponse.json<Agent>();

    const runResponse = await server.inject({
      method: "POST",
      url: `/agents/${agent.id}/run`,
      payload: {
        instruction: "Resume implementation and report blockers.",
        context: "Task: execution spine hardening",
      },
    });

    expect(runResponse.statusCode).toBe(200);
    const runResult = runResponse.json<RunAgentResult>();
    expect(runResult.agent.id).toBe(agent.id);
    expect(runResult.agent.status).toBe("needs-human");
    expect(runResult.run.status).toBe("completed");
    expect(runResult.run.logs.length).toBeGreaterThanOrEqual(2);
    expect(runResult.assistantMessage.role).toBe("assistant");

    const messageResponse = await server.inject({
      method: "GET",
      url: `/agents/${agent.id}/messages`,
    });

    expect(messageResponse.statusCode).toBe(200);
    const messageList = messageResponse.json<AgentMessage[]>();
    expect(messageList).toHaveLength(2);
    expect(messageList[0]?.role).toBe("user");
    expect(messageList[1]?.role).toBe("assistant");
  });

  it("supports handoff execution to a second agent", async () => {
    const firstAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: {
        name: "PM Agent",
        role: "pm",
      },
    });
    const firstAgent = firstAgentResponse.json<Agent>();

    const secondAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: {
        name: "Builder Agent",
        role: "builder",
      },
    });
    const secondAgent = secondAgentResponse.json<Agent>();

    const runResponse = await server.inject({
      method: "POST",
      url: `/agents/${firstAgent.id}/run`,
      payload: {
        instruction: "Define technical plan.",
        handoffAgentId: secondAgent.id,
        handoffInstruction: "Implement the first actionable step.",
      },
    });

    expect(runResponse.statusCode).toBe(200);

    const runsResponse = await server.inject({
      method: "GET",
      url: "/runs",
    });
    const runList = runsResponse.json<Run[]>();
    expect(runList.length).toBeGreaterThanOrEqual(2);

    const builderMessagesResponse = await server.inject({
      method: "GET",
      url: `/agents/${secondAgent.id}/messages`,
    });
    expect(builderMessagesResponse.statusCode).toBe(200);
    const builderMessages = builderMessagesResponse.json<AgentMessage[]>();
    expect(builderMessages.some((message) => message.role === "system")).toBe(true);
    expect(builderMessages.some((message) => message.role === "assistant")).toBe(true);
  });

  it("returns 400 for invalid object ids on agent run stream route", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/agents/not-an-id/run/stream",
      payload: {
        instruction: "hello",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Agent id is invalid." });
  });

  it("returns CORS headers for local origins on agent run stream route", async () => {
    const createAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: {
        name: "Designer Agent",
        role: "designer",
      },
    });
    const agent = createAgentResponse.json<Agent>();

    const response = await server.inject({
      method: "POST",
      url: `/agents/${agent.id}/run/stream`,
      headers: {
        origin: "http://localhost:5173",
      },
      payload: {
        instruction: "Draft a concept outline.",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    expect(response.headers["content-type"]).toContain("text/event-stream");
  });
});
