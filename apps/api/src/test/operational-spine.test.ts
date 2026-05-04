import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Run, Task, WikiPageResponse } from "@atellier/shared";
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
});
