import { useState } from "react";
import {
  Archive,
  Check,
  CircleSlash,
  FilePlus2,
  Loader2,
  Play,
  RotateCcw,
  Search,
  ShieldCheck,
  TimerReset,
} from "lucide-react";
import {
  AGENT_ROLES,
  REVIEW_LEARNING_MAX_LENGTH,
  REVIEW_LEARNING_RESOLUTION_NOTE_MAX_LENGTH,
  REVIEW_LEARNING_RESOLUTION_OUTCOMES,
  REVIEW_LEARNING_SIGNALS,
  RUN_REVIEW_STATUSES,
  type AgentRole,
  type ReviewLearningResolutionOutcome,
  type ReviewLearningSignal,
  type Run,
  type Task,
} from "@atellier/shared";
import { ValidationSummary } from "../../components/ValidationSummary";
import { useRunsTimeline } from "../runs/hooks/useRunsTimeline";
import { WikiPanel } from "../wiki/components/WikiPanel";

type TabFilter = "all" | "pending" | "approved" | "changes-requested" | "unlinked";

const TABS: { id: TabFilter; label: string }[] = [
  { id: "all",               label: "All" },
  { id: "pending",           label: "Pending" },
  { id: "approved",          label: "Approved" },
  { id: "changes-requested", label: "Needs changes" },
  { id: "unlinked",          label: "Unlinked" },
];

