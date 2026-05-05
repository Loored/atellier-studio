import { mkdtemp, rm } from "node:fs/promises";
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
      executorModel: "gpt-4.1-mini",
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
    const queryResult = queryResponse.json<{ query: string; matches: Array<{ path: string; snippet: string }> }>();
    expect(queryResult.query).toBe("preserve raw sources");
    expect(queryResult.matches.length).toBeGreaterThan(0);
    expect(queryResult.matches.some((match) => match.path.startsWith("wiki/"))).toBe(true);
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
});
