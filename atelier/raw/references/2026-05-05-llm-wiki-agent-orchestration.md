# Raw Source: LLM Wiki + Skill-Triggered Agent Orchestration

- Captured: 2026-05-05
- Source type: operator-provided reference text and screenshots
- Do not overwrite: this file preserves the incoming concept for future synthesis.

## Operator Intent

Integrate a process like the reference screenshots into Atellier Studio:

1. Agents coordinate in named phases.
2. A skill triggers the orchestration process.
3. The project already has the base: agents, runs, handoffs, deliverables, and wiki memory.
4. The implementation must respect the LLM Wiki pattern.

## Screenshot Reference

The first reference shows a simple sequential loop:

1. Pepe writes the backend.
2. Toto compiles and starts the backend.
3. Jaco tests the fix and reports two errors.
4. Pepe fixes the errors.
5. Toto compiles and starts the backend again.
6. Jaco tests and approves the backend.
7. The process moves to frontend.

The second reference shows a more explicit orchestrator transcript:

- blockers are found and sent to the backend code agent
- backend code agent fixes config and feature flag issues
- runtime agent restarts backend
- validation agent re-checks failed checks
- frontend phase starts only after backend checks pass
- frontend code agent receives API response context
- browser validation follows frontend completion

## LLM Wiki Reference

Core idea: instead of only retrieving raw documents at query time, an LLM incrementally builds and maintains a persistent markdown wiki that compounds over time.

Layers:

- raw sources are immutable source material
- the wiki is LLM-generated durable synthesis
- the schema tells the agent how to maintain the wiki

Operations:

- ingest new sources, summarize them, update cross-links, note contradictions, and append the log
- query the wiki first and file useful answers back into the wiki
- lint the wiki for contradictions, stale claims, orphan pages, missing cross-links, and research gaps

Indexing:

- `index.md` is content-oriented
- `log.md` is chronological and append-only

Important operating principle: the LLM owns wiki maintenance; the human curates sources, asks questions, and guides emphasis.
