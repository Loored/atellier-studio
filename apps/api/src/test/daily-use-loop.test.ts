import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CaptureRunMemoryResponse,
  OrchestrationStatusResult,
  Run,
  StartSkillOrchestrationResponse,
  Task,
  WikiIngestResponse,
  WikiPageResponse,
} from "@atellier/shared";
import { buildServer } from "../server";
import { createAppServices, type AppServices } from "../services/app-services";

describe("daily-use operational loop", () => {
  let server: FastifyInstance;
  let services: AppServices;
  let atelierRoot: string;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-daily-loop-test-"));
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
  });

  afterEach(async () => {
    await server.close();
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("carries source grounding through task, orchestration, review, and idempotent memory capture", async () => {
    const ingestResponse = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Daily client brief",
        content: "Build the smallest useful linked workflow and preserve its source chain.",
        sourceType: "client",
      },
    });
    expect(ingestResponse.statusCode).toBe(201);
    const ingest = ingestResponse.json<WikiIngestResponse>();

    const taskResponse = await server.inject({
      method: "POST",
      url: "/tasks",
      payload: {
        title: "Implement the linked daily workflow",
        description: `Grounded in ${ingest.summaryPagePath} (raw: ${ingest.rawPath}).`,
        sourceIds: [ingest.rawPath, ingest.summaryPagePath],
        status: "inbox",
        priority: "medium",
      },
    });
    expect(taskResponse.statusCode).toBe(201);
    const task = taskResponse.json<Task>();

    const startResponse = await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: {
        goal: "Implement and validate the linked task.",
        context: "Keep the result suitable for daily use.",
        taskId: task.id,
      },
    });
    expect(startResponse.statusCode).toBe(202);
    const started = startResponse.json<StartSkillOrchestrationResponse>();
    expect((await services.tasks.getById(task.id))?.status).toBe("active");

    expect(await services.durableRuntime.runOnce()).toBe(true);

    const statusResponse = await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    });
    const status = statusResponse.json<OrchestrationStatusResult>();
    expect(status).toMatchObject({
      orchestrationRunId: started.runId,
      taskId: task.id,
      status: "completed",
    });
    expect(status.steps.every((step) => step.status === "completed")).toBe(true);

    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun).toMatchObject({
      taskId: task.id,
      status: "completed",
      reviewStatus: "pending",
    });
    expect(completedRun?.deliverablePath).toContain(`wiki/deliverables/${started.runId}-`);
    expect((await services.tasks.getById(task.id))?.status).toBe("review");

    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const firstContext = (childRuns[0]?.input as { context?: string } | undefined)?.context ?? "";
    expect(firstContext).toContain("Linked Task Grounding");
    expect(firstContext).toContain(task.title);
    expect(firstContext).toContain(ingest.rawPath);
    expect(firstContext).toContain(ingest.summaryPagePath);

    const prematureMemoryResponse = await server.inject({
      method: "POST",
      url: `/runs/${started.runId}/capture-memory`,
      payload: { summary: "Approved operational outcome" },
    });
    expect(prematureMemoryResponse.statusCode).toBe(409);

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const reviewResponse = await server.inject({
        method: "PATCH",
        url: `/runs/${started.runId}/review`,
        payload: { reviewStatus: "approved" },
      });
      expect(reviewResponse.statusCode).toBe(200);
    }

    const firstCaptureResponse = await server.inject({
      method: "POST",
      url: `/runs/${started.runId}/capture-memory`,
      payload: { summary: "Approved operational outcome" },
    });
    const repeatedCaptureResponse = await server.inject({
      method: "POST",
      url: `/runs/${started.runId}/capture-memory`,
      payload: { summary: "Approved operational outcome" },
    });
    expect(firstCaptureResponse.statusCode).toBe(201);
    expect(repeatedCaptureResponse.statusCode).toBe(201);

    const firstCapture = firstCaptureResponse.json<CaptureRunMemoryResponse>();
    const repeatedCapture = repeatedCaptureResponse.json<CaptureRunMemoryResponse>();
    expect(repeatedCapture.wikiPath).toBe(firstCapture.wikiPath);
    expect(firstCapture.run.memory?.wikiPath).toBe(firstCapture.wikiPath);
    expect((await services.tasks.getById(task.id))?.status).toBe("done");

    const finalRunResponse = await server.inject({ method: "GET", url: `/runs/${started.runId}` });
    expect(finalRunResponse.json<Run>().memory?.wikiPath).toBe(firstCapture.wikiPath);

    const logResponse = await server.inject({ method: "GET", url: "/wiki/log" });
    const log = logResponse.json<WikiPageResponse>().content;
    expect(log.match(new RegExp(`Run ID: ${started.runId}`, "g"))?.length).toBe(3);
    expect(log.match(/Deliverable accepted/g)).toHaveLength(1);
    expect(log.match(/Run memory captured/g)).toHaveLength(1);
  });
});
