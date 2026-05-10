import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type {
  Agent,
  AgentMessage,
  OrchestrationSkillSummary,
  OrchestrationStatusResult,
  Run,
  RunAgentResult,
  StartSkillOrchestrationResponse,
  Task,
  WikiPageResponse,
} from "@atellier/shared";
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
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        await rm(atelierRoot, { recursive: true, force: true });
        break;
      } catch (error) {
        if (attempt === 4) {
          throw error;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
    }
  });

  it("responds to health checks", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/health",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: "ok",
      service: "atellier-api",
      storageMode: "memory",
      executorMode: "mock",
      executorModel: "mock",
      modelProfile: "standard",
      mongo: {
        connected: false,
      },
      metrics: {
        agentsTotal: 0,
        waitingAgents: 0,
      },
      memory: {
        rssBytes: expect.any(Number),
        heapUsedBytes: expect.any(Number),
      },
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

  it("blocks approving runs with failed validation", async () => {
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

    const completeRunResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/complete`,
      payload: {
        summary: "Validation fixture",
        output: {
          validation: {
            role: "builder",
            passed: false,
            issues: [
              {
                code: "builder.unverified_changed_file",
                message: "Builder referenced an unverified file: apps/web/src/features/wiki/WikiView.tsx",
                severity: "error",
              },
            ],
            verifiedRepoFiles: ["apps/api/src/services/wiki.service.ts"],
            invalidReferencedFiles: ["apps/web/src/features/wiki/WikiView.tsx"],
            referencedFiles: ["apps/web/src/features/wiki/WikiView.tsx"],
            candidateFiles: [],
            changedFiles: ["apps/web/src/features/wiki/WikiView.tsx"],
          },
        },
      },
    });

    expect(completeRunResponse.statusCode).toBe(200);

    const approveResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/review`,
      payload: {
        reviewStatus: "approved",
      },
    });

    expect(approveResponse.statusCode).toBe(409);
    expect(approveResponse.json()).toMatchObject({
      error: expect.stringContaining("Run validation blocked approval"),
    });
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

  it("updates agent instructions", async () => {
    const createAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: {
        name: "Research Agent",
        role: "intake",
      },
    });
    const agent = createAgentResponse.json<Agent>();

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/agents/${agent.id}/instructions`,
      payload: {
        instructions: "Always summarize sources and cite evidence.",
      },
    });

    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json<Agent>().instructions).toContain("summarize sources");
  });

  it("stores review and deliverable fields on run completion", async () => {
    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "build",
        status: "running",
      },
    });
    const run = createRunResponse.json<Run>();

    const completeResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/complete`,
      payload: {
        summary: "Deliverable generated",
        reviewStatus: "pending",
        deliverablePath: "atelier/wiki/deliverables/sample.md",
        output: {
          result: "ok",
        },
      },
    });

    expect(completeResponse.statusCode).toBe(200);
    const completed = completeResponse.json<Run>();
    expect(completed.reviewStatus).toBe("pending");
    expect(completed.deliverablePath).toBe("atelier/wiki/deliverables/sample.md");
  });

  it("assigns default review status on completion by run type", async () => {
    const manualRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "manual",
        status: "running",
      },
    });
    const manualRun = manualRunResponse.json<Run>();
    const manualCompleteResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${manualRun.id}/complete`,
      payload: {
        summary: "Manual done",
        output: {
          result: "ok",
        },
      },
    });
    expect(manualCompleteResponse.statusCode).toBe(200);
    const completedManualRun = manualCompleteResponse.json<Run>();
    expect(completedManualRun.reviewStatus).toBe("pending");
    expect(completedManualRun.deliverablePath).toContain(`wiki/deliverables/${manualRun.id}-manual-done.md`);

    const reviewRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "review",
        status: "running",
      },
    });
    const reviewRun = reviewRunResponse.json<Run>();
    const reviewCompleteResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${reviewRun.id}/complete`,
      payload: {
        summary: "QA review done",
      },
    });
    expect(reviewCompleteResponse.statusCode).toBe(200);
    const completedReviewRun = reviewCompleteResponse.json<Run>();
    expect(completedReviewRun.reviewStatus).toBe("approved");

    const deliverablePageResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(completedManualRun.deliverablePath ?? "")}`,
    });
    expect(deliverablePageResponse.statusCode).toBe(200);
    expect(deliverablePageResponse.json<WikiPageResponse>().content).toContain("# Manual done");
  });

  it("updates review status for completed runs", async () => {
    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "review",
        status: "completed",
      },
    });
    const run = createRunResponse.json<Run>();

    const updateReviewResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/review`,
      payload: {
        reviewStatus: "approved",
      },
    });

    expect(updateReviewResponse.statusCode).toBe(200);
    expect(updateReviewResponse.json<Run>().reviewStatus).toBe("approved");

    const wikiLogResponse = await server.inject({
      method: "GET",
      url: "/wiki/log",
    });
    expect(wikiLogResponse.statusCode).toBe(200);
    expect(wikiLogResponse.json<WikiPageResponse>().content).toContain("decision | Deliverable accepted");
  });

  it("reads a wiki page by relative path", async () => {
    const response = await server.inject({
      method: "GET",
      url: "/wiki/page?path=wiki/log.md",
    });

    expect(response.statusCode).toBe(200);
    const page = response.json<WikiPageResponse>();
    expect(page.path).toBe("wiki/log.md");
    expect(page.ready).toBe(true);
    expect(page.content).toContain("Atellier Studio Wiki Log");
  });

  it("promotes an existing run to deliverable and refreshes deliverables index", async () => {
    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "build",
        status: "completed",
      },
    });
    const run = createRunResponse.json<Run>();

    const promoteResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/promote-deliverable`,
    });
    expect(promoteResponse.statusCode).toBe(200);
    const promotedRun = promoteResponse.json<Run>();
    expect(promotedRun.deliverablePath).toContain(`wiki/deliverables/${run.id}-run-`);

    const deliverablesIndexResponse = await server.inject({
      method: "GET",
      url: "/wiki/page?path=wiki/deliverables/index.md",
    });
    expect(deliverablesIndexResponse.statusCode).toBe(200);
    const deliverablesIndex = deliverablesIndexResponse.json<WikiPageResponse>();
    expect(deliverablesIndex.content).toContain("Deliverables Index");
    expect(deliverablesIndex.content).toContain("| Type | Review |");
    expect(deliverablesIndex.content).toContain(run.id);
    expect(deliverablesIndex.content).toContain("| build | pending |");
  });

  it("unlinks a run deliverable and updates deliverables index", async () => {
    const createRunResponse = await server.inject({
      method: "POST",
      url: "/runs",
      payload: {
        type: "build",
        status: "running",
      },
    });
    const run = createRunResponse.json<Run>();
    await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/complete`,
      payload: {
        summary: "Deliverable for unlink test",
      },
    });

    const unlinkResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${run.id}/unlink-deliverable`,
    });
    expect(unlinkResponse.statusCode).toBe(200);
    const unlinkedRun = unlinkResponse.json<Run>();
    expect(unlinkedRun.deliverablePath).toBeUndefined();

    const deliverablesIndexResponse = await server.inject({
      method: "GET",
      url: "/wiki/page?path=wiki/deliverables/index.md",
    });
    expect(deliverablesIndexResponse.statusCode).toBe(200);
    const deliverablesIndex = deliverablesIndexResponse.json<WikiPageResponse>();
    expect(deliverablesIndex.content).toContain("Deliverables Index");
    expect(deliverablesIndex.content).not.toContain(run.id);
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

  it("lists and starts skill-driven orchestrations", async () => {
    const skillsResponse = await server.inject({
      method: "GET",
      url: "/orchestrations/skills",
    });

    expect(skillsResponse.statusCode).toBe(200);
    const skillList = skillsResponse.json<OrchestrationSkillSummary[]>();
    expect(skillList.some((skill) => skill.id === "atellier-build-loop")).toBe(true);

    const startResponse = await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: {
        goal: "Build a visible orchestration loop for Atellier agents.",
        context: "Keep it local-first and use the existing agent run spine.",
      },
    });

    expect(startResponse.statusCode).toBe(202);
    const started = startResponse.json<StartSkillOrchestrationResponse>();
    expect(started.runId).toEqual(expect.any(String));

    const statusResponse = await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    });
    expect(statusResponse.statusCode).toBe(200);
    let status = statusResponse.json<OrchestrationStatusResult>();
    expect(status.skillId).toBe("atellier-build-loop");
    expect(status.orchestrationRunId).toBe(started.runId);
    expect(status.steps.length).toBeGreaterThan(0);

    for (let attempt = 0; attempt < 20 && status.status !== "completed"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const nextStatusResponse = await server.inject({
        method: "GET",
        url: `/orchestrations/${started.runId}/status`,
      });
      if (nextStatusResponse.statusCode !== 200) {
        continue;
      }
      status = nextStatusResponse.json<OrchestrationStatusResult>();
    }
    expect(status.status).toBe("completed");

    const runsResponse = await server.inject({
      method: "GET",
      url: "/runs",
    });
    const runList = runsResponse.json<Run[]>();
    expect(runList.some((run) => run.id === started.runId)).toBe(true);

    const wikiLogResponse = await server.inject({
      method: "GET",
      url: "/wiki/log",
    });
    expect(wikiLogResponse.json<WikiPageResponse>().content).toContain(
      "run_completed | Pepe PM completed execution and requests review.",
    );
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

  it("ingests wiki content into raw and source summary pages", async () => {
    const ingestResponse = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Client meeting notes",
        content: "Need a deterministic wiki ingest flow with source preservation and summary output.",
        sourceType: "client",
      },
    });

    expect(ingestResponse.statusCode).toBe(201);
    const ingest = ingestResponse.json<{ rawPath: string; summaryPagePath: string; logPath: string }>();
    expect(ingest.rawPath).toContain("raw/ingest/");
    expect(ingest.summaryPagePath).toContain("wiki/sources/");
    expect(ingest.logPath).toBe("wiki/log.md");
    expect(Array.isArray((ingestResponse.json() as { proposedTasks?: unknown[] }).proposedTasks)).toBe(true);

    const rawPageResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(ingest.rawPath)}`,
    });
    expect(rawPageResponse.statusCode).toBe(200);
    expect(rawPageResponse.json<WikiPageResponse>().content).toContain("## Content");

    const summaryPageResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(ingest.summaryPagePath)}`,
    });
    expect(summaryPageResponse.statusCode).toBe(200);
    expect(summaryPageResponse.json<WikiPageResponse>().content).toContain("## Summary");
  });

  it("updates wiki index with source summary rows on ingest", async () => {
    const ingestResponse = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Weekly sync notes",
        content: "Action item: implement deterministic wiki indexing.",
        sourceType: "note",
      },
    });
    expect(ingestResponse.statusCode).toBe(201);

    const indexResponse = await server.inject({
      method: "GET",
      url: "/wiki/index",
    });
    expect(indexResponse.statusCode).toBe(200);
    const indexContent = indexResponse.json<WikiPageResponse>().content;
    expect(indexContent).toContain("sources/");
    expect(indexContent).toContain("Source summary generated from deterministic ingest.");
  });

  it("queries wiki content deterministically", async () => {
    await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Research chunk",
        content: "Atellier should keep memory in markdown and preserve raw sources first.",
        sourceType: "note",
      },
    });

    const queryResponse = await server.inject({
      method: "POST",
      url: "/wiki/query",
      payload: {
        query: "preserve raw sources",
        limit: 3,
        sourceType: "note",
      },
    });

    expect(queryResponse.statusCode).toBe(200);
    const queryResult = queryResponse.json<{
      query: string;
      matches: Array<{ path: string; snippet: string }>;
      relatedPages: Array<{ path: string; summary: string; reason: string }>;
      contradictions: Array<{ primaryPath: string; conflictingPath: string; reason: string }>;
    }>();
    expect(queryResult.query).toBe("preserve raw sources");
    expect(queryResult.matches.length).toBeGreaterThan(0);
    expect(queryResult.matches.some((match) => match.path.startsWith("wiki/"))).toBe(true);
    expect(Array.isArray(queryResult.relatedPages)).toBe(true);
    expect(Array.isArray(queryResult.contradictions)).toBe(true);
  });

  it("writes a wiki page through the safe write route", async () => {
    const writeResponse = await server.inject({
      method: "POST",
      url: "/wiki/page",
      payload: {
        path: "wiki/notes/wiki-brain-v2.md",
        content: "# Wiki Brain v2\n\n- Add safe write path.\n",
      },
    });
    expect(writeResponse.statusCode).toBe(201);
    expect(writeResponse.json<WikiPageResponse>().path).toBe("wiki/notes/wiki-brain-v2.md");

    const pageResponse = await server.inject({
      method: "GET",
      url: "/wiki/page?path=wiki/notes/wiki-brain-v2.md",
    });
    expect(pageResponse.statusCode).toBe(200);
    expect(pageResponse.json<WikiPageResponse>().content).toContain("Wiki Brain v2");

    const logResponse = await server.inject({
      method: "GET",
      url: "/wiki/log",
    });
    expect(logResponse.statusCode).toBe(200);
    expect(logResponse.json<WikiPageResponse>().content).toContain("wiki_write | Wiki page updated");
  });

  it("rejects unsafe wiki write paths", async () => {
    const outsideWrite = await server.inject({
      method: "POST",
      url: "/wiki/page",
      payload: {
        path: "tasks/inbox.md",
        content: "# Not allowed",
      },
    });
    expect(outsideWrite.statusCode).toBe(400);

    const reservedWrite = await server.inject({
      method: "POST",
      url: "/wiki/page",
      payload: {
        path: "wiki/log.md",
        content: "# Not allowed",
      },
    });
    expect(reservedWrite.statusCode).toBe(400);

    const invalidCategory = await server.inject({
      method: "POST",
      url: "/wiki/page",
      payload: {
        path: "wiki/random/custom.md",
        content: "# Not allowed",
      },
    });
    expect(invalidCategory.statusCode).toBe(400);
  });

  it("ranks wiki query matches deterministically by relevance and path", async () => {
    await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Alpha deterministic notes",
        content: "deterministic deterministic deterministic pipeline details.",
        sourceType: "note",
      },
    });

    await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Beta deterministic notes",
        content: "deterministic pipeline baseline.",
        sourceType: "note",
      },
    });

    const queryResponse = await server.inject({
      method: "POST",
      url: "/wiki/query",
      payload: {
        query: "deterministic",
        limit: 1,
        sourceType: "note",
      },
    });

    expect(queryResponse.statusCode).toBe(200);
    const queryResult = queryResponse.json<{
      matches: Array<{ path: string }>;
      relatedPages: Array<{ path: string }>;
      contradictions: Array<{ primaryPath: string; conflictingPath: string }>;
    }>();
    expect(queryResult.matches).toHaveLength(1);
    expect(queryResult.matches[0]?.path).toContain("alpha-deterministic-notes");
  });

  it("lints wiki pages and returns a deterministic report", async () => {
    const lintResponse = await server.inject({
      method: "POST",
      url: "/wiki/lint",
    });

    expect(lintResponse.statusCode).toBe(200);
    const lint = lintResponse.json<{ ok: boolean; issues: Array<{ code: string }>; checkedAt: string }>();
    expect(typeof lint.ok).toBe("boolean");
    expect(Array.isArray(lint.issues)).toBe(true);
    expect(lint.checkedAt).toEqual(expect.any(String));
  });

  it("reports broken raw references in wiki source summaries", async () => {
    const sourcePath = path.join(atelierRoot, "wiki", "sources", "broken-source.md");
    await mkdir(path.dirname(sourcePath), { recursive: true });
    await writeFile(
      sourcePath,
      [
        "# Broken source",
        "",
        "## Source",
        "",
        "- Raw path: raw/ingest/does-not-exist.md",
        "- Source type: note",
        "",
        "## Summary",
        "",
        "Missing raw file reference test.",
        "",
      ].join("\n"),
      "utf8",
    );

    const lintResponse = await server.inject({
      method: "POST",
      url: "/wiki/lint",
    });

    expect(lintResponse.statusCode).toBe(200);
    const lint = lintResponse.json<{ issues: Array<{ code: string; path: string; message: string; suggestion?: string }> }>();
    expect(
      lint.issues.some(
        (issue) =>
          issue.code === "broken_link" &&
          issue.path === "wiki/sources/broken-source.md" &&
          issue.message.includes("Raw source reference is missing") &&
          issue.suggestion?.includes("Fix the Raw path reference"),
      ),
    ).toBe(true);
  });

  it("reports duplicate wiki index entries", async () => {
    const indexPath = path.join(atelierRoot, "wiki", "index.md");
    await writeFile(
      indexPath,
      [
        "# Atellier Studio Wiki Index",
        "",
        "| Path | Summary | Category | Last updated | Source count |",
        "| --- | --- | --- | --- | --- |",
        "| [log.md](./log.md) | base log | operations | 2026-05-05 | 0 |",
        "| [log.md](./log.md) | duplicate row | operations | 2026-05-05 | 0 |",
        "",
      ].join("\n"),
      "utf8",
    );

    const lintResponse = await server.inject({
      method: "POST",
      url: "/wiki/lint",
    });

    expect(lintResponse.statusCode).toBe(200);
    const lint = lintResponse.json<{ issues: Array<{ code: string; path: string; message: string; suggestion?: string }> }>();
    expect(
      lint.issues.some(
        (issue) =>
          issue.code === "stale_index_entry" &&
          issue.path === "wiki/log.md" &&
          issue.message.includes("duplicate entries") &&
          issue.suggestion?.includes("Deduplicate the index rows"),
      ),
    ).toBe(true);
  });

  it("returns 400 for invalid wiki ingest payload", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "",
        content: "",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Ingest title is required." });
  });

  it("returns 400 for invalid wiki query payload", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/wiki/query",
      payload: {
        query: "",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Query is required." });
  });

  it("adds an inbox task proposal when ingest contains action signals", async () => {
    const ingestResponse = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload: {
        title: "Client follow-up plan",
        content: "Next steps: implement onboarding fix and resolve blocker in run review flow.",
      },
    });
    expect(ingestResponse.statusCode).toBe(201);

    const inboxPageResponse = await server.inject({
      method: "GET",
      url: "/wiki/page?path=tasks/inbox.md",
    });
    expect(inboxPageResponse.statusCode).toBe(200);
    expect(inboxPageResponse.json<WikiPageResponse>().content).toContain("- [ ] Client follow-up plan");
  });

  it("does not duplicate the same inbox proposal on repeated ingest", async () => {
    const payload = {
      title: "Duplicate task signal",
      content: "Next steps: implement and fix pending blocker.",
    };
    const first = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload,
    });
    expect(first.statusCode).toBe(201);
    const second = await server.inject({
      method: "POST",
      url: "/wiki/ingest",
      payload,
    });
    expect(second.statusCode).toBe(201);

    const inboxPageResponse = await server.inject({
      method: "GET",
      url: "/wiki/page?path=tasks/inbox.md",
    });
    const inbox = inboxPageResponse.json<WikiPageResponse>().content;
    const proposalLine = "- [ ] Duplicate task signal";
    const matches = inbox.split("\n").filter((line) => line.includes(proposalLine));
    expect(matches.length).toBe(1);
  });

  it("creates and plans a codex worker run", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Add a safe backend endpoint",
        mode: "approved_step",
        profile: "standard",
      },
    });

    expect(createResponse.statusCode).toBe(201);
    const run = createResponse.json<Run>();

    const planResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/plan`,
    });

    expect(planResponse.statusCode).toBe(200);
    const viewResponse = await server.inject({
      method: "GET",
      url: `/codex/runs/${run.id}`,
    });
    expect(viewResponse.statusCode).toBe(200);
    const view = viewResponse.json<{ steps: Array<{ id: string; needsApproval: boolean }> }>();
    expect(view.steps.length).toBeGreaterThan(0);
    expect(view.steps.some((step) => step.needsApproval)).toBe(true);
  });

  it("requires approval for protected codex worker steps and allows cancel", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Implement endpoint and run tests",
        mode: "approved_step",
        profile: "standard",
      },
    });
    const run = createResponse.json<Run>();

    await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/plan`,
    });

    const firstExecute = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/execute-next`,
    });
    expect(firstExecute.statusCode).toBe(200);

    const secondExecute = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/execute-next`,
    });
    expect(secondExecute.statusCode).toBe(400);

    const viewResponse = await server.inject({
      method: "GET",
      url: `/codex/runs/${run.id}`,
    });
    const view = viewResponse.json<{
      steps: Array<{
        id: string;
        needsApproval: boolean;
        status: string;
        stdoutPath?: string;
        stderrPath?: string;
        evidence?: {
          summary: string;
          capturedAt: string;
          command: string;
          workingDirectory: string;
          notes: string[];
          artifacts: Array<{ label: string; path: string }>;
        };
      }>;
    }>();
    const completedStep = view.steps.find((step) => step.status === "completed");
    expect(completedStep?.stdoutPath).toBeDefined();
    expect(completedStep?.stderrPath).toBeDefined();
    expect(completedStep?.evidence?.summary).toBe("Fake executor completed step.");
    expect(completedStep?.evidence?.artifacts.some((artifact) => artifact.label === "stdout")).toBe(true);
    if (completedStep?.stdoutPath) {
      const stdoutPage = await server.inject({
        method: "GET",
        url: `/wiki/page?path=${encodeURIComponent(completedStep.stdoutPath)}`,
      });
      expect(stdoutPage.statusCode).toBe(200);
      expect(stdoutPage.json<WikiPageResponse>().content).toContain("Fake executor completed step");
    }
    const protectedStep = view.steps.find((step) => step.needsApproval);
    expect(protectedStep).toBeDefined();

    const approveResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/approve-step`,
      payload: {
        stepId: protectedStep?.id,
      },
    });
    expect(approveResponse.statusCode).toBe(200);

    const executeAfterApproval = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/execute-next`,
    });
    expect(executeAfterApproval.statusCode).toBe(200);

    const cancelResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/cancel`,
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json<Run>().status).toBe("blocked");
  });

  it("finalizes codex worker runs with durable run and wiki log entries", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Finalize codex worker output",
        mode: "approved_step",
        profile: "standard",
      },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/execute-next` });
    const plannedViewResponse = await server.inject({ method: "GET", url: `/codex/runs/${run.id}` });
    const plannedView = plannedViewResponse.json<{ steps: Array<{ id: string; needsApproval: boolean }> }>();
    const approvalSteps = plannedView.steps.filter((step) => step.needsApproval);
    for (const step of approvalSteps) {
      await server.inject({
        method: "POST",
        url: `/codex/runs/${run.id}/approve-step`,
        payload: { stepId: step.id },
      });
      await server.inject({ method: "POST", url: `/codex/runs/${run.id}/execute-next` });
    }

    const finalizeResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/finalize`,
      payload: {
        summary: "Codex worker finalized with durable memory.",
        changedFiles: ["apps/api/src/services/codex-worker.service.ts"],
        testEvidence: ["pnpm test:api passed", "pnpm typecheck passed"],
      },
    });
    expect(finalizeResponse.statusCode).toBe(200);
    expect(finalizeResponse.json<Run>().status).toBe("completed");

    const wikiLogResponse = await server.inject({ method: "GET", url: "/wiki/log" });
    const wikiLog = wikiLogResponse.json<WikiPageResponse>().content;
    expect(wikiLog).toContain("decision | Codex worker run finalized");
    expect(wikiLog).toContain(`Run ID: ${run.id}`);

    const datePrefix = new Date().toISOString().slice(0, 10);
    const runLogPath = `runs/${datePrefix}-codex-worker-${run.id}.md`;
    const runLogResponse = await server.inject({
      method: "GET",
      url: `/wiki/page?path=${encodeURIComponent(runLogPath)}`,
    });
    expect(runLogResponse.statusCode).toBe(200);
    expect(runLogResponse.json<WikiPageResponse>().content).toContain("Codex worker finalized with durable memory.");
    expect(runLogResponse.json<WikiPageResponse>().content).toContain("apps/api/src/services/codex-worker.service.ts");
    expect(runLogResponse.json<WikiPageResponse>().content).toContain("pnpm test:api passed");
    expect(runLogResponse.json<WikiPageResponse>().content).toContain("evidence: Fake executor completed step.");
    expect(runLogResponse.json<WikiPageResponse>().content).toContain("Completed steps: 3/3");
  });

  it("rejects finalize when codex worker still has unresolved steps", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Finalize guard check",
        mode: "approved_step",
        profile: "standard",
      },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });

    const finalizeResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/finalize`,
      payload: {
        summary: "Trying to finalize early",
      },
    });

    expect(finalizeResponse.statusCode).toBe(400);
    expect(finalizeResponse.json()).toEqual({ error: "Cannot finalize while there are unresolved steps." });
  });

  it("rejects execute-next on cancelled codex worker runs", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Cancelled run guard",
        mode: "approved_step",
        profile: "standard",
      },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });

    const cancelResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/cancel`,
    });
    expect(cancelResponse.statusCode).toBe(200);

    const executeResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/execute-next`,
    });
    expect(executeResponse.statusCode).toBe(400);
    expect(executeResponse.json()).toEqual({ error: "Run is cancelled or blocked." });
  });

  it("rejects retry-step when step is not failed or blocked", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: {
        goal: "Retry guard",
        mode: "approved_step",
        profile: "standard",
      },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });
    const viewResponse = await server.inject({ method: "GET", url: `/codex/runs/${run.id}` });
    const view = viewResponse.json<{ steps: Array<{ id: string }> }>();
    const retryResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/retry-step`,
      payload: { stepId: view.steps[0]?.id },
    });
    expect(retryResponse.statusCode).toBe(400);
  });

  it("lists tasks and supports full task update", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/tasks",
      payload: { title: "Draft pipeline spec", priority: "medium" },
    });
    expect(createResponse.statusCode).toBe(201);
    const task = createResponse.json<Task>();

    const listResponse = await server.inject({ method: "GET", url: "/tasks" });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json<Task[]>();
    expect(list.some((t) => t.id === task.id)).toBe(true);

    const updateResponse = await server.inject({
      method: "PATCH",
      url: `/tasks/${task.id}`,
      payload: { title: "Finalize pipeline spec", status: "active", priority: "high" },
    });
    expect(updateResponse.statusCode).toBe(200);
    const updated = updateResponse.json<Task>();
    expect(updated.title).toBe("Finalize pipeline spec");
    expect(updated.status).toBe("active");
    expect(updated.priority).toBe("high");
  });

  it("rejects task update with invalid status and priority", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/tasks",
      payload: { title: "Guard task" },
    });
    const task = createResponse.json<Task>();

    const badStatusResponse = await server.inject({
      method: "PATCH",
      url: `/tasks/${task.id}`,
      payload: { status: "in-progress" },
    });
    expect(badStatusResponse.statusCode).toBe(400);
    expect(badStatusResponse.json()).toEqual({ error: "Task status is invalid." });

    const badPriorityResponse = await server.inject({
      method: "PATCH",
      url: `/tasks/${task.id}`,
      payload: { priority: "turbo" },
    });
    expect(badPriorityResponse.statusCode).toBe(400);
    expect(badPriorityResponse.json()).toEqual({ error: "Task priority is invalid." });
  });

  it("lists agents and supports agent status update", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "Status Watcher", role: "qa" },
    });
    expect(createResponse.statusCode).toBe(201);
    const agent = createResponse.json<Agent>();

    const listResponse = await server.inject({ method: "GET", url: "/agents" });
    expect(listResponse.statusCode).toBe(200);
    const list = listResponse.json<Agent[]>();
    expect(list.some((a) => a.id === agent.id)).toBe(true);

    const statusResponse = await server.inject({
      method: "PATCH",
      url: `/agents/${agent.id}/status`,
      payload: { status: "idle" },
    });
    expect(statusResponse.statusCode).toBe(200);
    expect(statusResponse.json<Agent>().status).toBe("idle");
  });

  it("returns 404 when running a non-existent agent", async () => {
    const response = await server.inject({
      method: "POST",
      url: "/agents/00000000-0000-4000-a000-000000000099/run",
      payload: { instruction: "Do something." },
    });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Agent not found." });
  });

  it("streams agent run events as SSE with typed chunk and result events", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "Stream QA", role: "qa" },
    });
    const agent = createResponse.json<Agent>();

    const streamResponse = await server.inject({
      method: "POST",
      url: `/agents/${agent.id}/run/stream`,
      payload: { instruction: "Review the implementation plan." },
    });

    expect(streamResponse.statusCode).toBe(200);
    expect(streamResponse.headers["content-type"]).toContain("text/event-stream");

    const events = streamResponse.body
      .split("\n")
      .filter((line) => line.startsWith("data: "))
      .map((line) => JSON.parse(line.slice(6)) as { type: string; status?: string; content?: string; result?: RunAgentResult });

    expect(events.some((e) => e.type === "status" && e.status === "queued")).toBe(true);
    expect(events.some((e) => e.type === "status" && e.status === "running")).toBe(true);
    expect(events.some((e) => e.type === "chunk" && typeof e.content === "string" && e.content.length > 0)).toBe(true);
    expect(events.some((e) => e.type === "status" && e.status === "finalizing")).toBe(true);

    const resultEvent = events.find((e) => e.type === "result");
    expect(resultEvent).toBeDefined();
    expect(resultEvent?.result?.run.status).toBe("completed");
    expect(resultEvent?.result?.agent.id).toBe(agent.id);
    expect(resultEvent?.result?.agent.status).toBe("needs-human");
  });

  it("runs llm-wiki-ingest-loop skill to completion", async () => {
    const startResponse = await server.inject({
      method: "POST",
      url: "/orchestrations/skills/llm-wiki-ingest-loop/run",
      payload: {
        goal: "Ingest client meeting notes about the new dashboard feature.",
        context: "Source: client-meeting-2026-05-08.md",
      },
    });

    expect(startResponse.statusCode).toBe(202);
    const started = startResponse.json<StartSkillOrchestrationResponse>();
    expect(started.runId).toEqual(expect.any(String));

    let status: OrchestrationStatusResult | null = null;
    for (let attempt = 0; attempt < 20 && status?.status !== "completed"; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      const statusResponse = await server.inject({
        method: "GET",
        url: `/orchestrations/${started.runId}/status`,
      });
      if (statusResponse.statusCode === 200) {
        status = statusResponse.json<OrchestrationStatusResult>();
      }
    }

    expect(status?.status).toBe("completed");
    expect(status?.skillId).toBe("llm-wiki-ingest-loop");
    expect(status?.steps).toHaveLength(5);
    expect(status?.steps.every((s) => s.status === "completed" || s.status === "running")).toBe(true);

    const wikiLogResponse = await server.inject({ method: "GET", url: "/wiki/log" });
    expect(wikiLogResponse.json<WikiPageResponse>().content).toContain("run_completed");
  });

  it("rejects approving a codex step that does not require approval", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: { goal: "Approve guard check", mode: "approved_step", profile: "standard" },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });

    const viewResponse = await server.inject({ method: "GET", url: `/codex/runs/${run.id}` });
    const view = viewResponse.json<{ steps: Array<{ id: string; needsApproval: boolean }> }>();
    const noApprovalStep = view.steps.find((s) => !s.needsApproval);
    expect(noApprovalStep).toBeDefined();

    const approveResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/approve-step`,
      payload: { stepId: noApprovalStep?.id },
    });
    expect(approveResponse.statusCode).toBe(400);
    expect(approveResponse.json()).toEqual({ error: "This step does not require approval." });
  });

  it("rejects approving an already completed codex step", async () => {
    const createResponse = await server.inject({
      method: "POST",
      url: "/codex/runs",
      payload: { goal: "Completed approve guard", mode: "approved_step", profile: "standard" },
    });
    const run = createResponse.json<Run>();
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/plan` });

    // Execute step 0 (no approval needed) — completes automatically
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/execute-next` });

    // Approve step 1 (needsApproval=true) then execute it
    const viewResponse = await server.inject({ method: "GET", url: `/codex/runs/${run.id}` });
    const view = viewResponse.json<{ steps: Array<{ id: string; needsApproval: boolean; status: string }> }>();
    const approvalStep = view.steps.find((s) => s.needsApproval && s.status === "pending");
    expect(approvalStep).toBeDefined();

    await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/approve-step`,
      payload: { stepId: approvalStep?.id },
    });
    await server.inject({ method: "POST", url: `/codex/runs/${run.id}/execute-next` });

    // Try to re-approve the now-completed step
    const reApproveResponse = await server.inject({
      method: "POST",
      url: `/codex/runs/${run.id}/approve-step`,
      payload: { stepId: approvalStep?.id },
    });
    expect(reApproveResponse.statusCode).toBe(400);
    expect(reApproveResponse.json()).toEqual({ error: "Completed steps cannot be approved again." });
  });

  it("executes qa and wiki-curator agents and produces role-specific output", async () => {
    const qaAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "Jaco QA", role: "qa" },
    });
    const qaAgent = qaAgentResponse.json<Agent>();

    const qaRunResponse = await server.inject({
      method: "POST",
      url: `/agents/${qaAgent.id}/run`,
      payload: { instruction: "Validate the implementation against acceptance criteria." },
    });
    expect(qaRunResponse.statusCode).toBe(200);
    const qaResult = qaRunResponse.json<RunAgentResult>();
    expect(qaResult.assistantMessage.content).toContain("QA Review");
    expect(qaResult.assistantMessage.content).toContain("APPROVED");
    expect(qaResult.assistantMessage.content).toContain("Handoff");

    const wikiAgentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "Wiki Curator", role: "wiki-curator" },
    });
    const wikiAgent = wikiAgentResponse.json<Agent>();

    const wikiRunResponse = await server.inject({
      method: "POST",
      url: `/agents/${wikiAgent.id}/run`,
      payload: { instruction: "File operational memory after this session." },
    });
    expect(wikiRunResponse.statusCode).toBe(200);
    const wikiResult = wikiRunResponse.json<RunAgentResult>();
    expect(wikiResult.assistantMessage.content).toContain("Wiki Update");
    expect(wikiResult.assistantMessage.content).toContain("wiki/log.md");
    expect(wikiResult.assistantMessage.content).toContain("Operational memory is current");
  });

  it("returns 404 for log and complete operations on non-existent runs", async () => {
    const phantomId = "00000000-0000-4000-a000-000000000099";

    const logResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${phantomId}/log`,
      payload: { message: "ghost log" },
    });
    expect(logResponse.statusCode).toBe(404);
    expect(logResponse.json()).toEqual({ error: "Run not found." });

    const completeResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${phantomId}/complete`,
      payload: { summary: "ghost complete" },
    });
    expect(completeResponse.statusCode).toBe(404);
    expect(completeResponse.json()).toEqual({ error: "Run not found." });

    const reviewResponse = await server.inject({
      method: "PATCH",
      url: `/runs/${phantomId}/review`,
      payload: { reviewStatus: "approved" },
    });
    expect(reviewResponse.statusCode).toBe(404);
    expect(reviewResponse.json()).toEqual({ error: "Run not found." });
  });

  it("skips handoff silently when handoff target is the same agent", async () => {
    const agentResponse = await server.inject({
      method: "POST",
      url: "/agents",
      payload: { name: "Solo PM", role: "pm" },
    });
    const agent = agentResponse.json<Agent>();

    const runResponse = await server.inject({
      method: "POST",
      url: `/agents/${agent.id}/run`,
      payload: {
        instruction: "Plan the sprint.",
        handoffAgentId: agent.id,
      },
    });

    expect(runResponse.statusCode).toBe(200);
    const result = runResponse.json<RunAgentResult>();
    expect(result.run.status).toBe("completed");

    // Same-agent handoff is skipped silently (no second run created)
    const runsResponse = await server.inject({ method: "GET", url: "/runs" });
    const allRuns = runsResponse.json<Run[]>();
    const agentRuns = allRuns.filter((r) => r.agentId === agent.id);
    expect(agentRuns).toHaveLength(1);
  });
});
