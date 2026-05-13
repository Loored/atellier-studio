# Wiki Dream Loop

A periodic curator pass over the Atellier wiki. Surfaces lint issues, stale pages, contradictions, and orphan notes; produces a **dream report** of *proposed* changes that the operator approves before any other wiki page is touched.

Status: **P2.c — grounded UI loop live**. Implemented as the orchestration skill `wiki-dream-loop` so it reuses the existing run/orchestration/agent machinery and is triggerable from the REST API, the MCP server, the Wiki panel, or any scheduler that can hit either. The audit step now receives a real grounding block from the backend: latest wiki lint output plus the current `atelier/wiki/**/*.md` path listing.

## What it does (and what it does NOT)

| ✅ Does | ❌ Does not |
|---|---|
| Reads `POST /wiki/lint`, recent `wiki/log` entries, and the index | Apply changes to other wiki pages silently |
| Proposes one specific resolution per finding | Run any wiki write that the operator did not approve |
| Drafts a single page-shaped report (with a suggested filename) | Persist that report as a wiki page on its own |
| Optionally proposes a tracked task if the changes are non-trivial | Open tasks automatically — the PM agent only proposes |

The dream loop is intentionally **read-only at the LLM layer**. The operator (or an MCP client acting on their behalf) decides whether to save the report via `wiki_page_write` and whether to act on each proposal.

## Grounding

Before the `audit` step runs, the API injects a `Wiki Dream Grounding` section into the agent context. It includes:

- `wiki.lint()` result, including issue code, path, message, and suggestion
- the fresh list of real markdown pages under `atelier/wiki`
- an explicit instruction to use only listed paths and mark unlisted pages as unverified

This keeps the curator from inventing wiki paths during dream reports while preserving the no-silent-writes rule.

## Wiki UI

The Wiki panel includes:

- `Dream now` to start `wiki-dream-loop`
- live parent/draft run status
- inline preview of the `draft-report` output
- `Save report` to persist the approved report through `POST /wiki/page`

Reports are saved under `wiki/dreams/*.md`, which is now part of the safe write allowlist.

## Steps

`wiki-dream-loop` runs four steps. Every step is an LLM run; nothing is hard-coded business logic.

| # | Step | Phase | Agent | What it produces |
|---|---|---|---|---|
| 1 | `audit` | wiki | Wiki Curator | A categorized list of issues (stale, contradictions, orphans, broken links, overgrown index sections) — paths named explicitly |
| 2 | `propose-changes` | wiki | Wiki Curator | One concrete action per finding (archive / merge / link / rewrite) |
| 3 | `draft-report` | wiki | Wiki Curator | A markdown report with `Summary`, `Findings`, `Proposed actions`; suggests a filename `wiki/dreams/<YYYY-MM-DD>-dream-report.md` |
| 4 | `task-followup` | plan | Pepe PM | Either a single proposed task (title / scope / acceptance criteria) or an explicit "no task needed" |

## How to trigger

### Manual — REST API

```bash
curl -s -X POST http://127.0.0.1:4000/orchestrations/skills/wiki-dream-loop/run \
  -H 'Content-Type: application/json' \
  -d '{
    "goal": "Periodic curator pass — propose tidy-ups but apply nothing.",
    "context": "Triggered manually after the merge."
  }' | python3 -m json.tool
```

You get back `{ "runId": "..." }`. Poll:

```bash
curl -s http://127.0.0.1:4000/orchestrations/<runId>/status | python3 -m json.tool
```

When `status: "completed"`, fetch the agent runs to read the draft report — the last step's output is the dream report's body.

### Manual — MCP

From Claude Code or any MCP client connected to the Atellier MCP server:

> Use the atellier MCP server: list orchestration skills, then run `wiki-dream-loop` with the goal "weekly tidy-up". Poll until completed and show me the draft report.

This invokes:

1. `orchestration_skills_list`
2. `orchestration_run` with `skillId: "wiki-dream-loop"` and a goal
3. `orchestration_status` polling
4. `runs_list` to find the agent run for `draft-report`, then read its output

A capable client can then offer to call `wiki_page_write` with the suggested filename to persist the report (still *only the report*, not the proposals).

### Scheduled — external cron

Atellier does not run an internal scheduler in v1 (intentional — keep the API stateless). Use any external cron / launchd / `mcp__scheduled-tasks__create_scheduled_task` to fire the same `POST /orchestrations/skills/wiki-dream-loop/run` on a cadence you choose.

Recommended cadence:

- **Every 6 hours** during active project periods — captures contradictions soon after they're introduced.
- **Once a day at low-traffic time** for steady-state work.
- **Manual only** for early days while you're calibrating the curator's proposals.

Whatever cadence you pick, **do not auto-apply** the proposals. The dream loop is designed around operator approval. If you find yourself approving every proposal blindly, that's a signal the loop is too noisy — tighten the curator's audit instruction before turning auto-apply on.

## Why this design

- **Reuses orchestration**, not a new endpoint family. Every existing tool that watches runs (Runs view, Pixel Office, MCP `runs_list`) sees a dream run with no extra wiring.
- **No silent merges.** The report is text. Persistence is a separate, deliberate operator action via `wiki_page_write`.
- **No new agents.** The same `Wiki Curator` and `Pepe PM` agents are used. Their `instructions` come from `ROLE_SYSTEM_INSTRUCTIONS`; no role expansion was needed.
- **Cheap on Ollama.** Four LLM calls per dream, modest context. With `llama3.1:8b` on M3 Pro this completes in ~30-60s and costs nothing.
- **Compoundable.** When the per-agent-role routing lands (P3.c), Wiki Curator can be pinned to a smaller / more concise model than the Builder's coder model, keeping dreams fast.

## Out of scope (intentional, deferred)

- **Auto-persist the report.** Could be a `postRunCallback` registered on the skill; deliberate kept manual to enforce the approval pattern.
- **Resolved-contradictions tracking.** When the operator applies a proposed change, we don't yet record that the proposal was acted on. Track in a future report-review slice.
- **Dream-of-dreams.** Reflective passes over previous reports to detect repeated proposals (signal the audit instruction is too aggressive). Future.
