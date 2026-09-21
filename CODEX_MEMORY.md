# Codex Memory — Atellier Studio

Compact active memory for future implementation sessions. Read this with `AGENTS.md` before changing code. Long chronology belongs in `docs/history/` and the append-only Wiki log.

## Read first

- `docs/operational-status.md` — current product state and active sequence.
- `docs/roadmap.md` — strategic scope and shipped history.
- `docs/memory-artifact-hygiene.md` — durable-memory boundary.
- `docs/operations/local-setup.md` — environment and startup.
- `docs/history/implementation-log.md` — historical implementation detail only when needed.

## User preferences

- Do not commit, push, or open a PR unless the user explicitly asks.
- Work from `dev/1.0.0` through short-lived `codex/` branches; keep `main` stable.
- Validate locally before publishing: compile, run focused tests, inspect relevant UI/behavior.
- Keep commits grouped by implementation area.
- Prefer `corepack pnpm`; a global `pnpm` command is not guaranteed.

## Product and boundaries

- Atellier is a private, local-first operating system for knowledge, tasks, agents, runs, review, deliverables, and explicit memory curation.
- Core loop: source/input → Wiki update → task → agent run → review → deliverable → memory update.
- MongoDB is live operational state. Markdown is inspectable, durable memory.
- Pixel Office is a visualization layer. Do not expand it without a concrete operating need.
- The repository ships a local MCP wrapper and a controlled Codex Worker adapter. Harden existing boundaries; do not add broad external integrations, auth, cloud, multiplayer, or autonomous destructive authority.
- Tests must never call a real LLM, Codex, or MCP tool.

## Local setup

- Repository: `/Users/e.juarez/Desktop/atellier-studio`
- Package manager: `pnpm@9.15.4` through Corepack.
- Preferred startup: `./scripts/dev-local` (Mongo, API, worker, Vite; fails closed on occupied ports).
- API: `http://127.0.0.1:4000`; web normally `http://127.0.0.1:5174/`.
- Docker stack: Colima plus `docker compose`; Mongo container is `atellier-mongo` on port `27017`.

## Architecture rules

- Frontend API chain: service → API hook → feature coordinator → visual component.
- Components do not call `fetch`/axios directly; API hooks own query cache, invalidation, and alerts.
- Fastify routes stay thin; services own business logic.
- Raw content under `atelier/raw` is immutable.
- Runtime recovery is at-least-once. Stable orchestration step IDs and irreversible-effect keys prevent duplicated work.
- Important work produces a readable run log and a concise `atelier/wiki/log.md` event.

## Memory hygiene

- Curated tracked memory: Wiki index/log, sources, synthesis, workflows, decisions, role memory, meaningful narrative runs, and explicitly named curated deliverables.
- ObjectId/UUID-prefixed deliverables are local run evidence. Keep them available through their runs, but exclude them from the curated deliverables index, default Wiki retrieval, reflection candidates, and graph input.
- `atelier/_runtime/` is local-only runtime projection data; never use it as portable product memory.
- Unknown/generated material is context-only. Trust requires an explicit promotion path.
- `wiki/notes` is trusted only when it was explicitly curated; generic writes are marked context-only.

## Active sequence — 2026-09-08

