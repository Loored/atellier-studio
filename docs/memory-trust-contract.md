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
| operator-curated clients/projects/entities/workflows/notes | semantic / verified / trusted |

## Product surface

The API returns this metadata with Wiki reads, queries, related results, safe writes, and both artifacts created by ingest. The Wiki UI renders compact trust badges.

## Trust-aware retrieval

Wiki query searches Wiki and immutable raw Markdown with one explicit policy:

- `balanced`: trusted memory receives a +4 adjustment, immutable evidence +2, generated context +0.
- `evidence-first`: immutable evidence receives +4, trusted memory +3, generated context +0.
- `trusted-only`: only trusted results are returned, with a +4 adjustment.

The base lexical score remains deterministic: occurrence count plus the existing title-match bonus. Each result exposes the lexical score, trust adjustment, total, and readable ranking reason. Related pages follow the selected authority ordering and are filtered under `trusted-only`. There are no embeddings, vector database, or opaque model rerankers.

## Reflection candidates

`POST /wiki/reflections` scans episodic runs, tasks, deliverables, and Dream reports. It normalizes dates, IDs, and vault paths, then requires a pattern to appear in at least two distinct artifacts. Repetition inside one artifact counts once.

Generation is read-only. Each candidate includes its evidence paths, occurrence count, a proposed `wiki/reflections/` path, and review-draft Markdown. Candidates and saved reflection drafts remain `semantic / generated / context-only`; review and promotion require separate explicit actions.

### Review and promotion

An operator may record one durable `accepted` or `rejected` decision with a required note. Exact retries reuse the decision; a conflicting second outcome or note fails closed. Decisions preserve the candidate pattern and evidence under `wiki/decisions/`.

Promotion is a separate operation. It requires the canonical decision path, verifies that the outcome is accepted, preserves decision and episodic provenance, and writes a verified semantic note. Rejected candidates cannot be promoted. Promotion does not extend to role memory.
