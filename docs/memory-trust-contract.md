# Memory Trust Contract

Atellier exposes the origin and authority of every Wiki result so generated text cannot silently become trusted operational memory.

## Dimensions

Every Wiki page, query match, related page, and ingest result carries three independent dimensions:

| Dimension | Values | Meaning |
| --- | --- | --- |
| Layer | `raw`, `episodic`, `semantic`, `learning` | The role the artifact plays in memory. |
| State | `immutable-source`, `generated`, `verified`, `rejected` | How the artifact was produced and reviewed. |
| Authority | `evidence-only`, `context-only`, `trusted` | How an agent may use it. |

The metadata also includes verified provenance paths and a human-readable classification reason.

## Fail-closed rules

- Raw ingests are immutable evidence. They may support a conclusion but are not instructions.
- Generated summaries, run logs, unapproved deliverables, and Dream proposals are context only.
- Approved review synthesis, curated role memory, explicit decisions, and operator-curated Wiki pages are trusted.
- A generated artifact never becomes trusted merely because it appears in retrieval results.
- A generic Wiki write is durably marked `generic-write` and remains generated/context-only even when its path or content claims approval.
- Workflow-owned categories (`decisions`, `role-memory`, `synthesis`, `sources`, and `deliverables`) reject generic writes; trusted transitions use their dedicated reviewed workflows.
- Missing or unknown classifications default to `semantic / generated / context-only`.
- `rejected` is part of the contract for future explicit rejection workflows; path or model output alone never assigns it.

## Current path mapping

| Path | Classification |
| --- | --- |
| `raw/**` | raw / immutable-source / evidence-only |
| `wiki/sources/**` | semantic / generated / context-only |
| `runs/**`, `tasks/**`, `wiki/log.md` | episodic / generated / context-only |
| unapproved `wiki/deliverables/**` | episodic / generated / context-only |
| approved `wiki/deliverables/**` | episodic / verified / trusted |
| approved `wiki/synthesis/**` | semantic / verified / trusted |
| `wiki/role-memory/**` | learning / verified / trusted |
| `wiki/decisions/**` | semantic / verified / trusted |
| `wiki/dreams/**` | episodic / generated / context-only |
| existing operator-curated clients/projects/entities/workflows/notes | semantic / verified / trusted |
| generic writes to clients/projects/entities/workflows/notes | semantic / generated / context-only |

## Product surface

The API returns this metadata with Wiki reads, queries, related results, safe writes, and both artifacts created by ingest. The Wiki UI renders compact trust badges.

## Trust-aware retrieval

Wiki query searches Wiki and immutable raw Markdown with one explicit policy:

- `balanced`: trusted memory receives a +4 adjustment, immutable evidence +2, generated context +0.
- `evidence-first`: immutable evidence receives +4, trusted memory +3, generated context +0.
- `trusted-only`: only trusted results are returned, with a +4 adjustment.

The base lexical score remains deterministic: occurrence count plus the existing title-match bonus. Each result exposes the lexical score, trust adjustment, total, and readable ranking reason. Related pages follow the selected authority ordering and are filtered under `trusted-only`. There are no embeddings, vector database, or opaque model rerankers.

## Agent memory context packs

Each orchestration freezes one bounded Agent Memory Context Receipt before its first child step. The receipt records its query and policy, budgets, included excerpts, SHA-256 content hashes, byte and truncation information, authority metadata, retrieval reason/score, and excluded paths. It is persisted atomically on the parent run under the active worker lease and rendered as a readable artifact under `atelier/runs/context/`.

- Linked task sources are included first. Raw sources remain evidence-only; a directly linked generated summary is explicitly rendered as `NON-AUTHORITATIVE CONTEXT` and cannot override operator or orchestration instructions.
- Autonomous retrieval uses `evidence-first` and excludes context-only results. It may include immutable evidence and trusted memory only.
- Curated role memory is scoped to the matching current step role; other roles do not receive that excerpt.
- Retry and recovery reuse the persisted receipt rather than querying again. A different proposed receipt for the same parent run fails closed.
- The orchestration panel displays the receipt policy, stable hash, included paths, authority, truncation, retrieval score, and exclusions for review.

Context packs do not promote or modify memory. They are a reproducible read boundary, not an authority escalation.

### Receipt evaluation

After a terminal orchestration, an operator may record one context-receipt evaluation: an overall `useful`, `mixed`, or `not-useful` outcome and a `relevant`, `uncertain`, or `irrelevant` label for every included item. The evaluation binds to the frozen receipt hash and, when applicable, its step role. It is immutable after the first write; exact retry is idempotent and conflicting relabeling fails closed.

Evaluation data is preserved on the parent run, in its run log, and as a readable artifact under `atelier/runs/context/`. It is evidence for a future human policy decision only. It never automatically changes source authority, retrieval policy, byte budgets, or memory content.

## Reflection candidates

`POST /wiki/reflections` scans episodic runs, tasks, deliverables, and Dream reports. It extracts only explicit narrative labels or sections such as Lesson, Blocker, Issue, Findings, Risks, Summary, and Retrospective. Structural JSON, commands, IDs, paths, lifecycle messages, test results, and other operational boilerplate are excluded. A normalized pattern must appear in at least two distinct artifacts; repetition inside one artifact counts once.

Generation is read-only. Candidate IDs include a hash of the complete normalized pattern so long shared prefixes cannot collide. Each candidate includes its evidence paths, occurrence count, a proposed `wiki/reflections/` path, and review-draft Markdown. Candidates remain `semantic / generated / context-only`; review and promotion require separate explicit actions.

### Review and promotion

An operator may record one durable `accepted` or `rejected` decision with a required note. Exact retries reuse the decision; a conflicting second outcome or note fails closed. Decisions preserve the candidate pattern and evidence under `wiki/decisions/`.

`GET /wiki/reflections/review` reconstructs `pending`, `accepted`, `rejected`, and `promoted` state from durable files, so refresh and API restart do not lose review state. A promotion is recognized only when its page is verified/trusted and its canonical decision, exact pattern, and complete evidence provenance all match.

Promotion is a separate operation. It requires the canonical specialized decision path, verifies that the outcome is accepted and still supported by current evidence, preserves decision and episodic provenance, and writes a verified semantic note using exclusive creation. Rejected, generic, malformed, stale, or incomplete decisions cannot be promoted. Conflicting decisions fail closed under concurrency. Promotion does not extend to role memory.
