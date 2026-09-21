import { useState } from "react";
import { Activity, Database, Info, Loader2, RefreshCw, Server, Wrench, Zap } from "lucide-react";
import { useHealthApi } from "../../api/hooks/system/useSystemApi";
import { useToolHarnessSettings } from "./hooks/useToolHarnessSettings";

function bytesToMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(1);
}

export function SettingsView() {
  const { data: health, isLoadingWithoutCache } = useHealthApi();
  const [learningNotes, setLearningNotes] = useState<Record<string, string>>({});
  const [shadowObservations, setShadowObservations] = useState<Record<string, { quality: "better" | "same" | "worse"; note: string }>>({});
  const {
    toolHarnessCatalog,
    toolHarnessError,
    isLoadingToolHarness,
    evaluationLedgerSummary,
    learningCandidates,
    decideLearningCandidate,
    isDecidingLearningCandidate,
    prepareLearningExperiment,
    isPreparingLearningExperiment,
    preparedExperiments,
    recordLearningShadowObservation,
    isRecordingShadowObservation,
    compareLearningShadowExperiment,
    isComparingShadowExperiment,
    shadowComparisons,
    controlBundles = [],
    controlBundleProposals = [],
    controlBundleCanaries = [],
    workspaceChanges = [],
    supervisedCodeChanges = [],
    evaluationLedgerEvidencePairs = [],
    controlBundleBudgetReceipts = [],
    prepareSupervisedCodeChange,
    isPreparingSupervisedCodeChange,
    verifySupervisedCodeChange,
    isVerifyingSupervisedCodeChange,
    discardSupervisedCodeChange,
    isDiscardingSupervisedCodeChange,
    refreshOperatorState,
    isRefreshingOperatorState,
  } = useToolHarnessSettings();

  return (
    <div className="h-full w-full overflow-y-auto px-6 py-5">
      {/* Header */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div>
        <p className="eyebrow">Configuration</p>
        <h1 className="text-[2rem] font-extrabold tracking-[-0.03em] text-ink leading-none">Settings</h1>
        </div>
        <button type="button" onClick={() => void refreshOperatorState()} disabled={isRefreshingOperatorState} className="flex items-center gap-2 rounded-lg border border-[var(--border-card)] px-3 py-2 text-[0.75rem] font-semibold text-ink transition hover:border-purple disabled:opacity-50">
          <RefreshCw size={14} className={isRefreshingOperatorState ? "spin" : ""} />
          {isRefreshingOperatorState ? "Refreshing…" : "Refresh operator state"}
        </button>
      </div>

      {isLoadingWithoutCache ? (
        <p className="flex items-center gap-2 text-ink-faint text-[0.85rem]">
          <Loader2 size={14} className="spin text-purple" />
          Loading system info…
        </p>
      ) : (
        <div className="grid gap-4 max-w-2xl">
          {/* Executor */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Zap size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">Runtime</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Executor</h2>
              </div>
              {health && (
                <span
                  className={`ml-auto status-badge ${
                    health.executorMode === "openai"
                      ? "status-badge-running"
                      : "status-badge"
                  }`}
                >
                  {health.executorMode}
                </span>
              )}
            </div>
            {health ? (
              <div className="grid gap-2">
                {[
                  { label: "Mode",    value: health.executorMode },
                  { label: "Model",   value: health.executorModel },
                  { label: "Profile", value: health.modelProfile },
                  ...Object.entries(health.executorRoleOverrides ?? {}).map(([role, model]) => ({
                    label: `${role.toUpperCase()} model`,
                    value: model,
                  })),
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.8rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No executor data available.</p>
            )}
            {health?.executorMode === "openai" && (
              <p className="mt-3 text-[0.78rem] text-orange border border-orange/25 rounded-lg px-3 py-2 bg-orange/[0.06]">
                OpenAI execution is active. Review goals and scope before running agents.
              </p>
            )}
          </section>

          {evaluationLedgerSummary && (
            <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <p className="eyebrow !mb-0">Learning evidence</p>
              <h2 className="mt-1 text-[1rem] font-bold text-ink">Evaluation ledger</h2>
              <div className="grid grid-cols-2 gap-2 mt-3">
                {[
                  { label: "Evaluated runs", value: evaluationLedgerSummary.total },
                  { label: "Passed", value: evaluationLedgerSummary.outcomes.passed },
                  { label: "Needs human", value: evaluationLedgerSummary.outcomes["needs-human"] },
                  { label: "Failed", value: evaluationLedgerSummary.outcomes.failed },
                  { label: "Cancelled", value: evaluationLedgerSummary.outcomes.cancelled },
                  { label: "Tool successes", value: evaluationLedgerSummary.toolInvocations.succeeded },
                ].map(({ label, value }) => <div key={label} className="flex justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"><span className="text-[0.78rem] text-ink-muted">{label}</span><span className="text-[0.82rem] font-semibold text-ink">{value}</span></div>)}
              </div>
            </section>
          )}
          {learningCandidates.length > 0 && (
            <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)]">
              <p className="eyebrow !mb-0">Human review required</p>
              <h2 className="mt-1 text-[1rem] font-bold text-ink">Learning candidates</h2>
              {learningCandidates.map((candidate) => {
                const note = learningNotes[candidate.id] ?? "";
                const pending = candidate.status === "pending-review";
                return (
                  <div key={candidate.id} className="mt-3 border border-[var(--border-card)] rounded-lg p-3">
                    <p className="font-semibold text-ink">{candidate.title}</p>
                    <p className="mt-1 text-[0.78rem] text-ink-muted">{candidate.rationale}</p>
                    {pending ? (
                      <>
                        <label className="mt-3 block text-[0.72rem] text-ink-muted" htmlFor={`learning-note-${candidate.id}`}>Operator note</label>
                        <textarea
                          id={`learning-note-${candidate.id}`}
                          value={note}
                          onChange={(event) => setLearningNotes((current) => ({ ...current, [candidate.id]: event.target.value }))}
                          maxLength={2000}
                          placeholder="Why should this candidate be accepted, rejected, or deferred?"
                          className="mt-1 min-h-20 w-full rounded-lg border border-[var(--border-card)] bg-white/[0.02] px-3 py-2 text-[0.78rem] text-ink placeholder:text-ink-faint"
                        />
                        <div className="mt-2 flex flex-wrap gap-2">
                          {([
                            ["accepted", "Accept for experiment"],
                            ["rejected", "Reject"],
                            ["deferred", "Defer"],
                          ] as const).map(([decision, label]) => (
                            <button
                              key={decision}
                              type="button"
                              disabled={!note.trim() || isDecidingLearningCandidate}
                              onClick={() => decideLearningCandidate(candidate, decision, note)}
                              className="rounded-md border border-[var(--border-card)] px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink transition hover:border-purple disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {label}
                            </button>
                          ))}
                        </div>
                        <p className="mt-2 text-[0.72rem] text-orange">No policy, memory, routing, or permission changes automatically.</p>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-[0.72rem] text-teal">{candidate.status.replace(/-/g, " ")}</p>
                        {candidate.decision && <p className="mt-1 text-[0.72rem] text-ink-muted">{candidate.decision.note}</p>}
                        {candidate.status === "accepted-for-experiment" && candidate.decision && (
                          <>
                            {!preparedExperiments[candidate.id] ? (
                              <button type="button" disabled={isPreparingLearningExperiment} onClick={() => prepareLearningExperiment(candidate, candidate.decision!.note)} className="mt-2 rounded-md border border-[var(--border-card)] px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink transition hover:border-purple disabled:opacity-50">Prepare shadow experiment</button>
                            ) : (() => {
                              const observation = shadowObservations[candidate.id] ?? { quality: "same" as const, note: "" };
                              const comparison = shadowComparisons[candidate.id]; return <div className="mt-3 border-t border-[var(--border-card)] pt-3"><p className="text-[0.72rem] text-ink-muted">Shadow observation — evidence only</p><select aria-label={`Shadow quality ${candidate.id}`} value={observation.quality} onChange={(event) => setShadowObservations((current) => ({ ...current, [candidate.id]: { ...observation, quality: event.target.value as typeof observation.quality } }))} className="mt-1 rounded border border-[var(--border-card)] bg-transparent px-2 py-1 text-[0.72rem] text-ink"><option value="better">better</option><option value="same">same</option><option value="worse">worse</option></select><textarea value={observation.note} onChange={(event) => setShadowObservations((current) => ({ ...current, [candidate.id]: { ...observation, note: event.target.value } }))} placeholder="Observed evidence" className="mt-2 min-h-16 w-full rounded border border-[var(--border-card)] bg-white/[0.02] px-2 py-1 text-[0.72rem] text-ink" /><div className="mt-2 flex gap-2"><button type="button" disabled={!observation.note.trim() || isRecordingShadowObservation} onClick={() => recordLearningShadowObservation({ experimentId: preparedExperiments[candidate.id]!, quality: observation.quality, note: observation.note })} className="rounded-md border border-[var(--border-card)] px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink disabled:opacity-50">Record observation</button><button type="button" disabled={isComparingShadowExperiment} onClick={() => compareLearningShadowExperiment(candidate.id, preparedExperiments[candidate.id]!)} className="rounded-md border border-[var(--border-card)] px-2.5 py-1.5 text-[0.72rem] font-semibold text-ink disabled:opacity-50">Compare</button></div>{comparison && <p className="mt-2 text-[0.72rem] text-ink-muted">{comparison.verdict} · {comparison.observations} observation(s) · better {comparison.quality.better} / worse {comparison.quality.worse}</p>}</div>;
                            })()}
                          </>
                        )}
                      </>
                    )}
                    {candidate.history && candidate.history.length > 1 && (
                      <p className="mt-2 text-[0.7rem] text-ink-faint">
                        {candidate.history.length} immutable review records across evidence revisions.
                      </p>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)]">
            <p className="eyebrow !mb-0">Governed configuration</p><h2 className="mt-1 text-[1rem] font-bold text-ink">Control Bundles</h2>
            {controlBundles.length ? controlBundles.map((bundle) => <div key={bundle.id} className="mt-2 rounded-lg border border-[var(--border-card)] px-3 py-2"><p className="text-[0.8rem] font-semibold text-ink">{bundle.id} · {bundle.status}</p><p className="mt-1 text-[0.72rem] text-ink-muted">Retries {bundle.limits.maxRetries} · timeout {bundle.limits.executionTimeoutMs}ms · {bundle.allowedTools.length} allowed tools</p><p className="mt-1 text-[0.7rem] text-orange">Draft only — not active in runtime.</p></div>) : <p className="mt-2 text-[0.8rem] text-ink-faint">No Control Bundle drafts yet.</p>}
            <div className="mt-3 grid gap-2 border-t border-[var(--border-card)] pt-3 text-[0.75rem]">
              <p className="font-semibold text-ink">Governance receipts</p>
              <p className="text-ink-muted">{controlBundleProposals.length} proposal(s) · {controlBundleCanaries.length} planned or rolled-back canary record(s)</p>
              {controlBundleProposals.slice(0, 3).map((proposal) => <div key={proposal.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{proposal.status}</span><span className="text-ink-muted"> · {proposal.id} · evidence {proposal.evidenceDigest.slice(0, 12)}</span></div>)}
              {controlBundleCanaries.slice(0, 3).map((canary) => <div key={canary.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{canary.status}</span><span className="text-ink-muted"> · {canary.samplePercent}% · {canary.id} · frozen {canary.fingerprint.slice(0, 12)}</span></div>)}
              <p className="mt-1 text-[0.7rem] text-orange">Canary receipts are inspectable here; only a selected, server-bound run can consume a frozen runtime budget.</p>
            </div>
            <div className="mt-3 grid gap-2 border-t border-[var(--border-card)] pt-3 text-[0.75rem]">
              <p className="font-semibold text-ink">Frozen canary budgets</p>
              {controlBundleBudgetReceipts.length ? controlBundleBudgetReceipts.slice(0, 3).map((receipt) => <div key={receipt.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{receipt.status}</span><span className="text-ink-muted"> · bucket {receipt.selectionBucket} · {receipt.runId}</span>{receipt.reason && <p className="mt-1 text-orange">{receipt.reason}</p>}</div>) : <p className="text-ink-faint">No frozen canary budget receipts yet.</p>}
              <p className="text-[0.7rem] text-orange">A receipt is reserved only inside the deterministic sample and within local limits; it does not alter global routing.</p>
            </div>
            <div className="mt-3 grid gap-2 border-t border-[var(--border-card)] pt-3 text-[0.75rem]">
              <p className="font-semibold text-ink">Paired ledger evidence</p>
              {evaluationLedgerEvidencePairs.length ? evaluationLedgerEvidencePairs.slice(0, 3).map((pair) => <div key={pair.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{pair.verdict}</span><span className="text-ink-muted"> · {pair.experimentId} · {pair.baseline.runId} → {pair.shadow.runId}</span></div>) : <p className="text-ink-faint">No paired Evaluation Ledger receipts yet.</p>}
              <p className="text-[0.7rem] text-orange">Only receipt-derived pairs can make a proposal eligible; manual observations remain informational.</p>
            </div>
            <div className="mt-3 grid gap-2 border-t border-[var(--border-card)] pt-3 text-[0.75rem]">
              <p className="font-semibold text-ink">Workspace change receipts</p>
              {workspaceChanges.length ? workspaceChanges.slice(0, 3).map((change) => <div key={change.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{change.status}</span><span className="text-ink-muted"> · {change.path}</span>{change.rollbackHandle && <p className="mt-1 text-ink-muted">rollback {change.rollbackHandle.slice(0, 12)}</p>}{change.lastEffect && <p className="mt-1 text-ink-faint">{change.lastEffect.operation} receipt {change.lastEffect.fingerprint.slice(0, 12)}</p>}{change.status === "approved" && (change.path.startsWith("apps/") || change.path.startsWith("packages/")) ? <button type="button" className="mt-2 text-xs" disabled={isPreparingSupervisedCodeChange} onClick={() => prepareSupervisedCodeChange(change.id)}>Prepare isolated worktree</button> : null}</div>) : <p className="text-ink-faint">No reversible workspace previews yet.</p>}
              <p className="text-[0.7rem] text-orange">Apply and rollback remain disabled by default.</p>
            </div>
            <div className="mt-3 grid gap-2 border-t border-[var(--border-card)] pt-3 text-[0.75rem]">
              <p className="font-semibold text-ink">Supervised code worktrees</p>
              {supervisedCodeChanges.length ? supervisedCodeChanges.slice(0, 3).map((change) => {
                const interrupted = change.verificationReceipts.find((receipt) => receipt.termination === "cancelled" || receipt.termination === "timed-out");
                return <div key={change.id} className="rounded border border-[var(--border-card)] px-2 py-1.5"><span className="font-semibold text-ink">{change.status}</span><span className="text-ink-muted"> · {change.targetPath}</span><p className="mt-1 text-ink-faint">{change.verificationReceipts.filter((receipt) => receipt.status === "passed").length}/{change.verificationPlan.length} server checks passed · {change.baseRevision.slice(0, 12)}</p>{interrupted ? <p className="mt-1 text-orange">{interrupted.check} {interrupted.termination}</p> : null}{change.status === "prepared" ? <button type="button" className="mt-2 text-xs" disabled={isVerifyingSupervisedCodeChange} onClick={() => verifySupervisedCodeChange(change.id)}>Run server checks</button> : null}{change.status === "verification-failed" ? <p className="mt-1 text-orange">Verification failed; create a new reviewed preview instead of retrying this receipt.</p> : null}{change.status !== "discarded" ? <button type="button" className="mt-2 ml-2 text-xs border-orange/35 text-orange" disabled={isDiscardingSupervisedCodeChange || isVerifyingSupervisedCodeChange} onClick={() => discardSupervisedCodeChange(change.id)}>Discard worktree</button> : null}</div>;
              }) : <p className="text-ink-faint">No isolated supervised code changes yet.</p>}
              <p className="text-[0.7rem] text-orange">Previews stay in disposable worktrees; this view never merges or writes the primary checkout.</p>
            </div>
          </section>

          {/* Storage */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Database size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">Persistence</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Storage</h2>
              </div>
              {health && (
                <span
                  className={`ml-auto status-badge ${
                    health.mongo.connected ? "status-badge-completed" : "status-badge-blocked"
                  }`}
                >
                  {health.mongo.connected ? "connected" : "disconnected"}
                </span>
              )}
            </div>
            {health ? (
              <div className="grid gap-2">
                {[
                  { label: "Storage mode",  value: health.storageMode },
                  { label: "MongoDB state", value: health.mongo.state },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.8rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No storage data available.</p>
            )}
          </section>

          {/* System metrics */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Server size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">System</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Metrics</h2>
              </div>
            </div>
            {health ? (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: "Agents total",  value: String(health.metrics.agentsTotal) },
                  { label: "Waiting agents",value: String(health.metrics.waitingAgents) },
                  { label: "Active runs",   value: String(health.metrics.activeRuns) },
                  { label: "RSS memory",    value: `${bytesToMB(health.memory.rssBytes)} MB` },
                  { label: "Heap used",     value: `${bytesToMB(health.memory.heapUsedBytes)} MB` },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                  >
                    <span className="text-[0.78rem] text-ink-muted">{label}</span>
                    <span className="text-[0.82rem] font-semibold text-ink tabular-nums">{value}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No metrics available.</p>
            )}
          </section>

          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Wrench size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">Harness</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">Tool capabilities</h2>
              </div>
              {toolHarnessCatalog && (
                <span className="ml-auto status-badge">{toolHarnessCatalog.definitions.length} catalogued</span>
              )}
            </div>
            {isLoadingToolHarness ? (
              <p className="flex items-center gap-2 text-[0.8rem] text-ink-faint">
                <Loader2 size={14} className="spin text-purple" />
                Loading capability policy…
              </p>
            ) : toolHarnessError ? (
              <p className="text-[0.8rem] text-orange">Capability policy is unavailable.</p>
            ) : toolHarnessCatalog ? (
              <>
                <div className="grid gap-2">
                  {toolHarnessCatalog.definitions.map((definition) => (
                    <div key={definition.name} className="border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[0.82rem] font-semibold text-ink">{definition.label}</span>
                        <span className="text-[0.72rem] text-ink-muted">{definition.classification} · {definition.autonomy}</span>
                      </div>
                      <p className="mt-1 text-[0.75rem] leading-5 text-ink-muted">{definition.description}</p>
                      <p className="mt-1 text-[0.72rem] text-ink-faint">Roles: {definition.allowedRoles.join(", ")}</p>
                      <p className="mt-1 text-[0.72rem] text-ink-faint">Adapter: {definition.executionState}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[0.76rem] leading-5 text-ink-muted">{toolHarnessCatalog.safetySummary}</p>
              </>
            ) : (
              <p className="text-[0.8rem] text-ink-faint">No capability policy is available.</p>
            )}
          </section>

          {/* Activity indicator */}
          {health && (
            <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
              <div className="flex items-center gap-2 mb-3">
                <Activity size={16} className="text-purple" />
                <div>
                  <p className="eyebrow !mb-0">Status</p>
                  <h2 className="text-[1rem] font-bold text-ink m-0">API Health</h2>
                </div>
                <span className="ml-auto status-badge status-badge-completed">{health.status}</span>
              </div>
              <p className="text-[0.8rem] text-ink-muted">
                Service: <span className="text-ink font-medium">{health.service}</span>
              </p>
            </section>
          )}

          {/* About */}
          <section className="border border-[var(--border-card)] rounded-[var(--panel-radius)] p-4 bg-[var(--bg-card)] shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
            <div className="flex items-center gap-2 mb-3">
              <Info size={16} className="text-purple" />
              <div>
                <p className="eyebrow !mb-0">App</p>
                <h2 className="text-[1rem] font-bold text-ink m-0">About</h2>
              </div>
            </div>
            <div className="grid gap-2">
              {[
                { label: "Name",    value: "Atellier Studio" },
                { label: "Version", value: "1.0.0" },
                { label: "Type",    value: "Local-first AI orchestrator" },
                { label: "Branch",  value: "dev/1.0.0" },
              ].map(({ label, value }) => (
                <div
                  key={label}
                  className="flex items-center justify-between border border-[var(--border-card)] rounded-lg px-3 py-2 bg-white/[0.02]"
                >
                  <span className="text-[0.8rem] text-ink-muted">{label}</span>
                  <span className="text-[0.82rem] font-semibold text-ink">{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
