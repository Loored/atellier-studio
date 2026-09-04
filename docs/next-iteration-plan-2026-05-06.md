# Next Iteration Plan — Claude Platform Alignment

**Date:** 2026-05-06
**Status (2026-05-11):** P1, P2, P2.b, P2.c, P3 (a/b/c), and P4 are **complete**. P5 (Codex Worker Evidence Pass v1.1) remains deferred. New candidates for the next iteration live in `docs/roadmap.md` under "Now planning" — top pick is memory artifact hygiene before another feature slice.
**Supersedes:** Priority order in `docs/next-work-plan.md` (kept for history; do not delete).

## Context

On 2026-05-06 Anthropic ran the *Code with Claude 2026* keynote and surfaced capabilities that overlap heavily with Atellier's direction:

- **Opus 4.7** — better long-context coding, better vision, "real taste" for visual design. Same price as 4.6 ($5 / $25 per MTok).
- **Auto Dream** in Claude Code — periodic consolidation of memory files: prunes stale, resolves contradictions, reorganizes. Same conceptual role as our `wiki-curator`.
- **Claude Cowork** (GA on macOS/Windows) — desktop app with isolated VM, local file access, MCP integrations. Effectively the desktop client Atellier was *not* going to build.
- **Skills 2.0** — skills are now full workflow packages (scripts + templates + reference materials).
- **Multi-agent orchestration** in Managed Agents — leader/sub-agent pattern, public beta.
- **Claude Design** — visual deliverables (slides, prototypes), exports to Canva.
- **Claude Security** beta — code vulnerability scans + fixes via Opus 4.7.

Adjacent confirmation from the community: the "Pixel Agents" VS Code extension (Pablo Deuca) ships a pure-visualization version of our Pixel Office concept, validating that the visual-roster UX resonates — but only as a dashboard layer, not as a system.

## Strategic reframe

Atellier is **not a competitor to Cowork** and **not a replacement for Claude Code**. It is:

> **The model of *your* work** — wiki, runs, tasks, deliverables, review — running on top of platform primitives (Claude / OpenAI executors, MCP, scheduled tasks).

Concretely:

- Atellier's edge is the **structured work model** (sources / wiki / contradictions / orchestration skills / review states / deliverables), not the agent runtime.
- Atellier should **expose itself as an MCP server** so Cowork and Claude Code can use it as a tool.
- Atellier should **stop reinventing** what the platform now does well: agent execution, prompt caching, tool-use plumbing, raw memory storage.
- Atellier stays **personal and local-first**. Not a SaaS, not multi-user. That is a feature.

## Updated priorities

Previous plan had Codex Worker Evidence Pass as P1. After the keynote, the order changes:

### P1 — MCP server wrapper over the REST API ✅ shipped 2026-05-10/11

**Why now:** Cowork is the desktop client we no longer have to build. Wrapping the existing REST API as MCP makes Atellier callable from Cowork *and* Claude Code as a tool. Highest leverage move.

**Scope:**
- New package (suggested: `apps/mcp-server` or `packages/mcp-server`) that exposes:
  - `wiki/query`, `wiki/ingest`, `wiki/page`
  - `orchestrations/skills/:id/run`
  - `runs/list`, `runs/get`
- Local-only auth (loopback / token in env). No remote hosting yet.
- Add `docs/mcp-server.md` describing install + Cowork connection.

**Out of scope:** remote hosting, auth tokens beyond local secret, rate limiting.

### P2 — Wiki Dream loop ✅ shipped 2026-05-10/11

**Why now:** Auto Dream validates the pattern conceptually but operates on flat memory files. Atellier's wiki is structured (sources, notes, contradictions, links). A Dream loop tailored to that structure is the *compounding memory* feature the previous plan asked for, with a clearer reference point now.

**Scope:**
- Scheduled `wiki-curator` run via `mcp__scheduled-tasks__create_scheduled_task` that:
  - prunes stale notes
  - resolves contradictions surfaced by `POST /wiki/lint`
  - links orphan notes
  - reorganizes the index