1. Repository truth and memory hygiene: align active docs/task projections and protect curated retrieval from local generated artifacts.
2. QA contract and observability: completed 2026-09-04. `qaRetry` now records only malformed responses; `qaChecklistCompletion` records the one targeted evidence-completion attempt through a shared Build Loop output type.
3. Lightweight-model reliability: frozen-criteria handoff, operator-goal precedence, exact requested-day validation, replacement repair, and evaluation-only QA are complete. The validator now assigns stable `AC-N` IDs, conservatively recognizes legacy paraphrases, preserves evidence-free checklist lines, and distinguishes true omission from missing evidence. The prior apparent 4B adherence issue was partly a measurement false-negative; evidence gates and the one targeted completion attempt remain strict.
4. Agentic Tool Harness v1: the policy catalog is visible in Settings. All five initial local adapters are bounded reads: `wiki.query`, `wiki.lint`, `runs.read`, `workspace.read`, and `workspace.search`. Workspace scopes are server-owned; traversal, symlinks, hidden paths, binary files, and oversized reads fail closed. A model can make one full-response structured request and gets one bounded result pass.
5. Evaluation and learning controls: terminal child-agent records and terminal parent-orchestration attempts now append v2 evidence. Candidate decisions retain immutable history across evidence revisions. Accepted candidates can prepare a shadow-only experiment and record manual quality/duration/retry/human-review observations in the Wiki; none of these paths activate policy, routing, trusted memory, permissions, prompts, tools, or runtime. Harness governance Slice 4 is complete: approved canaries freeze their exact bundle/configuration, and named runs receive deterministic sample-selected reserved or blocked receipts with local timeout/retry/context/tool limits. Slice 5 is complete: separately opt-in workspace changes use atomic replacement, deterministic effect idempotency, append-only state receipts, and an exact rollback handle. Slice 6 is complete: an approved code preview can be applied only in a disposable isolated worktree, then receive fixed server-run typecheck/test receipts; no primary-checkout write or automatic merge is possible. Receipts are not live executor overrides. Next, harden route inputs/MCP retrieval-policy parity and deterministic CI.
6. Boundary hardening, runtime canary consumption, MCP retrieval-policy parity, operator refresh recovery, deterministic CI, and API-layer refresh ownership are complete. Reserved budgets bind only before attempt one; workers revalidate at claim and every step, enforce frozen model/timeout/retry/context/tool limits, fail closed after rollback, and stamp child evaluations with the server-owned bundle fingerprint. MCP `wiki_query` exposes the same three retrieval policies as HTTP. Settings can explicitly refresh governance plus health through its API hook. `corepack pnpm ci:check` is the package-scoped CI contract.
7. Two representative real 4B runs exposed separate contract failures. Heading-only artifact misses caused validation/aggregation disagreement; normalization now handles either an explicit artifact introduction or an exact goal-derived Day 1..N shape before validation/persistence, and the validator requires an extractable section. QA ignored even a minimal terminal `AC-N` contract through both bounded retries, confirming a real 4B capability boundary rather than a matcher false-negative.
8. Structured QA now routes through `OLLAMA_MODEL_QA=qwen3.5:9b`; general roles remain on 4B. Real QA run `6aa3a4ce4399a95b8d3f056f` returned a valid approved 2/2 checklist with evidence. Run Ollama with `OLLAMA_MAX_LOADED_MODELS=1` and `OLLAMA_KEEP_ALIVE=30s` on this Mac to avoid keeping 4B and 9B resident together.
9. Successful executions persist provider-confirmed `resolvedModel` in run output and terminal evaluations; verified real QA run `6aa3a9dbc7253eb086bfc141` records `qwen3.5:9b`. Builder citation eligibility now uses the same authority-filtered paths as deterministic validation, removing the prompt/validator contradiction from run `6aa3a39f4399a95b8d3f03c8`.
10. Full run `6aa3aa67c7253eb086bfc151` passed Builder/Runtime and isolated 4B semantic repair as the next boundary. Only `semantic-repair-*` now requests the deep 9B profile; it receives structured failing checklist items rather than verbose QA prose and has a 1,024-token correction budget. Run `6aa3add470831cd08886cb5f` confirmed live 9B routing but timed out before prompt compaction; run `6aa3b102a6d45fcf05834939` stopped earlier at deterministic 4B repair exhaustion. Focused real correction run `6aa3b3bd61a3d2e7a201d094` completed the compact contract in 32.8 seconds with provider-confirmed 9B and all requested fields. Next: improve earlier 4B artifact reliability, then maintainability/performance.
11. 4B artifact and QA-handoff reliability are verified. Markdown field labels without colons and deeper Day headings validate; QA receives the exact artifact without memory excerpts, Runtime false matches, or validation-warning leakage; artifact source authority is based on explicit `Sources Used`; numbered-plan criteria cannot demand proof that future steps already ran. Final run `6aa7a33a2bfb89fd979f74d6` passed 5/5 QA with zero repair/retry attempts.
12. Durable restart reconciliation and its operator view are complete. Expired cancellation-pending parents cancel their active children; expired parents at `maxAttempts` fail and supersede active children; matching executing agents return to idle; claims independently reject exhausted work. Runs derives searchable notices for pending/recovered cancellation, exhausted attempts, and superseded children from durable timestamps and reasons. Historical parent `6aa79ebbe1ab2302e3bcb40a` and child `6aa79f7ec47d0c13607539da` are terminal and health reports zero active runs.
13. Prior orchestration outputs now remain structured until the model-context render boundary. QA selects artifacts through explicit metadata, and frozen criteria locate PM scope by stable step ID; prompt compatibility and recovery reuse remain intact.
14. Orchestration context/generation budgets are centralized in a versioned contract with explicit character/token units. Rendering, truncation, newest-first selection, and artifact lookup share that contract; aggregate context now includes separators and the truncation marker within the exact 24,000-character cap.
15. Orchestrations now persist and expose summed terminal child duration by server-recorded phase and provider-confirmed model, including repair/retry cost; the operator panel renders the receipt-derived breakdown. Next: deduplicate repair paths, then run a multi-run soak.
16. Initial and post-semantic QA format recovery now share one bounded runner and one instruction builder, preserving distinct IDs, logs, retry counts, and human-review outcomes. Evidence completion and semantic repair remain separate because they solve different failures. Next: run a multi-run soak using the new phase/model metrics.
17. Three-run Ollama soak measured 17 child runs / 829,865 ms: one pipeline completed after semantic repair, two safely exhausted deterministic repair. Exact no-file sentinels no longer become invalid paths. The primary reliability blocker is now context authority: retrieved historical memory can redefine PM criteria and produce structurally valid but off-goal QA approval. Next: freeze an operator-goal acceptance contract independently of retrieval and bind QA evidence to it.
18. Numbered Build Loops now freeze a hashed, versioned operator-goal AC contract in parent input at enqueue. PM criteria cannot supersede it; QA approval must cover its AC-N items and cite recognizable current-artifact evidence. Real post-change soak: one clean 5-step run ready for human review; one 4B tool-request/false-parser loop safely stopped; parser corrected; one post-fix run reached QA but exhausted semantic repair on a self-referential plan. Next: first-pass lightweight Builder/tool-request reliability and stronger semantic correction, not looser QA authority.
19. Initial Build Loop Builder can request one registered read-only tool, then recover one repeated post-result tool request through a final artifact-only model pass without invoking another tool. All passes share one deadline; a frozen budget with zero retries disables the extra completion. Semantic repair explicitly replaces circular plan checks with future observable task/run verification rather than invented execution proof. Full deterministic CI passed (273 API tests, web, MCP, launcher). Two real sequential runs remain pending: local API :4000 is down and the launcher found pre-existing worker PIDs 2193/80870; no existing process was killed.
20. Host-level API/Ollama checks revealed sandbox-local curl was misleading: services and existing worker were healthy. Four sequential same-goal real Build Loops: first two QA-approved after one invalid Wiki path citation repair each; response-wide eligible-path instructions then gave two clean first-pass Builders. The third parent safely stopped `needs-human` despite QA APPROVED because lexical evidence matching missed real Day headings; a heading-specific current-artifact check fixed that false negative. Final run `6aaa4364d22bb1293350ad6a` completed in five children / 234,487 ms, QA 3/3 PASS, zero repair, `ready-for-human-review`. Full deterministic CI passed. The post-tool completion branch remains mock-tested, not exercised by these four live runs; next measure varied goals.
21. Eight frozen varied-goal real Build Loops exposed a substantive QA gap: 8/8 initial Builders passed structural validation, four parents were ready and four stopped needs-human after 12 total semantic repairs, but independent operator-goal audit accepted 0/8. Ready artifacts self-referenced the evaluation run, invented template facts, or omitted required sections. Run-evidence cases failed safely or hallucinated state; the model instruction exposes only `wiki.query` although `runs.read` exists, producing repeated Wiki misses. Unnumbered QA criteria derive from PM output, allowing goal drift and even QA demands for implementation contrary to no-edit instructions. Journal and case rubric: `atelier/runs/2026-09-16-varied-goal-evaluation.md` and `scripts/evaluations/2026-09-16-varied-build-loop.json`. Next: server-owned explicit goal constraints and bounded `runs.read` discoverability, then paired re-evaluation. No automatic approvals or memory promotion were performed.
22. Autonomous-improvement slices 1–4 started: explicit operator clauses and requested sections now govern QA; frozen goal contracts fail closed on stale versions. Tool prompts list only current role/budget-allowed reads; one `runs.read` call can return bounded current parent and Builder/QA evidence for two exact IDs. Protected negative controls reject seven known bad historical artifacts and leave unproven quality unverified. One of eight hidden-path holdout runs completed: parent `6aab0b6fd6a8ba20ab820f15` safely stopped needs-human despite first-pass Builder and textual QA PASS; independent audit found it self-referenced the evaluation run as the historical blocked-run queue. A follow-up self-reference gate was added; historical evidence was not rewritten. Receipt-pair comparison remains usable for a human proposal but reports autonomous promotion ineligible without independently verified quality. `docs/autonomous-improvement-roadmap.md` records remaining gates before slices 5–8; no autonomous promotion or code merge was enabled.
23. A second selected holdout case tested two real run IDs: parent `6aab919d82183ac73a92776c` completed `needs-human` after 3 semantic repairs (776,494 ms measured child time). Builder structurally passed but took eligible Wiki paths as evidence that the run ledger was inaccessible; QA successfully invoked one `runs.read` for both IDs and failed the unsupported comparison. The Builder prompt now explicitly distinguishes file citation authority from bounded current run receipts, with a mock regression. Live post-fix Builder tool use, remaining six holdouts, positive quality calibration, and slices 5–8 are still open. Do not turn this safe failure into a quality success or promote it automatically.
24. Third holdout parent `6aab954b0641cf9f28077fbd` returned `needs-human`: initial Builder referenced an unverified file, one deterministic repair yielded four requested headings with only separators, and QA's textual PASS 3/3 was blocked by parent `orchestration.qa_evidence_off_artifact`. Holdout quality remains unverified; five cases, positive calibration, and slices 5–8 remain open. Neither the thin template nor QA's prose is an automatic quality success.
25. Fourth reserved parent `6aab96a20641cf9f28078067` was formally ready but independently rejected for unverified Atellier field/state names (`parentOrchestrationRunId`, `qaBlockers`, `awaiting_operator_decision`, etc.). Do not approve it or count textual QA as substantive quality. Four cases remain. Once a case is inspected and a prompt changes, it is a diagnostic, not a fresh sealed holdout; reserve new cases before any generalization claim.
26. Quality-gate closure C1 is complete: `OperatorGoalContract` v3 freezes stable operator-sourced `AC-N` requirements, artifact intent, explicit prohibitions and requested English/Spanish section forms. Old v2 parent inputs fail closed and are never silently rebased. Focused tests passed; C2 must acquire exact run evidence before Builder for one/two-ID state goals. Do not run a new costly campaign until C2–C5 behavior and budgets are implemented.
27. Quality-gate closure C2 is complete in deterministic tests: explicit one/two-ID comparison goals trigger one role/budget-bound `runs.read` before Builder. The parent persists invocation status, bounded records and an evidence hash; Builder/QA/repairs reuse it. UUIDs are accepted for memory tests as well as Mongo ObjectIds. A denied/failed read is explicit and supplies no records. C3 operational-contract truth is next; do not treat C2's mock proof as a live quality measurement.
28. Quality closure C3–C6 foundations: C3 derives current run/review/readiness states, public receipt fields and read tools from shared contracts/catalog; unlisted technical identifiers are rejected unless explicitly proposed/hypothetical. C4 stores a deterministic `verified`/`rejected`/`unverified` receipt separate from QA/review, but semantic families await calibration. C5 stops a semantic repair if its Requested Artifact hash did not change and records `repairStall`. C6 runner supports immutable campaign+variant journals and manifests. C7, calibration, sealed new cases and a real campaign remain pending; do not promote on these deterministic checks alone.
29. C5/C6 closure advanced: Orchestration status/UI expose the independent quality receipt and no-progress repair stop. Campaign manifests now freeze 12 minutes measured child duration and one semantic repair per case; an exceeded limit is journaled and stops later case dispatch. `quality-calibration-v1.json` has 24 four-family fixtures replayed through the real deterministic evaluator, but its labels are explicitly agent-proposed and procedures/proposals remain unverified. Human calibration of subjective labels, protected fresh cases, real serial campaign and C7 are still required; do not equate the fixture test with model generalization.
30. Calibration handoff is now deliberately compact: `docs/quality-calibration-human-review.md` asks the operator to adjudicate only six semantically plausible procedure/proposal fixtures. The remaining 18 outcomes are deterministic. `.protected-evals/sealed-quality-v1.protocol.md` contains no future prompts, expected artifacts or labels until that calibration and implementation fingerprint are frozen. Do not author or inspect the eight sealed cases early; doing so makes them diagnostic-only.
31. C5/C6 verification strengthened: an endpoint-level reload test confirms completed orchestration status retains both `qualityEvaluation` and `repairStall`. A named campaign manifest includes Git `HEAD`, sorted dirty-path list and a SHA-256 snapshot fingerprint alongside model/configuration/budget; a resumed campaign keeps its original manifest. This records state rather than claiming a clean tree.
32. The operator delegated the first semantic calibration adjudication to Codex. `.protected-evals/quality-calibration-v1.decision.json` records this as `delegated-agent-adjudication`, explicitly not an independent human calibration. `sealed-quality-v1.json` is now an eight-case (two per family) frozen suite with SHA-256 audit and `--sealed=quality-v1` runner path. Never tune against or edit this suite after its creation; it must run serially under a named campaign before C7, with any inspected/tuned result treated only as diagnostic.
33. `sealed-v1-exec2` completed all eight sealed cases after the semantic-repair ceiling became a durable API/run input. All eight safely stopped `needs-human`; every case stayed within the 12-minute/one-semantic-repair budget. Three independent controls rejected artifacts (ungrounded fact report, unsupported operational identifier, or exhausted semantic repair); five were only unverified. This proves containment, not quality readiness. Next implement factual receipt grounding and operational-capability clarity with development fixtures only, then use a new campaign identity against the unchanged sealed suite.
34. `sealed-v1-exec3` completed the unchanged eight-case suite after factual grounding prompts and development fixtures were aligned. It did not establish a reliable 4B quality improvement: factual artifacts still often exhausted their one semantic repair, while independent evaluation rejected or left other families unverified. The safe outcome is a deterministic fact-report fallback: only after succeeded server-acquired preflight receipts, Builder omissions or missing `Receipt <id>` blocks are replaced with a complete receipt-grounded artifact that labels missing records `unverified`. It does not apply to other artifact kinds and does not grant QA/review approval. Tests and typecheck passed; do not claim the sealed campaign is a success or alter its cases.

