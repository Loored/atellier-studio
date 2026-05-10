# Skills format

Atellier ships eight Codex/Claude Code skills under `.agents/skills/`. They tell an LLM-driven coding agent *when* to engage and *how* to operate inside this codebase. They are not orchestration skills (those live in `apps/api/src/services/skill-orchestration.service.ts` as `SKILL_TEMPLATES`).

Status: **P4 — already aligned with Skills 2.0**. No migration is required; the audit below explains why and lists optional enhancements.

## Format we use

Each skill lives at `.agents/skills/<skill-name>/SKILL.md`. The file is markdown with a YAML frontmatter:

```markdown
---
name: skill-name-in-kebab-case
description: One-sentence trigger condition that tells the agent *when* to load this skill.
---

# Human-readable title

## Workflow

Numbered steps the agent should follow, ideally each step is a single concrete
action.

## Definition of done

Bulleted list of conditions the agent uses to decide it has finished.
```

The whole skill is **guidance text**: no executable code, no scripts, no templates. The agent reads it as system context when the trigger description matches what the user is asking for.

## Skill 2.0 compatibility audit

Anthropic's Skills 2.0 specification (`Code with Claude 2026` keynote) standardizes skills as folders containing:

1. **`SKILL.md`** with YAML frontmatter (`name`, `description`; optional `allowed-tools`, `mode`).
2. Optional **`scripts/`** with executable helpers the agent can invoke.
3. Optional **`references/`** with read-only files the agent can load on demand.
4. Optional **`templates/`** with files to copy and modify.

Atellier's current shape vs Skills 2.0:

| Element | Skills 2.0 | Atellier today | Action |
|---|---|---|---|
| Folder per skill with `SKILL.md` | required | ✅ all 8 | none |
| `name` in frontmatter | required, kebab-case | ✅ all 8 | none |
| `description` in frontmatter | required, one-sentence trigger | ✅ all 8 | none |
| `allowed-tools` in frontmatter | optional | not used | optional |
| `mode` (e.g. `read-only`) | optional | not used | optional |
| `scripts/` subdirectory | optional | none | future |
| `references/` subdirectory | optional | none | future |
| `templates/` subdirectory | optional | none | future |

**Conclusion:** the eight existing skills satisfy the Skills 2.0 minimum. They are already loadable by Claude Code, Cowork, and any other Skills 2.0 client without modification. There is no migration debt.

## Skill inventory

| Skill | When to use |
|---|---|
| `atellier-feature-builder` | Implementing a new feature end-to-end across shared types, API, web hooks, and components |
| `atellier-api-layer` | Adding/modifying frontend API calls, TanStack Query hooks, services, mutations |
| `atellier-agent-orchestrator` | Coordinating multi-agent work via skill-triggered orchestration runs |
| `atellier-wiki-ingest` | Ingesting new notes, pasted text, research, decisions into atelier/raw and atelier/wiki |
| `atellier-test-runner` | Before finishing any code task, or after modifying API routes / hooks / shared types |
| `atellier-reviewer` | Reviewing a completed change for architecture drift, test gaps, wiki compliance |
| `atellier-ui-ux-reviewer` | Reviewing Atellier UI/UX without Figma — hierarchy, clarity, density, accessibility |
| `atellier-ui-polisher` | Implementing small, safe UI/UX improvements after a UI/UX review |

## Optional enhancements (not required, no plan to ship now)

These are Skills 2.0 capabilities Atellier has not adopted and which would each be a deliberate scope expansion. None are blockers; document for future consideration:

- **`allowed-tools` per skill.** Could pin skills like `atellier-reviewer` to read-only tools (Read, Grep) so an agent invoking it cannot accidentally edit files. Useful for safety, not behavior.
- **`scripts/` for repeatable checks.** `atellier-test-runner` could ship a `scripts/preflight.sh` that runs `pnpm typecheck && pnpm test:api && pnpm test:web` so the agent invokes a single script instead of remembering the recipe. Same for `atellier-feature-builder` smoke checks.
- **`references/` for shared snippets.** `atellier-api-layer` could include a `references/api-hook-pattern.md` with the canonical `services → API hooks → feature hooks → components` example, kept in lockstep with the live code. Avoids the skill prose drifting from real conventions.
- **`templates/` for boilerplate.** A new feature could start from `templates/new-route.ts` and `templates/new-feature-hook.ts` to enforce shape from day one.

If/when these get prioritized, the migration is purely additive — none of them break the current SKILL.md files.

## Out of scope (deliberate)

- **Auto-loading skills from a remote registry.** Skills stay in-repo so the operator can read and edit them.
- **Skills that mutate the orchestration loop.** Orchestration skills (`atellier-build-loop`, `llm-wiki-ingest-loop`, `wiki-dream-loop`) live in TS code and remain there; mixing them with `.agents/skills/` would conflate "agent-driving guidance" with "Atellier internals".
- **Hard-coded tool permissions outside the frontmatter.** The agent runtime owns those; skills only declare intent.
