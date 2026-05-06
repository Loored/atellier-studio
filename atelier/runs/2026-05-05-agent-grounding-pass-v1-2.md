# Run: Agent Grounding Pass v1.2

- Date: 2026-05-05
- Operator: Codex
- Scope: agent executor prompt, agent response validation, run review guardrails, agent/review/run UI validation surfaces
- Trigger: Real OpenAI-backed builder runs were producing plausible but ungrounded file paths and mixing proposed files with actual changed files.

## Actions

- Split the builder contract into `Candidate files` for proposed work and `Changed files` only for externally verified diffs.
- Updated the OpenAI executor prompt to state that the chat executor cannot edit repository files.
- Made verified repo file hints recursive so nested wiki feature files are available to the model and validator.
- Extended agent validation output with:
  - `candidateFiles`
  - `referencedFiles`
  - `invalidReferencedFiles`
  - `changedFiles`
- Validates builder paths mentioned anywhere in the response, not only inside the file list section.
- Treats `Changed files` from the current chat executor as a warning unless backed by future diff evidence.
- Captures the streaming run result in the agent side panel so validation reflects the run that just completed.
- Updated validation UI to show `warnings` separately from clean `passed`.

## Validation

- `pnpm typecheck` passed
- `pnpm test:api` passed
- `pnpm test:web` passed

## Outcome

The builder path-grounding loop is now more honest: proposed files are distinct from actual edits, nested verified files are available, and nonexistent paths are blocking validation errors even when they appear in summary or blocker text.
