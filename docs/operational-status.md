# Operational Status

**Last updated:** 2026-09-16  
**Authority:** Current product state and the next approved engineering sequence.

## Product state

Atellier Studio is a private, local-first operating system for durable knowledge, tasks, agents, runs, deliverables, review, and explicit memory curation. MongoDB is the live operational store; Markdown is the inspectable, durable record.

The durable orchestration runtime, Context Receipt, trust-aware retrieval, reflection review/promotion, local MCP wrapper, controlled Codex Worker adapter, and Knowledge Graph are shipped. The Pixel Office remains a visualization surface, not the product priority.

## Current operating constraints

- Local Ollama keeps cheap/standard at `qwen3.5:4b`; deep semantic repair and the QA role use `qwen3.5:9b` sequentially with one resident model on this Mac.
- Human approval remains required for review, promotion, and irreversible execution.
- Generated local artifacts are evidence, not durable knowledge. They must not silently become trusted context.
- Tests never call external LLMs, Codex, or MCP tools.
- Receipt-only speed/outcome improvement is not verified substantive quality and does not authorize autonomous promotion.

## Active sequence

1. **Repository truth and memory hygiene** — keep the curated Wiki index reproducible, exclude local generated artifacts from default retrieval, align active docs/tasks, and keep runtime projections local-only.
2. **QA contract and observability** — completed on 2026-09-04: malformed QA retries and targeted checklist completion are persisted, displayed, and measured separately through one shared Build Loop output contract.
3. **Lightweight-model reliability** — frozen-criteria handoff, goal-precedence hardening, and bounded-QA-context measurement are complete. QA criteria now use stable `AC-N` identifiers, conservative legacy paraphrase matching, and separate omitted/missing-evidence telemetry, correcting a validator false-negative that had been attributed to the 4B model. Evidence remains mandatory and the existing single targeted completion limit is unchanged. No model-profile, timeout, or retry increase is warranted.
4. **Agentic Tool Harness v1** — the shared catalog and deny-by-default policy are implemented and visible in Settings. All five initial adapters are bounded reads: Wiki query/lint, run evidence, workspace search, and workspace file ranges. Workspace access uses server-owned safe roots, rejects traversal, symlinks, hidden paths, binary files, and oversized files. An agent may make one full-response structured read-only request and receives one bounded result pass. Do not allow arbitrary commands, workspace writes, network actions, or MCP expansion through this boundary.
5. **Evaluation and learning controls** — terminal child-agent outcomes and parent-orchestration attempts append immutable v2 records. Learning decisions remain review-gated and never alone activate policy, memory, routing, or permissions. Approved canaries freeze exact configuration and selected runs now consume their budgets at runtime; separately opt-in reversible document writes and supervised code previews retain their distinct human-approval boundaries. No code auto-merge exists.
6. **Boundary hardening and canary runtime consumption** — client-authored verification cannot authorize primary-checkout code writes, and experiment pairs require consistent exact configuration fingerprints. A selected orchestration binds its reserved budget before attempt one; the worker revalidates it at claim and every step, enforces frozen limits, fails closed after rollback, and records the bundle fingerprint. MCP and HTTP now share retrieval-policy choices, Settings can explicitly refresh operator state, and package-scoped deterministic CI covers API, web, MCP, launcher, and all typechecks. Next: API-layer maintainability cleanup, then a representative real 4B evaluation with corrected QA telemetry.
7. **Maintainability** — split large service seams and lazy-load heavy visualization surfaces only after the operating contract is correct.
8. **Operator-goal authority** — numbered Build Loops now freeze server-owned acceptance criteria from the operator goal before PM/retrieval, and terminal QA approval must map its AC-N checklist and PASS evidence to the current artifact. Three real sequential runs showed one clean completion, a safely stopped 4B tool-request/parser loop (parser corrected), and a post-fix semantic-repair exhaustion on a self-referential plan. Next: improve lightweight Builder first-pass reliability and semantic correction without weakening the goal/QA gate.
9. **Bounded Builder recovery** — the initial Build Loop Builder may finish its artifact once after repeating a tool request on the result pass, but never receives another tool invocation. The shared execution deadline and frozen retry budget constrain the recovery; semantic repair asks for observable future run signals instead of circular plan checks. Deterministic CI passed. Next: reconcile the existing local worker/API state and measure two sequential real runs before judging the 4B improvement.
10. **Real citation/QA soak** — four sequential same-goal runs found two first-pass invalid citations of a trusted-but-ineligible Wiki path. Response-wide path instructions gave two subsequent clean first-pass Builders without widening citation authority. A separate QA lexical false negative on real Day headings was corrected with a current-artifact heading check. Final run `6aaa4364d22bb1293350ad6a` passed QA 3/3 and is ready for human review with zero repairs. Next: varied-goal measurements and a naturally occurring post-tool request, while preserving strict evidence and human review.
11. **Varied-goal quality audit** — eight frozen Build Loop cases across plans, documents, run analysis, and reasoning were executed sequentially. All eight Builders passed structural validation initially; four parents were formally ready, four safely stopped after semantic repair, but none met the independently frozen substantive rubric. The formally ready artifacts include self-reference, unsupported assertions, and omitted operator sections. Run analysis repeatedly used `wiki.query` despite Mongo `runs.read` being registered but not described in the model instruction. Next: extend server-owned operator-goal authority to explicit constraints and surface only role-allowed read tools, then repeat the same matrix without changing its rubric.
12. **Autonomous improvement foundation (in progress)** — explicit multi-sentence/section operator constraints now govern QA and frozen contract revisions fail closed; generic one-sentence goals still allow PM supplementary criteria. Per-role/budget read-only tools are advertised dynamically, with two-run bounded `runs.read` evidence. Seven historical negative controls reject known bad artifacts. Four reserved runs have completed: a self-referential plan, a comparison whose Builder missed live receipts, a skeletal blank template, and a formally ready plan independently rejected for invented operational field/state names. The post-run Builder prompt correction is mock-tested, not live-verified. Four remaining cases and positive quality calibration are pending; exposed cases cannot be reused as unseen holdout for a tuned variant. Receipt comparison explicitly denies autonomous promotion without protected substantive-quality evidence. Slices 5–8 remain inactive pending that gate; see `docs/autonomous-improvement-roadmap.md`.

## Canonical documents

- [`CODEX_MEMORY.md`](../CODEX_MEMORY.md): compact session handoff and local setup.
- [`docs/roadmap.md`](roadmap.md): strategic scope and active sequence.
- [`docs/memory-artifact-hygiene.md`](memory-artifact-hygiene.md): what may become durable memory.
- [`atelier/tasks/active.md`](../atelier/tasks/active.md): current Markdown task projection; live task state remains in MongoDB.
- [`atelier/wiki/log.md`](../atelier/wiki/log.md): append-only operational ledger.

Older planning documents remain historical evidence. They must not be used to select new work unless this page or the roadmap links to them explicitly.
