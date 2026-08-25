import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  CurateRunLearningResponse,
  KnowledgeGraphResponse,
  RoleMemoryResponse,
  Run,
  WikiLintResponse,
  WikiPageResponse,
} from "@atellier/shared";
import { buildServer } from "../server";

describe("review-to-memory learning", () => {
  let server: FastifyInstance;
  let atelierRoot: string;

  beforeEach(async () => {
    atelierRoot = await mkdtemp(path.join(tmpdir(), "atellier-review-learning-test-"));
    server = await buildServer({ storageMode: "memory", atelierRoot });
  });

  afterEach(async () => {
    await server.close();
    await rm(atelierRoot, { recursive: true, force: true });
  });

  it("curates approved memory into durable role learning and explicit curation signals once", async () => {
    const targetPath = "wiki/notes/review-target.md";
    await server.inject({
      method: "POST",
      url: "/wiki/page",
      payload: {
        path: targetPath,
        content: "# Review Target\n\nThis page may be stale after the approved implementation.",
      },
    });

    const run = await createApprovedRun(server);
    const captureResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/capture-memory`,
      payload: { summary: "Approved runtime retry pattern" },
    });
    expect(captureResponse.statusCode).toBe(201);

    const curatePayload = {
      role: "builder",
      lesson: "Prefer lease-safe retries that reuse completed orchestration steps.",
      signal: "stale",
      signalPath: targetPath,
    };
    const curateResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/curate-learning`,
      payload: curatePayload,
    });
    expect(curateResponse.statusCode).toBe(201);
    const curated = curateResponse.json<CurateRunLearningResponse>();
    expect(curated.roleMemoryPath).toBe("wiki/role-memory/builder.md");
    expect(curated.run.memory?.learning).toMatchObject({
      runId: run.id,
      role: "builder",
      lesson: curatePayload.lesson,
      signal: "stale",
      signalPath: targetPath,
      roleMemoryPath: "wiki/role-memory/builder.md",
    });

    const repeatedResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/curate-learning`,
      payload: curatePayload,
    });
    expect(repeatedResponse.statusCode).toBe(201);
    expect(repeatedResponse.json<CurateRunLearningResponse>().roleMemoryPath).toBe(curated.roleMemoryPath);

    const conflictingResponse = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/curate-learning`,
      payload: { ...curatePayload, lesson: "A different irreversible learning." },
    });
    expect(conflictingResponse.statusCode).toBe(409);
    expect(conflictingResponse.json()).toEqual({
      error: "Run already has curated role learning with different content.",
    });

    const rolePageResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(curated.roleMemoryPath)}`,
    });
    const rolePage = rolePageResponse.json<WikiPageResponse>().content;
    expect(rolePage).toContain("# Role Memory - builder");
    expect(rolePage).toContain(curatePayload.lesson);
    expect(rolePage.match(/atellier-review-learning/g)).toHaveLength(1);

    const roleMemoryResponse = await server.inject({ method: "GET", url: "/knowledge/role-memory" });
    const builderMemory = roleMemoryResponse
      .json<RoleMemoryResponse>()
      .roles.find((entry) => entry.role === "builder");
    expect(builderMemory?.stats).toMatchObject({ curatedLearnings: 1, curationSignals: 1 });
    expect(builderMemory?.learnings).toEqual([
      expect.objectContaining({ runId: run.id, lesson: curatePayload.lesson, signal: "stale" }),
    ]);

    const lintResponse = await server.inject({ method: "POST", url: "/wiki/lint", payload: {} });
    const lint = lintResponse.json<WikiLintResponse>();
    expect(lint.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: "curation_signal",
          path: targetPath,
          message: expect.stringContaining("marks this page as stale"),
        }),
      ]),
    );

    const graphResponse = await server.inject({ method: "GET", url: "/knowledge/graph" });
    const graph = graphResponse.json<KnowledgeGraphResponse>();
    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: `lint:curation_signal:${targetPath}`,
          quality: "stale",
        }),
      ]),
    );

    const logResponse = await server.inject({ method: "GET", url: "/wiki/log" });
    const log = logResponse.json<WikiPageResponse>().content;
    expect(log.match(/Approved review learning curated/g)).toHaveLength(1);
  });

  it("requires captured memory and an existing Wiki target for curation signals", async () => {
    const run = await createApprovedRun(server);
    const beforeMemory = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/curate-learning`,
      payload: { role: "qa", lesson: "Preserve validation evidence." },
    });
    expect(beforeMemory.statusCode).toBe(409);
    expect(beforeMemory.json()).toEqual({ error: "Capture run memory before curating role learning." });

    await server.inject({
      method: "POST",
      url: `/runs/${run.id}/capture-memory`,
      payload: { summary: "Approved QA memory" },
    });
    const missingTarget = await server.inject({
      method: "POST",
      url: `/runs/${run.id}/curate-learning`,
      payload: {
        role: "qa",
        lesson: "Preserve validation evidence.",
        signal: "contradiction",
        signalPath: "wiki/notes/missing.md",
      },
    });
    expect(missingTarget.statusCode).toBe(409);
    expect(missingTarget.json()).toEqual({
      error: "Role learning signal path must reference an existing Wiki page.",
    });
  });
});

async function createApprovedRun(server: FastifyInstance): Promise<Run> {
  const createResponse = await server.inject({
    method: "POST",
    url: "/runs",
    payload: { type: "build", status: "running" },
  });
  const run = createResponse.json<Run>();
  const completeResponse = await server.inject({
    method: "PATCH",
    url: `/runs/${run.id}/complete`,
    payload: {
      summary: "Approved build outcome",
      reviewStatus: "approved",
      output: {
        validation: {
          role: "qa",
          passed: true,
          issues: [],
          verifiedRepoFiles: [],
          invalidReferencedFiles: [],
          referencedFiles: [],
          candidateFiles: [],
          changedFiles: [],
        },
      },
    },
  });
  expect(completeResponse.statusCode).toBe(200);
  return completeResponse.json<Run>();
}
