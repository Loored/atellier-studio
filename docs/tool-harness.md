# Tool Harness v1

Atellier is evolving from a fixed orchestration loop into a safe, local agentic harness. A harness capability is an explicit, policy-checked operation with bounded input, durable evidence, and a known effect class; it is never an unrestricted shell command.

## Current foundation

The first slice exposes a shared Tool Harness contract and a visible capability catalog at `GET /tool-harness/catalog`.

- `ToolDefinition` declares the capability, permitted agent roles, effect classification, autonomy level, expected input, and evidence requirement.
- `ToolHarnessService` rejects unregistered tools and unauthorized roles by default.
- The policy distinguishes automatic read-only work, approval-required work, and human-only work.
- `POST /tool-harness/policy-check` provides a deterministic policy decision for a requested tool and role.
- Settings displays the catalog and each adapter state so operators can inspect the boundary before agents can use it.

The initial five catalogued capabilities are `wiki.query`, `wiki.lint`, `workspace.search`, `workspace.read`, and `runs.read`. Each has a bounded read-only adapter. Every invocation requires a parent run and writes a structured `ToolInvocation` receipt plus a concise run log entry.

`workspace.read` accepts only server-scoped relative paths and an optional line range. `workspace.search` accepts only query text and a result limit: models cannot provide roots or commands. Both adapters are limited to safe repository roots, reject traversal, symlinks, hidden paths (including `.env*`), binary files, and oversized content.

## Safety boundary

| Effect | Initial autonomy | Requirement |
| --- | --- | --- |
| Read | Automatic only when the tool and role are registered | Bounded input and run evidence |
| Reversible | Human approval | Approval grant, postcondition, evidence, rollback metadata |
| Irreversible | Human only | Explicit review, stable idempotency key/fingerprint, durable ledger |

The effect-idempotency ledger remains the required guard for irreversible effects. A reversible operation may also opt into the same ledger when an exact durable retry receipt is needed, rather than creating a competing side-effect mechanism.

## Reversible workspace containment

Control Bundle governance has its own API boundary. An explicitly approved, sampled canary can bind a frozen execution budget to a queued run and the worker enforces it; ordinary runs remain on baseline settings. No approval automatically promotes a bundle globally.

Workspace-change previews and their human-review records remain available for inspection. Actual `apply` and `rollback` operations are disabled by default and return a local-policy conflict until the operator explicitly sets:

```bash
ATELLIER_REVERSIBLE_WORKSPACE_WRITES_ENABLED=true
```

That flag is intentionally diagnostic-only during the current hardening phase. It does not make the operation autonomous. Direct apply accepts document previews within `docs/`, `atelier/wiki`, and `atelier/tasks`; code previews below `apps/` or `packages/` may be reviewed but can execute only in the supervised worktree flow. The boundary rejects `atelier/raw`, runtime files, hidden paths, symlinks, binary files, oversized files, and path traversal.

## Governance integrity and operator receipts

Every Control Bundle now has a deterministic content fingerprint. Its reader rebuilds the canonical configuration and verifies both the stored fingerprint and fingerprint-derived record ID. A proposal binds the intended bundle and its fingerprint; an approval binds the exact proposal and bundle fingerprints; a canary binds the exact approved proposal. The API rejects unknown, stale, altered, expired, and lifecycle-incompatible references. Proposal state is derived from this immutable evidence, not from a mutable status field.

Workspace previews bind the original contents, requested replacement, and file path to a fingerprint. With explicit local opt-in, an approved apply writes through a same-directory temporary file and atomic rename after revalidating the source contents. Apply and rollback are deterministic effect-idempotent operations; their append-only Wiki events retain the key, effect fingerprint, timestamp, and a rollback handle. The handle is required to revert the exact applied preview. Operator read endpoints and Settings expose compact receipts. Workspace document apply/rollback remains a separately opted-in, explicitly approved action, not an autonomous model tool.

## Next implementation slice

The bounded adapters are connected to an explicit agent tool-request/result loop. A model may emit one complete `TOOL_REQUEST: {"toolName":"…","input":{…}}` response. Atellier parses only that full response, invokes a registered adapter with the agent's child run as parent, persists the receipt, and performs one final model call with the bounded result. A second tool request is not resolved in the same agent step.

The executor still has no route to arbitrary commands, writes, network calls, package installation, git commits, or external messaging.

## Evaluation and learning boundary

Every terminal child-agent run now records a v2 evaluation with terminal status, validation outcome, tool counts, duration, role/step metadata, Context Receipt hash when present, and classified failures. Durable parent orchestrations also record an attempt-scoped receipt when their execution becomes completed, failed, blocked, or cancelled. Reconciliation and an exact replay reuse that receipt; a manual retry increments an execution retry generation before its attempt counter restarts, so it creates new evidence rather than colliding with the prior terminal receipt. The record appends to `evaluationLedger`; the former `evaluation` field remains a compatibility projection of the latest record.