## Model runtime

- Installed local models include `qwen3.5:4b`, `qwen3.5:9b`, and `gpt-oss:20b`.
- Safe defaults keep cheap/standard on `qwen3.5:4b`; deep maps to `qwen3.5:9b` and is requested only by bounded semantic repair. QA independently uses the same 9B role override. Ollama must keep one loaded model so these run sequentially rather than concurrently.
- Local Ollama uses 8192 context tokens, `reasoning_effort: none`, and a 240-second execution timeout in the safe configuration.

## Validation

```bash
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm test:dev-local
```

Use focused workspace commands first for an API or web change. Mongo runtime tests are opt-in and must use their isolated test database.

## Recurring pitfalls

- Root commands must invoke Corepack because nested bare `pnpm` can fail in non-TTY environments.
- Keep global `button {}` and `input, select {}` CSS inside `@layer base`; otherwise Tailwind utility overrides break.
- Vite 5.4.x remains pinned because Vite 6/Vitest 2 types conflicted.
- Mongoose ESM imports must use `import mongoose, { Schema } from "mongoose"`.
- `tsx watch` may require temp-directory permissions.
- `canvas.getContext("2d")` can throw in jsdom; wrap it in `try/catch`.

## Update protocol

At the end of implementation work:

1. Create/update a narrative run log in `atelier/runs/`.
2. Append one concise Wiki log event.
3. Update this file only when setup, constraints, current priorities, or solved pitfalls change.
4. Put long narrative history in `docs/history/`.
5. Keep `docs/operational-status.md`, `docs/roadmap.md`, and Markdown task projections aligned.