export function ReviewView() {
  const {
    runList,
    taskList,
    filteredRunList,
    runLogMessages,
    agentFilter,
    reviewFilter,
    isOpenAiExecution,
    executorModel,
    modelProfile,
    isCreatingRun,
    isLoadingRunsWithoutCache,
    isUpdatingRunReview,
    isPromotingRunDeliverable,
    isUnlinkingRunDeliverable,
    isCapturingRunMemory,
    isCuratingRunLearning,
    isResolvingRunLearningSignal,
    capturedMemoryPath,
    capturedRoleMemoryPath,
    resolvedRoleMemoryPath,
    isAppendingRunLog,
    isCompletingRun,
    setAgentFilter,
    setReviewFilter,
    setRunLogMessage,
    handleAppendRunLog,
    startManualRun,
    completeRun,
    setRunReview,
    promoteRunDeliverable,
    unlinkRunDeliverable,
    captureRunMemory,
    curateRunLearning,
    getRunLearningDraft,
    setRunLearningDraft,
    getRunLearningResolutionDraft,
    setRunLearningResolutionDraft,
    resolveRunLearningSignal,
  } = useRunsTimeline();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  const pendingCount   = runList.filter((r) => r.reviewStatus === "pending").length;
  const approvedCount  = runList.filter((r) => r.reviewStatus === "approved").length;
  const changesCount   = runList.filter((r) => r.reviewStatus === "changes-requested").length;
  const unlinkedCount  = runList.filter((r) => !r.reviewStatus).length;

  const tabCounts: Record<TabFilter, number> = {
    all:               runList.length,
    pending:           pendingCount,
    approved:          approvedCount,
    "changes-requested": changesCount,
    unlinked:          unlinkedCount,
  };

  const displayList = filteredRunList.filter((run) => {
    const matchesTab =
      activeTab === "all" ||
      (activeTab === "unlinked" ? !run.reviewStatus : run.reviewStatus === activeTab);

    const q = searchQuery.toLowerCase();
    const matchesSearch =
      !q ||
      run.type.toLowerCase().includes(q) ||
      run.id.toLowerCase().includes(q);

    return matchesTab && matchesSearch;
  });

  const validationAlerts = runList
    .map((run) => {
      const validation = readRunValidation(run);
      if (!validation || validation.passed) {
        return null;
      }
      return validation;
    })
    .filter((validation): validation is NonNullable<ReturnType<typeof readRunValidation>> => Boolean(validation));

  const validationAlertIssues = dedupeValidationIssues(
    validationAlerts.flatMap((validation) => validation.issues ?? []),
  );
  const validationAlertInvalidRefs = [...new Set(
    validationAlerts.flatMap((validation) => validation.invalidReferencedFiles ?? []),
  )].sort();

  return (
    <div className="h-full flex overflow-hidden">
      {/* Main content */}
      <div className="flex-1 min-w-0 overflow-y-auto px-6 py-6">
        {/* Page header */}
        <div className="flex items-center justify-between gap-4 mb-5">
          <div>
            <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">
              Review
            </h1>
            <p className="text-[0.78rem] text-ink-muted mt-1">
              Review agent runs and approve, request changes or unlink results.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <span className="inline-flex items-center gap-1.5 h-7 border border-gold/30 rounded-lg px-3 text-[0.75rem] text-gold bg-gold/10 font-semibold">
                {pendingCount} pending
              </span>
            )}
            <button
              type="button"
              onClick={startManualRun}
              disabled={isCreatingRun}
              className="btn-primary"
            >
              <Play size={14} />
              Start run
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              type="search"
              placeholder="Search by title or ID…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 h-8 w-52 text-[0.8rem]"
              aria-label="Search runs"
            />
          </div>

          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as typeof agentFilter)}
            className="h-8 text-[0.8rem]"
            aria-label="Filter by agent status"
          >
            <option value="all">All agents</option>
            <option value="needs-human">Needs human</option>
            <option value="blocked">Blocked</option>
          </select>

          <select
            value={reviewFilter}
            onChange={(e) => setReviewFilter(e.target.value as typeof reviewFilter)}
            className="h-8 text-[0.8rem]"
            aria-label="Filter by review status"
          >
            <option value="all">All reviews</option>
            {RUN_REVIEW_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <span className="text-[0.72rem] text-ink-faint ml-auto tabular-nums">
            {displayList.length} / {runList.length}
          </span>
        </div>
        {isOpenAiExecution && (
          <p className="mb-4 m-0 border border-orange/30 rounded-lg px-2.5 py-2 text-[0.74rem] text-orange bg-orange/10">
            OpenAI execution is active ({modelProfile} · {executorModel}). Starting manual runs may consume tokens.
          </p>
        )}

        {validationAlerts.length > 0 ? (
          <div className="mb-4">
            <div className="mb-2 text-[0.72rem] font-semibold uppercase tracking-[0.08em] text-ink-faint">
              Validation alerts ({validationAlerts.length})
            </div>
            <ValidationSummary
              validation={{
                role: "aggregate",
                profile: `${validationAlerts.length} affected run${validationAlerts.length === 1 ? "" : "s"}`,
                passed: false,
                issues: validationAlertIssues,
                verifiedRepoFiles: [],
                invalidReferencedFiles: validationAlertInvalidRefs,
                referencedFiles: [],
                candidateFiles: [],
                changedFiles: [],
              }}
            />
          </div>
        ) : null}

        {capturedMemoryPath ? (
          <p className="mb-4 m-0 border border-teal/25 rounded-lg px-2.5 py-2 text-[0.74rem] text-teal bg-teal/10 overflow-wrap-anywhere">
            Captured memory: {capturedMemoryPath}
          </p>
        ) : null}

        {capturedRoleMemoryPath ? (
          <p className="mb-4 m-0 border border-purple/25 rounded-lg px-2.5 py-2 text-[0.74rem] text-purple bg-purple/10 overflow-wrap-anywhere">
            Curated role memory: {capturedRoleMemoryPath}
          </p>
        ) : null}

        {resolvedRoleMemoryPath ? (
          <p className="mb-4 m-0 border border-teal/25 rounded-lg px-2.5 py-2 text-[0.74rem] text-teal bg-teal/10 overflow-wrap-anywhere">
            Resolved role signal: {resolvedRoleMemoryPath}
          </p>
        ) : null}

        {/* Tabs */}
        <div className="review-tabs">
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`review-tab ${activeTab === id ? "review-tab--active" : ""}`}
            >
              {label}
              <span className="review-tab-count">{tabCounts[id]}</span>
            </button>
          ))}
        </div>

        {/* States */}
        {isLoadingRunsWithoutCache && (
          <p className="flex items-center gap-2 border border-[var(--border-card)] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            <Loader2 size={14} className="spin text-purple flex-shrink-0" />
            Loading runs
          </p>
        )}
        {!isLoadingRunsWithoutCache && runList.length === 0 && (
          <p className="border border-dashed border-purple/[0.18] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            No runs yet. Start a manual run to begin.
          </p>
        )}
        {!isLoadingRunsWithoutCache && runList.length > 0 && displayList.length === 0 && (
          <p className="border border-dashed border-purple/[0.18] rounded-xl p-3.5 text-ink-faint text-[0.85rem] bg-purple/[0.02]">
            No runs match current filters.
          </p>
        )}

        {/* Run rows */}
        <div className="grid gap-2">
          {displayList.map((run) => {
            const pendingLog = runLogMessages[run.id]?.trim() ?? "";
            const latestLog  = run.logs.at(-1);
            const isRunning  = run.status === "running";
            const validation = readRunValidation(run);
            const validationHasIssues = Boolean(validation && !validation.passed);
            const linkedTask = run.taskId ? taskList.find((task) => task.id === run.taskId) : undefined;
            const learningDraft = getRunLearningDraft(run);
            const resolutionDraft = getRunLearningResolutionDraft(run.id);

            return (
              <div
                key={run.id}
                className={`border rounded-xl px-4 py-3 transition-all duration-150 ${
                  isRunning
                    ? "border-teal/[0.22] bg-teal/[0.03]"
                    : validationHasIssues
                      ? "run-item--validation-failed border-orange/35 bg-orange/[0.05] hover:border-orange/45"
                      : "border-[var(--border-card)] bg-[var(--bg-card)] hover:border-purple/22"
                }`}
              >
                {/* Summary row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <TimerReset size={15} className="text-ink-faint flex-shrink-0" />
                  <span className="font-semibold text-[0.88rem] text-ink">{run.type}</span>
                  <span className="text-ink-faint text-[0.68rem] font-mono">{run.id.slice(0, 14)}…</span>

                  <div className="flex items-center gap-1.5">
                    <small className={`status-badge status-badge-${run.status}`}>{run.status}</small>
                    {run.reviewStatus && (
                      <small className={`status-badge status-badge-review-${run.reviewStatus}`}>
                        {run.reviewStatus}
                      </small>
                    )}
                    {validationHasIssues ? (
                      <small className="status-badge status-badge-review-changes-requested">
                        validation failed
                      </small>
                    ) : null}
                  </div>

                  <span className="text-ink-faint text-[0.7rem] ml-auto tabular-nums">
                    {run.logs.length} logs
                  </span>
                </div>

                {latestLog && (
                  <p className="mt-1.5 text-[0.72rem] text-ink-muted ml-6 overflow-wrap-anywhere">
                    {latestLog.level}: {latestLog.message}
                  </p>
                )}

                {linkedTask ? <DailyLoopChain run={run} task={linkedTask} /> : null}

                {run.type === "orchestration" ? <OrchestrationArtifactReview run={run} /> : null}

                {validation ? (
                  <div className="mt-2 ml-6">
                    <ValidationSummary validation={validation} />
                  </div>
                ) : null}

                {/* Running: append log + complete */}
                {run.status !== "completed" && (
                  <div className="grid grid-cols-[1fr_auto] gap-2 mt-2.5 ml-6">
                    <form
                      className="grid grid-cols-[1fr_auto] gap-1.5"
                      onSubmit={(e) => handleAppendRunLog(e, run.id)}
                    >
                      <input
                        aria-label={`Log message for ${run.type}`}
                        value={runLogMessages[run.id] ?? ""}
                        onChange={(e) => setRunLogMessage(run.id, e.target.value)}
                        placeholder="Append log message…"
                        className="h-8 text-[0.8rem]"
                      />
                      <button
                        type="submit"
                        disabled={isAppendingRunLog || pendingLog.length === 0}
                        className="btn-ghost h-8 px-3 text-[0.78rem]"
                      >
                        <FilePlus2 size={13} />
                        Log
                      </button>
                    </form>
                    <button
                      type="button"
                      className="icon-only-button"
                      onClick={() => completeRun(run.id)}
                      disabled={isCompletingRun}
                      title="Complete run"
                      aria-label="Complete run"
                    >
                      <Check size={14} />
                    </button>
                  </div>
                )}

                {/* Completed: review actions inline */}
                {run.status === "completed" && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-2.5 ml-6">
                    {!run.deliverablePath ? (
                      <button
                        type="button"
                        className="btn-ghost h-7 px-2.5 text-[0.75rem]"
                        onClick={() => promoteRunDeliverable(run.id)}
                        disabled={isPromotingRunDeliverable}
                      >
                        <FilePlus2 size={13} />
                        Promote
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn-ghost h-7 px-2.5 text-[0.75rem]"
                        onClick={() => unlinkRunDeliverable(run.id)}
                        disabled={isUnlinkingRunDeliverable}
                      >
                        <CircleSlash size={13} />
                        Unlink
                      </button>
                    )}

                    <button
                      type="button"
                      className="h-7 px-2.5 text-[0.75rem] border-green-400/35 text-green-400 bg-green-400/10 hover:bg-green-400/20"
                      onClick={() => setRunReview(run.id, "approved")}
                      disabled={isUpdatingRunReview || validationHasIssues || run.reviewStatus === "approved"}
                      title={validationHasIssues ? "Validation failed. Resolve issues before approving." : "Approve run"}
                    >
                      <ShieldCheck size={13} />
                      Approve
                    </button>

                    <button
                      type="button"
                      className="h-7 px-2.5 text-[0.75rem] border-orange/35 text-orange bg-orange/10 hover:bg-orange/20"
                      onClick={() => setRunReview(run.id, "changes-requested")}
                      disabled={isUpdatingRunReview || run.reviewStatus === "changes-requested"}
                    >
                      <CircleSlash size={13} />
                      Request changes
                    </button>

                    <button
                      type="button"
                      className="h-7 px-2.5 text-[0.75rem] border-teal/35 text-teal bg-teal/10 hover:bg-teal/20"
                      onClick={() => captureRunMemory(run.id)}
                      disabled={isCapturingRunMemory || run.reviewStatus !== "approved" || Boolean(run.memory)}
                      title={run.memory ? `Memory captured at ${run.memory.wikiPath}` : "Approve the run before capturing review memory"}
                    >
                      <Archive size={13} />
                      {run.memory ? "Memory captured" : "Capture memory"}
                    </button>

                    <button
                      type="button"
                      className="icon-only-button w-7 min-w-[28px] h-7"
                      onClick={() => setRunReview(run.id, "pending")}
                      disabled={isUpdatingRunReview || run.reviewStatus === "pending"}
                      title="Reset to pending"
                      aria-label="Reset to pending review"
                    >
                      <RotateCcw size={13} />
                    </button>
                  </div>
                )}

                {run.status === "completed" && run.reviewStatus === "approved" && run.memory && !run.memory.learning ? (
                  <div className="mt-2.5 ml-6 border border-purple/20 rounded-lg p-2.5 bg-purple/[0.04]">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <p className="m-0 text-[0.68rem] font-bold tracking-[0.08em] uppercase text-purple">
                        Curate approved learning
                      </p>
                      <span className="text-[0.66rem] text-ink-faint">Explicit Wiki write</span>
                    </div>
                    <div className="grid grid-cols-[minmax(120px,0.35fr)_1fr] gap-2">
                      <select
                        aria-label={`Learning role for ${run.id}`}
                        value={learningDraft.role}
                        onChange={(event) => setRunLearningDraft(run.id, { role: event.target.value as AgentRole })}
                        disabled={isCuratingRunLearning}
                      >
                        {AGENT_ROLES.map((role) => (
                          <option key={role} value={role}>{role}</option>
                        ))}
                      </select>
                      <input
                        aria-label={`Learning note for ${run.id}`}
                        value={learningDraft.lesson}
                        maxLength={REVIEW_LEARNING_MAX_LENGTH}
                        onChange={(event) => setRunLearningDraft(run.id, { lesson: event.target.value })}
                        disabled={isCuratingRunLearning}
                      />
                      <select
                        aria-label={`Curation signal for ${run.id}`}
                        value={learningDraft.signal}
                        onChange={(event) => setRunLearningDraft(run.id, {
                          signal: event.target.value as ReviewLearningSignal | "",
                        })}
                        disabled={isCuratingRunLearning}
                      >
                        <option value="">No curation signal</option>
                        {REVIEW_LEARNING_SIGNALS.map((signal) => (
                          <option key={signal} value={signal}>{signal}</option>
                        ))}
                      </select>
                      {learningDraft.signal ? (
                        <input
                          aria-label={`Curation signal path for ${run.id}`}
                          value={learningDraft.signalPath}
                          onChange={(event) => setRunLearningDraft(run.id, { signalPath: event.target.value })}
                          placeholder="wiki/path/to-page.md"
                          disabled={isCuratingRunLearning}
                        />
                      ) : (
                        <p className="m-0 self-center text-[0.68rem] text-ink-faint">
                          Optional signals appear in Wiki lint and Knowledge Graph.
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="mt-2 h-7 px-2.5 text-[0.75rem] border-purple/35 text-purple bg-purple/10 hover:bg-purple/20"
                      onClick={() => curateRunLearning(run)}
                      disabled={
                        isCuratingRunLearning ||
                        !learningDraft.lesson.trim() ||
                        Boolean(learningDraft.signal && !learningDraft.signalPath.trim())
                      }
                    >
                      <Archive size={13} />
                      {isCuratingRunLearning ? "Curating..." : "Curate learning"}
                    </button>
                  </div>
                ) : null}

                {run.memory?.learning ? (
                  <div className="mt-2 ml-6 border border-purple/15 rounded-lg p-2.5 bg-purple/[0.03] text-[0.68rem] text-purple overflow-wrap-anywhere">
                    <p className="m-0">
                      Role learning: {run.memory.learning.role} · {run.memory.learning.roleMemoryPath}
                      {run.memory.learning.signal
                        ? ` · ${run.memory.learning.signal}: ${run.memory.learning.signalPath}`
                        : ""}
                    </p>
                    {run.memory.learning.resolution ? (
                      <p className="mt-1 mb-0 text-teal">
                        Signal {run.memory.learning.resolution.outcome}: {run.memory.learning.resolution.note}
                      </p>
                    ) : run.memory.learning.signal ? (
                      <div className="mt-2 grid grid-cols-[minmax(120px,0.3fr)_1fr_auto] gap-2">
                        <select
                          aria-label={`Signal resolution outcome for ${run.id}`}
                          value={resolutionDraft.outcome}
                          onChange={(event) => setRunLearningResolutionDraft(run.id, {
                            outcome: event.target.value as ReviewLearningResolutionOutcome,
                          })}
                          disabled={isResolvingRunLearningSignal}
                        >
                          {REVIEW_LEARNING_RESOLUTION_OUTCOMES.map((outcome) => (
                            <option key={outcome} value={outcome}>{outcome}</option>
                          ))}
                        </select>
                        <input
                          aria-label={`Signal resolution note for ${run.id}`}
                          value={resolutionDraft.note}
                          maxLength={REVIEW_LEARNING_RESOLUTION_NOTE_MAX_LENGTH}
                          placeholder="Record why this signal can be closed…"
                          onChange={(event) => setRunLearningResolutionDraft(run.id, { note: event.target.value })}
                          disabled={isResolvingRunLearningSignal}
                        />
                        <button
                          type="button"
                          className="h-8 px-2.5 text-[0.72rem] border-teal/35 text-teal bg-teal/10 hover:bg-teal/20"
                          onClick={() => resolveRunLearningSignal(run.id)}
                          disabled={isResolvingRunLearningSignal || !resolutionDraft.note.trim()}
                        >
                          {isResolvingRunLearningSignal ? "Resolving..." : "Resolve signal"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {/* Right panel: Wiki tools */}
      <aside className="w-[300px] flex-shrink-0 border-l border-[var(--border-subtle)] overflow-y-auto bg-[var(--bg-sidebar)]">
        <div className="p-4">
          <p className="eyebrow mb-3">Tools</p>
          <WikiPanel />
        </div>
      </aside>
    </div>
  );
}

type OrchestrationReviewOutput = {
  artifact?: { content?: string; sourceRunId?: string; stepId?: string };
  repair?: { finalStepId?: string };
  qaRetry?: {
    attemptsUsed?: number;
    maxAttempts?: number;
    exhausted?: boolean;
    finalStepId?: string;
  };
  semanticRepair?: {
    attemptsUsed?: number;
    maxAttempts?: number;
    exhausted?: boolean;
    finalStepId?: string;
    lastValidArtifactStepId?: string;
    lastQaStepId?: string;
  };
};

function OrchestrationArtifactReview({ run }: { run: Run }) {
  const output = run.output as OrchestrationReviewOutput | undefined;
  const artifact = output?.artifact;
  const qaRetry = output?.qaRetry;
  const semantic = output?.semanticRepair;
  if (!artifact?.content && !qaRetry && !semantic) return null;

  return (
    <div className="mt-2 ml-6 rounded-lg border border-purple/20 bg-purple/[0.04] px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.7rem] text-ink-muted">
        <strong className="text-ink text-[0.74rem]">Reviewable artifact</strong>
        {artifact?.stepId ? <span>Preserved from: <b className="text-teal">{artifact.stepId}</b></span> : null}
        {semantic?.finalStepId ? <span>Latest attempt: <b className="text-orange">{semantic.finalStepId}</b></span> : null}
        {semantic?.lastQaStepId ? <span>Last QA: <b className="text-ink">{semantic.lastQaStepId}</b></span> : null}
        {qaRetry?.attemptsUsed ? (
          <span>{qaRetry.attemptsUsed}/{qaRetry.maxAttempts ?? 2} QA format retries</span>
        ) : null}
        {semantic?.attemptsUsed ? (
          <span>{semantic.attemptsUsed}/{semantic.maxAttempts ?? 3} semantic attempts</span>
        ) : null}
      </div>
      {semantic?.exhausted ? (
        <p className="m-0 mt-1.5 text-[0.7rem] text-orange">
          Semantic repair exhausted. The artifact below remains reviewable, but approval and memory stay blocked.
        </p>
      ) : null}
      {qaRetry?.exhausted ? (
        <p className="m-0 mt-1.5 text-[0.7rem] text-orange">
          QA format retries exhausted. The artifact remains reviewable, but semantic repair, approval, and memory stay blocked.
        </p>
      ) : null}
      {artifact?.content ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[0.72rem] font-semibold text-purple hover:text-ink">
            Inspect preserved artifact
          </summary>
          <pre className="mt-2 mb-0 max-h-[32rem] overflow-auto whitespace-pre-wrap rounded-md border border-[var(--border-card)] bg-[var(--bg-app)] p-3 font-sans text-[0.72rem] leading-[1.55] text-ink-muted">
            {artifact.content}
          </pre>
        </details>
      ) : (
        <p className="m-0 mt-1.5 text-[0.7rem] text-orange">No valid artifact is available for review.</p>
      )}
    </div>
  );
}

function DailyLoopChain({ run, task }: { run: Run; task: Task }) {
  const stages = [
    { label: "Source", value: `${task.sourceIds?.length ?? 0} linked`, complete: Boolean(task.sourceIds?.length) },
    { label: "Task", value: task.status, complete: true },
    { label: "Run", value: run.status, complete: run.status === "completed" },
    { label: "Deliverable", value: run.deliverablePath ? "ready" : "missing", complete: Boolean(run.deliverablePath) },
    { label: "QA", value: hasQaEvidence(run) ? "passed" : "pending", complete: hasQaEvidence(run) },
    { label: "Review", value: run.reviewStatus ?? "unlinked", complete: run.reviewStatus === "approved" },
    { label: "Memory", value: run.memory ? "captured" : "pending", complete: Boolean(run.memory) },
    {
      label: "Learning",
      value: run.memory?.learning ? run.memory.learning.role : "pending",
      complete: Boolean(run.memory?.learning),
    },
    {
      label: "Signal",
      value: run.memory?.learning?.signal
        ? run.memory.learning.resolution?.outcome ?? "open"
        : "none",
      complete: !run.memory?.learning?.signal || Boolean(run.memory.learning.resolution),
    },
  ];

  return (
    <div className="mt-2 ml-6 border border-[var(--border-card)] rounded-lg p-2 bg-black/15" aria-label={`Daily loop for ${task.title}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className="m-0 text-[0.68rem] font-bold tracking-[0.08em] uppercase text-ink-faint">Daily loop</p>
        <p className="m-0 text-[0.7rem] text-teal overflow-hidden text-ellipsis whitespace-nowrap" title={task.title}>
          {task.title}
        </p>
      </div>
      <div className="flex flex-wrap gap-1">
        {stages.map((stage) => (
          <span
            key={stage.label}
            className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[0.66rem] ${
              stage.complete
                ? "border-teal/25 bg-teal/[0.06] text-teal"
                : "border-[var(--border-card)] bg-white/[0.02] text-ink-faint"
            }`}
          >
            <strong>{stage.label}</strong>
            <span>{stage.value}</span>
          </span>
        ))}
      </div>
      {task.sourceIds?.length ? (
        <p className="mt-1.5 mb-0 text-[0.66rem] text-ink-faint overflow-wrap-anywhere">
          Sources: {task.sourceIds.join(" · ")}
        </p>
      ) : null}
      {run.memory ? (
        <p className="mt-1 mb-0 text-[0.66rem] text-teal overflow-wrap-anywhere">
          Memory: {run.memory.wikiPath}
        </p>
      ) : null}
    </div>
  );
}

function hasQaEvidence(run: Run): boolean {
  const validation = readRunValidation(run);
  if (validation) {
    return Boolean(validation.passed);
  }

  const steps = (run.output as { steps?: Array<{ stepId?: string; status?: string }> } | undefined)?.steps;
  return Boolean(steps?.some((step) => ["qa", "approve"].includes(step.stepId ?? "") && step.status === "completed"));
}

function readRunValidation(run: {
  output?: unknown;
}) {
  const output = run.output as
    | {
        validation?: {
          role?: string;
          profile?: string;
          passed?: boolean;
          issues?: Array<{ code?: string; message?: string; severity?: string }>;
          verifiedRepoFiles?: string[];
          invalidReferencedFiles?: string[];
          referencedFiles?: string[];
          candidateFiles?: string[];
          changedFiles?: string[];
        };
      }
    | undefined;

  return output?.validation ?? null;
}

function dedupeValidationIssues<T extends { code?: string; message?: string; severity?: string }>(issues: T[]): T[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = [issue.code, issue.message, issue.severity].join("|");
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