Learning candidates carry an evidence digest. A human decision must reference the currently generated candidate and exact digest; an identical retry reuses the immutable decision, while a conflicting decision is rejected. Prior decisions remain discoverable as immutable history when the aggregate evidence changes, while the live candidate returns to pending review. Accepting a candidate means only “accepted for a future experiment”: it cannot promote memory, activate a policy, change routing, or grant a tool permission.

## Paired Evaluation Ledger eligibility

Manual shadow observations are retained as operator context but cannot make a Control Bundle proposal eligible. Eligibility is derived only from immutable baseline/shadow receipt pairs. A pair must contain distinct completed terminal receipts with the same Context Receipt hash, agent role, and logical step; it stores their exact fingerprints and a deterministic verdict.

An experiment needs at least three pairs, no derived regression, and a strict improving majority. The resulting evidence digest is embedded into the proposal. If later evidence changes that digest or makes the experiment ineligible, a proposal that has not entered a canary lifecycle becomes `evidence-stale` and cannot receive a new approval. This remains an evidence gate, not runtime routing.

Experiment-eligible receipts must also carry an exact configuration fingerprint. Each experiment permits one consistent baseline fingerprint and one distinct, consistent shadow fingerprint; a receipt can appear in only one pair across all experiments. A proposal may reference only the Control Bundle whose canonical fingerprint equals the tested shadow fingerprint. Older receipts without this provenance remain historical evidence but cannot authorize a proposal.

## Frozen canary budgets

A planned canary freezes the exact proposal, approval, Control Bundle configuration, and sample percentage into a fingerprinted record. A run is not selected by broad routing: the server derives its stable 0–99 bucket from the canary fingerprint and run ID. Only a selected run can receive a budget receipt.

The receipt snapshots the model profile map, execution timeout, retry count, context budget, and allowed tools. The server blocks assignments after rollback or approval expiry, outside the sample, above the local safety ceilings (240 seconds, three retries, 64 KB context), or with tools outside the existing bounded read-only catalog. The worker validates and consumes the selected run's frozen receipt at claim and step boundaries; a rollback fails closed.

## Supervised code worktrees

An approved preview below `apps/` or `packages/` can be prepared only when `ATELLIER_SUPERVISED_CODE_CHANGES_ENABLED=true`. The server resolves one exact base SHA, creates a detached disposable Git worktree beside the repository, prepares dependencies offline from the frozen lockfile with lifecycle scripts disabled, and applies the exact preview there; it never changes or merges the primary checkout.

The verification plan is derived from the preview target, not from an agent or operator command: API previews run API typecheck and API tests, web previews run web typecheck and web tests, and package previews run all four. Each stdout/stderr artifact and immutable receipt is visible in Settings with an explicit completed, timed-out, or cancelled termination. Verify and discard are mutually exclusive for a worktree. A failed receipt is final evidence for that preview; discard it and create a newly reviewed preview rather than retrying arbitrary commands.

Client-authored verification summaries are not execution authority. The direct workspace apply path rejects code even when the client claims a passing check, so only fixed server-run worktree receipts can represent code verification.

## Restart reconciliation

Reversible document changes and supervised worktrees now recover when the process stops between a physical filesystem result and its final Wiki/ledger evidence. Recovery requires the exact tool name, idempotency key, and fingerprint from a failed effect or an effect stale for at least 30 seconds. Fresh operations are never taken over.

Document recovery verifies that current content equals the immutable preview's expected postcondition. A matching manual edit without ledger evidence fails closed. Supervised prepare verifies both the registered generated worktree and its exact changed content; verification stores a bounded JSON receipt beside stdout/stderr so a completed fixed command is not repeated; discard can finish its evidence after the worktree has already been removed. The primary checkout and merge boundary remain unchanged.

## Runtime canary consumption

An orchestration may request a planned canary by ID. The server performs deterministic selection and binds a reserved receipt only while the run is queued before its first attempt. The worker revalidates that receipt at claim time and before each step, applies the frozen profile model, timeout, retry ceiling, context byte limit, and allowed-tool set, and writes the bundle fingerprint into terminal child evaluations. A rollback after reservation fails closed; a non-selected run remains on baseline configuration without a bound receipt.

## Current improvement boundary

`runs.read` supports one or two exact existing IDs in one read, with bounded parent readiness, QA checklist, initial Builder validation, and repair evidence. Only role-allowed, sampled-budget-compatible read tools are advertised to each agent; the result pass cannot request another tool. Paired Evaluation Ledger outcomes and faster runtimes alone cannot demonstrate substantive quality; the comparison explicitly marks autonomous promotion ineligible until protected quality/holdout evidence exists. See `docs/autonomous-improvement-roadmap.md` for the dependency order. Do not connect supervised worktrees to automatic merge, arbitrary commands, or external effects.