- Output: a "dream report" wiki entry per run so the operator can audit before changes land.
- Manual trigger button in Wiki view (don't gate everything on cron).
- Reuses existing `POST /wiki/lint` and `POST /wiki/page` (no new endpoints required initially).

**Out of scope:** silent merges. Dreams produce *proposed* changes that the operator approves, at least in v1.

### P3 — Anthropic executor mode (`AGENT_EXECUTOR_MODE=anthropic`) ✅ shipped 2026-05-10/11

> P3 grew during execution: in addition to the Anthropic path we added **Groq** (free cloud tier) and **Ollama** (local, no key) under a shared `OpenAiCompatibleAgentExecutorService`, plus **P3.c — per-agent-role routing for Ollama** (e.g. `qwen2.5-coder:7b` for `builder`, `llama3.1:8b` for the rest) exposed in `/health` as `executorRoleOverrides`.

**Why now:** Today the executor supports `mock` and `openai`. Adding `anthropic` gives us:
- Opus 4.7 (better coding + vision, same price as previous flagship)
- Native **prompt caching** (significant cost reduction on repeated runs)
- Avoids vendor lock-in to a single LLM provider — strategic insurance

**Scope:**
- New executor class in `apps/api/src/executors/` (or wherever the OpenAI executor lives), e.g. `AnthropicExecutor`.
- Env vars (additive — nothing existing changes):
  - `ANTHROPIC_API_KEY`
  - `ANTHROPIC_MODEL` (default `claude-opus-4-7`)
- `/health` exposes `executorMode` + `executorModel` + `modelProfile` for the new mode (existing pattern).
- Header executor badge already reads from `useHealthApi` — should render `ANTHROPIC (standard) claude-opus-4-7` with no UI work.
- Reuse the existing OpenAI cost-warning pattern (estimated tokens before run) for Anthropic runs.
- Default executor stays `mock`. Switching is env-only in v1.

**Out of scope (deferred):**
- Per-run executor override UI in Settings (P3.b, later iteration).
- Bedrock / Vertex routing.
- Migration of historical run logs.
- Tool-use parity audit between executors (track separately).

### P4 — Skills 2.0 alignment ✅ audited 2026-05-11 (no migration required; see `docs/skills.md`)

**Why now:** Anthropic's Skills 2.0 format (scripts + templates + reference materials) is close to where `.agents/skills/` was heading. Aligning early avoids divergence.

**Scope:**
- Audit `.agents/skills/` against Skills 2.0 schema.
- Migrate `atellier-build-loop` and `llm-wiki-ingest-loop` to the new format if compatible.
- Document the format in `docs/skills.md`.

**Out of scope:** writing brand-new skills.

### P5 — Codex Worker Evidence Pass v1.1 (still deferred as of 2026-05-11)

Still important. Scope unchanged from `docs/next-work-plan.md`. Lower leverage than P1–P4 right now.

## What we are explicitly NOT doing

- **MCP for everything.** Only the REST API wrapper. Don't ship random MCP tooling.
- **Managed Agents Dreaming integration.** Research preview, gated. Build the local Dream loop first, evaluate later.
- **Creative connectors** (Ableton, Blender, etc.) — outside scope.
- **Computer Use, Batch API, Citations, Files API** — no concrete need yet.
- **A separate desktop app.** Cowork *is* the desktop. We expose MCP.
- **Auth, multi-user, SaaS, cloud deploy.** Personal and local.
- **Pixel Office expansion.** Already decent. Don't get pulled into polish work because Pixel Agents validated the aesthetic.

## Executor configuration

New env contract once P3 lands:

```bash
# .env

# Executor selection (one of: mock | openai | anthropic)
AGENT_EXECUTOR_MODE=mock

# OpenAI (existing)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini

# Anthropic (NEW in P3)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-opus-4-7
```

`/health` payload (additive, illustrative):

```json
{
  "executorMode": "anthropic",
  "executorModel": "claude-opus-4-7",
  "modelProfile": "standard"
}
```

The header badge consumes `useHealthApi` already — no UI change needed for the basic case. A Settings toggle for runtime override is **deferred** (P3.b).

## Open questions for next session

1. **Per-run executor override** — Settings UI toggle, or stay env-driven for v1?
2. **Wiki Dream cadence** — every 6h cron? Manual button only? After every N orchestration runs?
3. **MCP server hosting** — separate process on its own port, or mounted on the existing Fastify instance?
4. **Skills 2.0 source-of-truth** — keep `.agents/skills/` and mirror to a Claude-Code-compatible folder, or migrate fully?
5. **Anthropic prompt caching** — adopt naive caching first (system prompt only), or wire up the wiki-context cache pattern from the start?

## First concrete tasks (next-iteration kickoff)

1. Read existing executor code in `apps/api/src/` to find the right insertion point for `AnthropicExecutor`.
2. Stub the Anthropic env handling and `/health` payload (no real calls yet).
3. Sketch the MCP server package with one end-to-end tool (`wiki/query`) before scaling to the full surface.
4. Draft the `wiki-curator` Dream prompt: inputs (lint report + recent notes), expected output (dream report wiki page), success criteria.

---

*Authored 2026-05-06 after the Code with Claude keynote. Update or supersede this file before starting work — do not let plans rot in place.*
