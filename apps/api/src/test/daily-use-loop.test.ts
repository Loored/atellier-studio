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
import type { AgentExecutorService } from "../services/agent-executor.service";
import { createAppServices, type AppServices } from "../services/app-services";

function createRepairScenarioExecutor(
  repairSucceeds: boolean,
  semanticQaCycle = false,
  semanticNeverApproves = false,
  semanticInvalidFromAttempt?: number,
  qaMalformedAttempts = 0,
  malformedQaRechecksFromAttempt?: number,
  repeatQaFeedback = false,
): AgentExecutorService {
  let qaAttempts = 0;
  return {
    async execute(input) {
      if (input.agent.role === "pm") {
        return {
          needsHuman: false,
          response: [
            "## Scope",
            "Create one complete three-day operating plan.",
            "## Approach",
            "Draft the artifact, validate it, and repair exact blockers.",
            "## Acceptance Criteria",
            "Day 1, Day 2, and Day 3 are explicit and QA approves.",
            "## Handoff",
            "Builder may proceed.",
          ].join("\n"),
        };
      }
      if (input.agent.role === "builder" && /Phase:\s*runtime/i.test(input.instruction)) {
        return {
          needsHuman: false,
          response: [
            "## Checks to Run",
            "Inspect all three explicit days.",
            "## Expected Pass/Fail Signals",
            "Pass when every day is present.",
            "## Blockers",
            "None.",
            "## QA Handoff",
            "Validate the latest artifact.",
          ].join("\n"),
        };
      }
      if (input.agent.role === "builder") {
        const isRepair = /Step:\s*Auto-repair/i.test(input.instruction);
        const isSemanticRepair = /Step:\s*Semantic repair/i.test(input.instruction);
        const semanticAttempt = Number(input.instruction.match(/Step:\s*Semantic repair (\d+)/i)?.[1] ?? 0);
        if (isSemanticRepair && semanticInvalidFromAttempt && semanticAttempt >= semanticInvalidFromAttempt) {
          return {
            needsHuman: false,
            response: "I could not produce the complete corrected artifact.",
          };
        }
        const artifact = isSemanticRepair
          ? [
              "### Day 2", "Execute a bounded task and preserve temporary evidence.",
            ].join("\n")
          : isRepair && repairSucceeds
          ? [
              "### Day 2",
              "Execute the bounded task, preserve evidence, and note concrete blockers for the second operating day.",
              "### Day 3",
              "Review the deliverable, approve or request changes, and capture durable memory for the third operating day.",
            ].join("\n")
          : repairSucceeds
            ? [
                "### Day 1",
                "Capture the source, define the outcome, and record the acceptance signal for the first operating day.",
              ].join("\n")
            : "Use the same daily routine throughout the requested period while preserving evidence and the human-review boundary.";
        return {
          needsHuman: false,
          response: [
            "## Summary",
            "Prepared the requested operating plan.",
            "## Requested Artifact",
            artifact,
            "## Risk Assessment",
            "Low; the plan remains bounded.",
            "## Blockers",
            "None beyond deterministic validation.",
            "## QA Handoff",
            "Review the explicit daily entries.",
          ].join("\n"),
        };
      }
      if (input.agent.role === "qa") {
        qaAttempts += 1;
        const qaRecheckAttempt = Number(input.instruction.match(/Step:\s*QA recheck (\d+)/i)?.[1] ?? 0);
        if (
          qaAttempts <= qaMalformedAttempts
          || (malformedQaRechecksFromAttempt && qaRecheckAttempt >= malformedQaRechecksFromAttempt)
        ) {
          return {
            needsHuman: false,
            response: "The response should contain a verdict, findings, and a recommendation.",
          };
        }
        const isRecheck = /Step:\s*QA recheck/i.test(input.instruction);
        const requestsChanges = semanticNeverApproves || (semanticQaCycle && !isRecheck);
        const distinctFinding = [
          "Clarify temporary execution evidence.",
          "Distinguish durable Wiki memory from temporary logs.",
          "Name the exact human approval boundary.",
          "Identify the final accountable approver.",
        ][Math.min(qaAttempts - 1, 3)];
        return {
          needsHuman: false,
          response: [
            `Verdict: ${requestsChanges ? "CHANGES REQUESTED" : "APPROVED"}`,
            "Acceptance Checklist:",
            `- [${requestsChanges ? "FAIL" : "PASS"}] Day 1, Day 2, and Day 3 are explicit and QA approves. — Evidence: ${requestsChanges ? "Approval boundary remains unclear." : "All three days and boundaries are explicit."}`,
            "Findings:",
            requestsChanges
              ? (repeatQaFeedback
                  ? "Clarify temporary evidence, durable memory, and human approval."
                  : distinctFinding ?? "Clarify remaining acceptance evidence.")
              : "All three days are explicit and reviewable.",
            "Recommendation:",
            "Proceed to human review.",
          ].join("\n"),
        };
      }
      return {
        needsHuman: false,
        response: [
          "Pages created: none.",
          "Pages updated: none.",
          "Log entry drafted for the autonomous repair cycle.",
          "Contradictions: none.",
        ].join("\n"),
      };
    },
  };
}

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

  it("idempotently reconciles a completed orchestration left in finalizing", async () => {
    const now = new Date().toISOString();
    const run = await services.runs.create({
      type: "orchestration",
      status: "completed",
      input: { skillId: "atellier-build-loop", goal: "Reconcile terminal state." },
      execution: {
        schemaVersion: 1,
        kind: "skill-orchestration",
        phase: "finalizing",
        definitionHash: "reconcile-test",
        definitionSnapshot: { id: "atellier-build-loop", steps: [] },
        idempotencyKey: "reconcile-test",
        attempt: 1,
        maxAttempts: 3,
        nextEventSequence: 0,
        availableAt: now,
        leaseOwner: "expired-worker",
        leaseExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      },
    });

    expect(await services.durableRuntime.runOnce()).toBe(true);
    expect((await services.runs.getById(run.id))?.execution).toMatchObject({ phase: "completed" });
    expect(await services.durableRuntime.runOnce()).toBe(false);
    const events = await services.runEvents.list(run.id);
    expect(events.events.filter((event) => event.type === "completed")).toHaveLength(1);
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
    expect(completedRun?.output).toMatchObject({
      readiness: "ready-for-human-review",
      validation: {
        profile: "orchestration",
        passed: true,
        invalidReferencedFiles: [],
      },
      artifact: {
        stepId: "build",
      },
      repair: {
        attemptsUsed: 0,
        resolved: true,
        exhausted: false,
      },
    });

    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const firstContext = (childRuns[0]?.input as { context?: string } | undefined)?.context ?? "";
    expect(firstContext).toContain("Linked Task Grounding");
    expect(firstContext).toContain(task.title);
    expect(firstContext).toContain(ingest.rawPath);
    expect(firstContext).toContain(ingest.summaryPagePath);
    expect(firstContext).toContain("Build the smallest useful linked workflow and preserve its source chain.");
    expect(firstContext).toContain(`--- BEGIN VERIFIED SOURCE: ${ingest.rawPath} ---`);
    const builderRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string } | undefined)?.orchestrationStepId === "build",
    );
    expect((builderRun?.input as { verifiedRepoFiles?: string[] } | undefined)?.verifiedRepoFiles).toEqual(
      expect.arrayContaining([ingest.rawPath, ingest.summaryPagePath]),
    );
    expect((builderRun?.output as { validation?: { passed?: boolean } } | undefined)?.validation?.passed).toBe(true);

    const deliverable = await services.wiki.readPage(completedRun?.deliverablePath ?? "");
    expect(deliverable.content).toContain("## Requested Artifact");
    expect(deliverable.content).toContain("human-review boundary");

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

  it("repairs deterministic artifact blockers before runtime and QA", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });

    const startResponse = await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    });
    const started = startResponse.json<StartSkillOrchestrationResponse>();
    expect(await services.durableRuntime.runOnce()).toBe(true);

    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "ready-for-human-review",
      artifact: { stepId: "repair-1" },
      repair: {
        maxAttempts: 3,
        attemptsUsed: 1,
        resolved: true,
        exhausted: false,
        finalStepId: "repair-1",
        blockerMessages: [],
      },
      validation: { passed: true },
    });

    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    )).toEqual(["scope", "build", "repair-1", "runtime", "qa", "memory"]);
    const repairRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "repair-1",
    );
    expect((repairRun?.input as { context?: string }).context).toContain(
      "missing: 2, 3",
    );
    expect((repairRun?.input as { instruction?: string }).instruction).toContain(
      "Generate only the missing or invalid requested-artifact entries",
    );
    expect((repairRun?.input as { instruction?: string }).instruction).toContain("Repair focus: return complete entries for only Days 2, 3");
    expect((repairRun?.output as { response?: string }).response).toContain("### Day 1");
    expect((repairRun?.output as { response?: string }).response).toContain("### Day 3");

    const status = (await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    })).json<OrchestrationStatusResult>();
    expect(status.repair).toMatchObject({ attemptsUsed: 1, resolved: true });
    expect(status.steps.find((step) => step.stepId === "repair-1")).toMatchObject({
      label: "Auto-repair 1/3",
      logicalStepId: "fix",
      repairAttempt: 1,
      repairAttemptLimit: 3,
      status: "completed",
    });
  });

  it("batches the initial Build instruction for long numbered artifacts", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(false),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 14-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const buildRun = (await services.runs.listByOrchestrationRunId(started.runId)).find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "build",
    );
    expect((buildRun?.input as { instruction?: string }).instruction).toContain("Long artifact batching contract");
    expect((buildRun?.input as { instruction?: string }).instruction).toContain("Days 1, 2, 3, 4, and 5 only");
  });

  it("stops after three failed repairs and asks for human input without running QA", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(false),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });

    const startResponse = await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    });
    const started = startResponse.json<StartSkillOrchestrationResponse>();
    expect(await services.durableRuntime.runOnce()).toBe(true);

    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      repair: {
        maxAttempts: 3,
        attemptsUsed: 3,
        resolved: false,
        exhausted: true,
        finalStepId: "repair-3",
      },
      validation: { passed: false },
    });
    const repair = (completedRun?.output as {
      repair?: { blockerMessages?: string[] };
    } | undefined)?.repair;
    expect(repair?.blockerMessages?.join(" ")).toContain("missing: 1, 2, 3");

    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    )).toEqual(["scope", "build", "repair-1", "repair-2", "repair-3"]);
    expect(childRuns.some((run) =>
      ["runtime", "qa", "memory"].includes(
        (run.input as { orchestrationStepId?: string }).orchestrationStepId ?? "",
      ),
    )).toBe(false);

    const status = (await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    })).json<OrchestrationStatusResult>();
    expect(status.steps.map((step) => step.stepId)).toEqual([
      "scope",
      "build",
      "repair-1",
      "repair-2",
      "repair-3",
    ]);
    expect(status.repair).toMatchObject({ attemptsUsed: 3, exhausted: true });
    expect((await server.inject({
      method: "PATCH",
      url: `/runs/${started.runId}/review`,
      payload: { reviewStatus: "approved" },
    })).statusCode).toBe(409);
    const repairAgent = childRuns.at(-1)?.agentId
      ? await services.agents.getById(childRuns.at(-1)?.agentId ?? "")
      : null;
    expect(repairAgent?.status).toBe("needs-human");

    await services.runs.updateExecution(started.runId, {
      status: "failed",
      phase: "failed",
      finishedAt: new Date().toISOString(),
    });
    expect((await server.inject({
      method: "POST",
      url: `/runs/${started.runId}/retry`,
    })).statusCode).toBe(200);
    expect(await services.durableRuntime.runOnce()).toBe(true);
    expect(await services.runs.listByOrchestrationRunId(started.runId)).toHaveLength(5);
    const events = (await server.inject({
      method: "GET",
      url: `/runs/${started.runId}/events`,
    })).json<{ events: Array<{ type: string }> }>().events;
    expect(events.filter((event) => event.type === "step_reused")).toHaveLength(5);
  });

  it("repairs semantic QA findings and rechecks before filing memory", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });

    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();
    expect(await services.durableRuntime.runOnce()).toBe(true);

    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "ready-for-human-review",
      semanticRepair: {
        attemptsUsed: 1,
        resolved: true,
        exhausted: false,
        finalStepId: "qa-recheck-1",
        lastValidArtifactStepId: "semantic-repair-1",
        lastQaStepId: "qa-recheck-1",
      },
      validation: { passed: true },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    )).toEqual([
      "scope", "build", "repair-1", "runtime", "qa",
      "semantic-repair-1", "qa-recheck-1", "memory",
    ]);
    const semanticRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "semantic-repair-1",
    );
    expect((semanticRun?.input as { instruction?: string }).instruction).toContain(
      "Clarify temporary execution evidence.",
    );
    expect((semanticRun?.input as { instruction?: string }).instruction).toContain("Return only the corrected Day entries");
    expect((semanticRun?.input as { orchestrationValidationProfile?: string }).orchestrationValidationProfile)
      .toBe("artifact-builder");
    expect((semanticRun?.output as { validation?: { profile?: string; passed?: boolean } }).validation)
      .toMatchObject({ profile: "artifact-builder", passed: true });
    const semanticResponse = (semanticRun?.output as { response?: string }).response ?? "";
    expect(semanticResponse).toContain("### Day 1");
    expect(semanticResponse).toContain("### Day 2");
    expect(semanticResponse).toContain("### Day 3");
    const status = (await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    })).json<OrchestrationStatusResult>();
    expect(status.semanticRepair).toMatchObject({ attemptsUsed: 1, resolved: true });
    expect(status.steps.map((step) => step.stepId)).toEqual([
      "scope", "build", "repair-1", "runtime", "qa",
      "semantic-repair-1", "qa-recheck-1", "memory",
    ]);
  });

  it("retries malformed QA before semantic repair and files memory after a valid approval", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, false, false, undefined, 1),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "ready-for-human-review",
      qaRetry: {
        attemptsUsed: 1,
        resolved: true,
        exhausted: false,
        finalStepId: "qa-format-retry-1",
      },
      semanticRepair: { attemptsUsed: 0, resolved: true },
      validation: { passed: true },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    )).toEqual([
      "scope", "build", "repair-1", "runtime", "qa", "qa-format-retry-1", "memory",
    ]);
  });

  it("needs human input without consuming semantic repairs when QA format retries exhaust", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, false, false, undefined, 3),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      qaRetry: {
        attemptsUsed: 2,
        resolved: false,
        exhausted: true,
        finalStepId: "qa-format-retry-2",
      },
      validation: { passed: false },
    });
    expect((completedRun?.output as { semanticRepair?: unknown }).semanticRepair).toBeUndefined();
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const stepIds = childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    );
    expect(stepIds).toEqual([
      "scope", "build", "repair-1", "runtime", "qa", "qa-format-retry-1", "qa-format-retry-2",
    ]);
    expect(stepIds.some((stepId) => stepId?.startsWith("semantic-repair-"))).toBe(false);
    expect((await server.inject({
      method: "PATCH",
      url: `/runs/${started.runId}/review`,
      payload: { reviewStatus: "approved" },
    })).statusCode).toBe(409);
  });

  it("retries a malformed QA recheck without consuming another semantic repair", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, false, undefined, 0, 1),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      qaRetry: { attemptsUsed: 2, exhausted: true },
      semanticRepair: {
        attemptsUsed: 1,
        resolved: false,
        exhausted: false,
        lastValidArtifactStepId: "semantic-repair-1",
      },
      validation: { passed: false },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const stepIds = childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    );
    expect(stepIds).toContain("qa-recheck-1-format-retry-2");
    expect(stepIds).not.toContain("semantic-repair-2");
    expect(stepIds).not.toContain("memory");
  });

  it("stops semantic repair when QA repeats the same findings", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, true, undefined, 0, undefined, true),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      repeatedFeedback: {
        detected: true,
        firstQaStepId: "qa",
        repeatedQaStepId: "qa-recheck-1",
      },
      semanticRepair: { attemptsUsed: 1, resolved: false, exhausted: false },
      validation: { passed: false },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const stepIds = childRuns.map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    );
    expect(stepIds).not.toContain("semantic-repair-2");
    expect(stepIds).not.toContain("memory");
  });

  it("stops after three semantic repairs and skips memory when QA still rejects", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, true),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      semanticRepair: {
        attemptsUsed: 3,
        resolved: false,
        exhausted: true,
        finalStepId: "semantic-repair-3",
        lastValidArtifactStepId: "semantic-repair-3",
        lastQaStepId: "qa-recheck-3",
      },
      validation: { passed: false },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.filter((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId?.startsWith("semantic-repair-"),
    )).toHaveLength(3);
    expect(childRuns.some((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "memory",
    )).toBe(false);
  });

  it("preserves the last valid semantic artifact when later repairs are invalid", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, true, 2),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      artifact: { stepId: "semantic-repair-1" },
      semanticRepair: {
        attemptsUsed: 3,
        exhausted: true,
        finalStepId: "semantic-repair-3",
        lastValidArtifactStepId: "semantic-repair-1",
        lastQaStepId: "qa-recheck-1",
      },
      validation: { passed: false },
    });
    expect((completedRun?.output as { artifact?: { content?: string } }).artifact?.content).toContain("### Day 3");
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.some((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "qa-recheck-2",
    )).toBe(false);
    expect((await server.inject({
      method: "PATCH",
      url: `/runs/${started.runId}/review`,
      payload: { reviewStatus: "approved" },
    })).statusCode).toBe(409);
  });

  it("falls back to the original valid build when every semantic repair is invalid", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, true, 1),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      artifact: { stepId: "repair-1" },
      semanticRepair: {
        finalStepId: "semantic-repair-3",
        lastValidArtifactStepId: "repair-1",
        lastQaStepId: "qa",
      },
      validation: { passed: false },
    });
  });
});
