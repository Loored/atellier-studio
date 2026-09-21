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
import { buildOperatorGoalContract } from "../services/operator-goal-contract";

function createRepairScenarioExecutor(
  repairSucceeds: boolean,
  semanticQaCycle = false,
  semanticNeverApproves = false,
  semanticInvalidFromAttempt?: number,
  qaMalformedAttempts = 0,
  malformedQaRechecksFromAttempt?: number,
  repeatQaFeedback = false,
  incompleteChangesRequestedChecklist = false,
  qaExplicitVerdictWithoutChecklist = false,
  qaChecklistCompletionSucceeds = false,
  executionProofScope = false,
  offArtifactQaApproval = false,
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
            executionProofScope
              ? [
                  "Day 1 Wiki log contains at least one new entry and the task is created.",
                  "Day 2 build run completes with repair evidence.",
                  "Day 3 final artifact is rendered and task state transitions to done.",
                  "The plan explicitly flags needs-human after repair exhaustion.",
                ].join("\n")
              : incompleteChangesRequestedChecklist
              ? [
                  "Day 1, Day 2, and Day 3 are explicit.",
                  "The human approval boundary is named.",
                ].join("\n")
              : "Day 1, Day 2, and Day 3 are explicit and QA approves.",
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
      if (input.agent.role === "builder" && /Step:\s*Compile and run checks/i.test(input.instruction)) {
        return {
          needsHuman: false,
          response: [
            "## Findings",
            "Runtime inspected the ## Implement the slice output and found it runnable.",
            "## Checks to run",
            "Validate the complete requested artifact.",
            "## Expected pass/fail signals",
            "Pass when every explicit day remains present.",
            "## Blockers",
            "None.",
            "## QA Handoff",
            "Evaluate the complete artifact.",
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
        const currentGoal = /^Goal: (.+)$/m.exec(input.instruction)?.[1] ?? "";
        const criteria = buildOperatorGoalContract(currentGoal).criteria;
        if (/Step:\s*QA checklist completion/i.test(input.instruction)) {
          return {
            needsHuman: false,
            response: qaChecklistCompletionSucceeds
              ? criteria.map((criterion, index) => `- [PASS] AC-${index + 1}: ${criterion} — Evidence: The bounded task and acceptance signal are present in the requested operating plan.`).join("\n")
              : "I cannot provide the missing checklist evidence.",
          };
        }
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
        if (qaExplicitVerdictWithoutChecklist) {
          return {
            needsHuman: false,
            response: [
              "## Veredicto",
              "**APROBADO**",
              "## Hallazgos",
              "La nota parece completa.",
              "## Recomendación",
              "Aprobar para revisión humana.",
            ].join("\n"),
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
            ...criteria.slice(0, incompleteChangesRequestedChecklist || (qaChecklistCompletionSucceeds && !requestsChanges) ? 1 : undefined).map((criterion, index) =>
              `- [${requestsChanges ? "FAIL" : "PASS"}] AC-${index + 1}: ${criterion} — Evidence: ${requestsChanges ? "Approval boundary remains unclear." : offArtifactQaApproval ? "Historical context-pack write failed with EACCES permission denied." : "The bounded task and acceptance signal are present in the requested operating plan."}`,
            ),
            ...(!requestsChanges && incompleteChangesRequestedChecklist && !qaChecklistCompletionSucceeds
              ? criteria.slice(1).map((criterion, index) => `- [PASS] AC-${index + 2}: ${criterion} — Evidence: The bounded task and acceptance signal are present in the requested operating plan.`)
              : []),
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

  it("blocks a structurally complete QA approval justified by historical evidence", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, false, false, undefined, 0, undefined, false, false, false, false, false, true),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const parent = await services.runs.getById(started.runId);
    expect((parent?.input as { operatorGoalContract?: { criteria?: string[] } }).operatorGoalContract?.criteria?.[0])
      .toContain("exactly 3 explicit Day entries");
    expect(parent?.output).toMatchObject({
      readiness: "needs-human",
      validation: { passed: false, issues: [expect.objectContaining({ code: "orchestration.qa_evidence_off_artifact" })] },
    });
    const children = await services.runs.listByOrchestrationRunId(started.runId);
    expect(children.map((run) => (run.input as { orchestrationStepId?: string }).orchestrationStepId)).not.toContain("memory");
    expect((await server.inject({
      method: "PATCH",
      url: `/runs/${started.runId}/review`,
      payload: { reviewStatus: "approved" },
    })).statusCode).toBe(409);
  });

  it("instructs semantic repair to replace circular artifact checks with observable run signals", async () => {
    await server.close();
    const baseline = createRepairScenarioExecutor(true, true);
    let semanticInstruction = "";
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: {
        async execute(input) {
          if (/Step:\s*Semantic repair/i.test(input.instruction)) semanticInstruction = input.instruction;
          return baseline.execute(input);
        },
      },
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: { goal: "Create a complete 3-day operating plan." },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    expect(semanticInstruction).toContain("Replace self-referential checks");
    expect(semanticInstruction).toContain("observable success signals");
    expect(semanticInstruction).toContain("do not assert that it was executed");
    expect((await services.runs.getById(started.runId))?.output).toMatchObject({
      semanticRepair: { attemptsUsed: 1 },
    });
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
    expect(status.contextReceipt).toMatchObject({
      policy: "evidence-first",
      items: expect.arrayContaining([
        expect.objectContaining({ path: ingest.rawPath, memory: expect.objectContaining({ authority: "evidence-only" }) }),
        expect.objectContaining({ path: ingest.summaryPagePath, memory: expect.objectContaining({ authority: "context-only" }) }),
      ]),
    });
    expect(status.performance).toMatchObject({
      schemaVersion: 1,
      measuredRuns: 5,
      byPhase: expect.arrayContaining([
        expect.objectContaining({ key: "plan", runs: 1 }),
        expect.objectContaining({ key: "backend", runs: 1 }),
        expect.objectContaining({ key: "runtime", runs: 1 }),
        expect.objectContaining({ key: "qa", runs: 1 }),
        expect.objectContaining({ key: "wiki", runs: 1 }),
      ]),
      byModel: [expect.objectContaining({ key: "unknown", runs: 5 })],
    });

    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun).toMatchObject({
      taskId: task.id,
      status: "completed",
      reviewStatus: "pending",
    });
    expect(completedRun?.deliverablePath).toContain(`wiki/deliverables/${started.runId}-`);
    expect(completedRun?.contextReceipt?.stableHash).toBe(status.contextReceipt?.stableHash);
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
      performance: {
        schemaVersion: 1,
        measuredRuns: 5,
      },
    });

    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const firstContext = (childRuns[0]?.input as { context?: string } | undefined)?.context ?? "";
    expect(firstContext).toContain("Linked Task Grounding");
    expect(firstContext).toContain(task.title);
    expect(firstContext).toContain(ingest.rawPath);
    expect(firstContext).toContain(ingest.summaryPagePath);
    expect(firstContext).toContain("Build the smallest useful linked workflow and preserve its source chain.");
    expect(firstContext).toContain(`[EVIDENCE] ${ingest.rawPath}`);
    expect(firstContext).toContain(`[NON-AUTHORITATIVE CONTEXT] ${ingest.summaryPagePath}`);
    expect(firstContext).toContain(status.contextReceipt?.stableHash ?? "");
    const builderRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string } | undefined)?.orchestrationStepId === "build",
    );
    expect((builderRun?.input as { verifiedRepoFiles?: string[] } | undefined)?.verifiedRepoFiles).toEqual(
      expect.arrayContaining([ingest.rawPath, ingest.summaryPagePath]),
    );
    const builderContext = (builderRun?.input as { context?: string } | undefined)?.context ?? "";
    expect(builderContext).toContain("Path references anywhere in your response are checked");
    expect(builderContext).toContain("A path shown in memory excerpts or previous agent output is not automatically eligible");
    expect(builderContext).toContain("For a knowledge-only deliverable, write `- none` under Candidate Files and Changed Files");
    const eligibleCitationBlock = builderContext.split("Eligible frozen paths for this role:")[1] ?? "";
    const verifiedBuilderPaths = new Set(
      (builderRun?.input as { verifiedRepoFiles?: string[] } | undefined)?.verifiedRepoFiles ?? [],
    );
    for (const citedPath of eligibleCitationBlock
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => line.slice(2).trim())) {
      expect(verifiedBuilderPaths.has(citedPath)).toBe(true);
    }
    expect((builderRun?.input as { orchestrationContextReceiptHash?: string } | undefined)?.orchestrationContextReceiptHash)
      .toBe(status.contextReceipt?.stableHash);
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
    for (const stepId of ["build", "repair-1", "runtime", "qa"]) {
      const stepRun = childRuns.find((run) =>
        (run.input as { orchestrationStepId?: string }).orchestrationStepId === stepId,
      );
      expect((stepRun?.input as { context?: string }).context).toContain(
        "Frozen acceptance criteria from the operator goal:",
      );
      expect((stepRun?.input as { context?: string }).context).toContain(
        "exactly 3 explicit Day entries",
      );
      expect((stepRun?.input as { context?: string }).context).toContain(
        "Operator-goal precedence:",
      );
      expect((stepRun?.input as { context?: string }).context).toContain(
        "exactly 3 explicit Day entries",
      );
    }
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

    const qaRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "qa",
    );
    const qaContext = (qaRun?.input as { context?: string }).context ?? "";
    expect(qaContext).toContain("Latest requested artifact for QA (bounded evaluation context):");
    expect(qaContext).toContain("Do not use older step prose as an artifact");
    expect(qaContext).not.toContain("## Compile and run checks");
    expect(qaContext).toContain("exactly 3 explicit Day entries");

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
    const initialQaRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "qa",
    );
    const initialQaContext = (initialQaRun?.input as { context?: string }).context ?? "";
    expect(initialQaContext).toContain("Frozen memory excerpts are omitted from QA context.");
    expect(initialQaContext).toContain("### Day 3");
    expect(initialQaContext).not.toContain("Agent Memory Context\nReceipt:");
    expect(initialQaContext).not.toContain("Validation feedback:");
    expect((semanticRun?.input as { instruction?: string }).instruction).toContain(
      "Approval boundary remains unclear.",
    );
    expect((semanticRun?.input as { instruction?: string }).instruction).not.toContain(
      "Proceed to human review.",
    );
    expect((semanticRun?.input as { instruction?: string }).instruction).toContain("Return only the corrected Day entries");
    expect((semanticRun?.input as { orchestrationValidationProfile?: string }).orchestrationValidationProfile)
      .toBe("artifact-builder");
    expect((semanticRun?.input as { modelProfile?: string }).modelProfile).toBe("deep");
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

  it("reframes PM execution-proof criteria when the operator requested a numbered plan", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(
        true, false, false, undefined, 0, undefined, false, false, false, false, true,
      ),
    });
    server = await buildServer({ storageMode: "memory", atelierRoot, services });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: {
        goal: "Create a 3-day plan. Each day must include Objective, Actions, Expected Evidence, Acceptance Signal, Risks, and Human Approval Boundary.",
      },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const buildRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "build",
    );
    const buildContext = (buildRun?.input as { context?: string }).context ?? "";
    const frozenCriteria = buildContext.match(
      /Frozen acceptance criteria from the operator goal:\n([\s\S]*?)\nTreat this list as fixed/,
    )?.[1] ?? "";
    expect(frozenCriteria).toContain("complete standalone plan");
    expect(frozenCriteria).toContain("Each Day entry contains the operator-required fields");
    expect(frozenCriteria).not.toContain("The plan explicitly flags needs-human after repair exhaustion.");
    expect(frozenCriteria).not.toContain("Day 2 build run completes with repair evidence.");
  });

  it("tells Builder to request current run receipts instead of treating frozen Wiki paths as the run ledger", async () => {
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: {
        goal: "Compare current receipts for runs 6aaa3f0c4a2d67773e7c785c and 6aaa40d24a2d67773e7c7892. Cite readiness and QA outcome or mark them unverified.",
      },
    })).json<StartSkillOrchestrationResponse>();
    expect(await services.durableRuntime.runOnce()).toBe(true);
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    const buildRun = childRuns.find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "build",
    );
    const buildContext = (buildRun?.input as { context?: string }).context ?? "";
    expect(buildContext).toContain("If runs.read is advertised for this step, request it for the exact named IDs");
    expect(buildContext).toContain("A missing path in the frozen list does not mean runs.read is unavailable.");
    expect(buildContext).toContain("A successful read in a later QA step does not retroactively supply evidence");
    expect(buildContext).toContain("Name exact implementation identifiers only when verified against current contracts");
  });

  it("acquires one bounded receipt pair before Builder and reuses that snapshot in its context", async () => {
    const first = await services.runs.create({ type: "orchestration", status: "running" });
    const second = await services.runs.create({ type: "orchestration", status: "running" });
    await services.runs.complete(first.id, { output: { readiness: "needs-human", repair: { attemptsUsed: 1 } } });
    await services.runs.complete(second.id, { output: { readiness: "ready-for-human-review", repair: { attemptsUsed: 0 } } });
    const started = (await server.inject({
      method: "POST",
      url: "/orchestrations/skills/atellier-build-loop/run",
      payload: {
        goal: `Compare current receipts for runs ${first.id} and ${second.id}. Separate readiness and repairs; do not approve either run.`,
      },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const parent = await services.runs.getById(started.runId);
    const output = parent?.output as {
      preflightRunEvidence?: { requestedRunIds?: string[]; invocation?: { status?: string }; records?: Array<{ id?: string }> };
      qualityEvaluation?: { verdict?: string; preflightEvidenceDigest?: string };
    };
    expect(output.preflightRunEvidence).toMatchObject({
      requestedRunIds: [first.id, second.id],
      invocation: { status: "succeeded" },
    });
    expect(output.preflightRunEvidence?.records?.map((record) => record.id)).toEqual([first.id, second.id]);
    expect(parent?.toolInvocations).toEqual(expect.arrayContaining([
      expect.objectContaining({ toolName: "runs.read", status: "succeeded" }),
    ]));
    const buildRun = (await services.runs.listByOrchestrationRunId(started.runId)).find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "build",
    );
    const buildContext = (buildRun?.input as { context?: string }).context ?? "";
    expect(buildContext).toContain("Server-acquired run evidence");
    expect(buildContext).toContain("Current operational capability contract");
    expect(buildContext).toContain("Public runs.read fields: id, type, status");
    expect(buildContext).toContain("write `Receipt <run-id>:` before any claim");
    expect(buildContext).toContain("write `unverified` beside that same receipt");
    expect(buildContext).toContain(first.id);
    expect(buildContext).toContain(second.id);
    expect(output.qualityEvaluation).toMatchObject({ verdict: "verified" });
    expect(output.qualityEvaluation?.preflightEvidenceDigest).toBeTruthy();
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

  it("uses an incomplete changes-requested checklist as semantic repair feedback", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, true, false, undefined, 0, undefined, false, true),
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
      semanticRepair: { attemptsUsed: 1, resolved: true },
      validation: { passed: true },
    });
    expect((completedRun?.output as { qaRetry?: { attemptsUsed?: number; resolved?: boolean } }).qaRetry)
      .toMatchObject({ attemptsUsed: 0, resolved: true });
    const stepIds = (await services.runs.listByOrchestrationRunId(started.runId)).map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    );
    expect(stepIds).toEqual([
      "scope", "build", "repair-1", "runtime", "qa",
      "semantic-repair-1", "qa-recheck-1", "memory",
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

  it("stops for human review when targeted QA checklist completion remains unusable", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, false, false, undefined, 0, undefined, false, false, true),
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
      qaRetry: { attemptsUsed: 0, exhausted: false },
      qaChecklistCompletion: {
        attemptsUsed: 1,
        maxAttempts: 1,
        resolved: false,
        exhausted: true,
        finalStepId: "qa-checklist-completion-1",
        missingCriteria: buildOperatorGoalContract("Create a complete 3-day operating plan.").criteria,
        blockerMessages: ["QA returned an explicit verdict without complete checklist evidence after one targeted completion; human review is required."],
      },
    });
    const stepIds = (await services.runs.listByOrchestrationRunId(started.runId)).map((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId,
    );
    expect(stepIds).toContain("qa-checklist-completion-1");
    expect(stepIds).not.toContain("qa-format-retry-1");
    expect(stepIds).not.toContain("semantic-repair-1");
  });

  it("completes only the missing QA checklist criterion before approving the run", async () => {
    await server.close();
    services = await createAppServices({
      storageMode: "memory",
      atelierRoot,
      inlineDurableRuntime: false,
      agentExecutor: createRepairScenarioExecutor(true, false, false, undefined, 0, undefined, false, true, false, true),
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
      qaRetry: { attemptsUsed: 0, resolved: true, exhausted: false },
      qaChecklistCompletion: {
        attemptsUsed: 1,
        maxAttempts: 1,
        resolved: true,
        exhausted: false,
        finalStepId: "qa-checklist-completion-1",
        missingCriteria: [buildOperatorGoalContract("Create a complete 3-day operating plan.").criteria[1]],
      },
      qaChecklist: { complete: true },
      validation: { passed: true },
    });
    const completionRun = (await services.runs.listByOrchestrationRunId(started.runId)).find((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "qa-checklist-completion-1",
    );
    expect((completionRun?.output as { response?: string }).response).toContain("AC-1: The requested artifact contains exactly 3 explicit Day entries");
    expect((completionRun?.output as { response?: string }).response).toContain("AC-2: The deliverable is a complete standalone plan");
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

  it("stops a semantic repair loop once a valid repair produces no artifact progress", async () => {
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
        attemptsUsed: 2,
        resolved: false,
        exhausted: false,
        finalStepId: "semantic-repair-2",
        lastValidArtifactStepId: "semantic-repair-1",
        lastQaStepId: "qa-recheck-1",
      },
      repairStall: { kind: "no-artifact-progress", repairStepId: "semantic-repair-2" },
      validation: { passed: false },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.filter((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId?.startsWith("semantic-repair-"),
    )).toHaveLength(2);
    expect(childRuns.some((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "memory",
    )).toBe(false);
    const reloadedStatus = (await server.inject({
      method: "GET",
      url: `/orchestrations/${started.runId}/status`,
    })).json();
    expect(reloadedStatus).toMatchObject({
      repairStall: { kind: "no-artifact-progress", repairStepId: "semantic-repair-2" },
      qualityEvaluation: { verdict: "unverified" },
    });
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

  it("enforces an explicit per-run semantic repair ceiling for a frozen evaluation", async () => {
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
      payload: { goal: "Create a complete 3-day operating plan.", semanticRepairLimit: 1 },
    })).json<StartSkillOrchestrationResponse>();

    expect(await services.durableRuntime.runOnce()).toBe(true);
    const completedRun = await services.runs.getById(started.runId);
    expect(completedRun?.output).toMatchObject({
      readiness: "needs-human",
      semanticRepair: { maxAttempts: 1, attemptsUsed: 1, exhausted: true, finalStepId: "semantic-repair-1" },
      validation: { passed: false },
    });
    const childRuns = await services.runs.listByOrchestrationRunId(started.runId);
    expect(childRuns.some((run) =>
      (run.input as { orchestrationStepId?: string }).orchestrationStepId === "semantic-repair-2",
    )).toBe(false);
  });
});
