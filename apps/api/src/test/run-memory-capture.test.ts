import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { CaptureRunMemoryResponse, Run, WikiPageResponse } from "@atellier/shared";
import { buildServer } from "../server";

describe("run memory capture", () => {
  let server: FastifyInstance;
  let atelierRoot: string;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-run-memory-test-"));
    server = await buildServer({
      storageMode: "memory",
      atelierRoot,
    });
  });

  afterEach(async () => {
    await server.close();
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("captures a completed run as a synthesis wiki page and log entry", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "review",
        status: "running",
      },
    });
    const run = createResponse.json<Run>();

    const completeResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/complete`,
      payload: {
        summary: "QA approved scoped memory capture",
        reviewStatus: "approved",
        output: {
          validation: {
            role: "qa",
            passed: true,
            issues: [],
            verifiedRepoFiles: [],
            invalidReferencedFiles: [],
            referencedFiles: [],
            candidateFiles: ["apps/api/src/services/run.service.ts"],
            changedFiles: ["apps/api/src/services/run.service.ts"],
          },
        },
      },
    });
    expect(completeResponse.statusCode).toBe(200);

    const captureResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/capture-memory`,
      payload: {
        summary: "Review memory captured from test",
      },
    });

    expect(captureResponse.statusCode).toBe(201);
    const captured = captureResponse.json<CaptureRunMemoryResponse>();
    expect(captured.wikiPath).toMatch(/^wiki\/synthesis\/run-.+review-memory-captured-from-test\.md$/);
    expect(captured.logPath).toContain("log.md");

    const pageResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(captured.wikiPath)}`,
    });
    expect(pageResponse.statusCode).toBe(200);
    const page = pageResponse.json<WikiPageResponse>();
    expect(page.content).toContain("# Run Memory - Review memory captured from test");
    expect(page.content).toContain("- Review: approved");
    expect(page.content).toContain("- Role: qa");
    expect(page.content).toContain("apps/api/src/services/run.service.ts");

    const indexResponse = await server.inject({
      method: "GET",
      url: "/wiki/index",
    });
    expect(indexResponse.json<WikiPageResponse>().content).toContain(captured.wikiPath.replace(/^wiki\//, ""));

    const logResponse = await server.inject({
      method: "GET",
      url: "/wiki/log",
    });
    expect(logResponse.json<WikiPageResponse>().content).toContain("Run memory captured");
  });

  it("rejects memory capture for unfinished runs", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "manual",
        status: "running",
      },
    });
    const run = createResponse.json<Run>();

    const captureResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/capture-memory`,
      payload: {
        summary: "Too early",
      },
    });

    expect(captureResponse.statusCode).toBe(409);
    expect(captureResponse.json()).toEqual({ error: "Only completed runs can be captured as wiki memory." });
  });
});
