---
name: atellier-wiki-ingest
description: Use when ingesting new notes, pasted text, client context, research, decisions, or project knowledge into Atellier Studio's raw/wiki/tasks/runs structure.
---

# Atellier Wiki Ingest Skill

Use this skill when the user asks to ingest, organize, preserve, summarize, or connect new information.

## Core principle

Atellier Studio follows the LLM Wiki pattern.

Do not only summarize.
Integrate knowledge into the persistent wiki.

## Required workflow

1. Preserve raw input under `atelier/raw/` when applicable.
2. Create or update a source summary.
3. Read `atelier/wiki/index.md` first.
4. Update relevant wiki pages.
5. Detect contradictions with existing knowledge.
6. Update `atelier/wiki/index.md`.
7. Append an entry to `atelier/wiki/log.md`.
8. If the source implies work, create or update tasks under `atelier/tasks/`.
9. Save reusable outputs into the wiki instead of leaving them only in chat.

## Do not

- Overwrite raw sources.
- Hide durable knowledge only in MongoDB.
- Create duplicate pages if a relevant page already exists.
- Treat chat history as the source of truth when wiki pages exist.

## Log format

Use:

```md
## [ISO_DATE] ingest | Title
```

Include source path, pages created, pages updated, contradictions found, and tasks proposed.
