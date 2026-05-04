---
name: atellier-reviewer
description: Use when reviewing a completed change for architecture drift, test gaps, Atellier Wiki compliance, frontend API conventions, and operational safety.
---

# Atellier Reviewer Skill

Review critically.

## Check

- Did the change respect Atellier's local-first/private scope?
- Did it avoid premature MCP/pixel/auth/cloud work?
- Did it preserve raw/wiki/tasks/runs separation?
- Did it update wiki/log when durable knowledge was created?
- Did frontend API access follow service -> API hook -> feature hook -> component?
- Did it avoid direct axios/fetch in components?
- Did backend routes stay thin?
- Did tests cover critical behavior?
- Did it avoid external LLM calls in tests?
- Did it update docs if setup changed?

## Output format

Return:

1. Blockers
2. Important fixes
3. Nice-to-have improvements
4. Tests run
5. Files reviewed
