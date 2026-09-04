# QA Semantic Feedback Classification

- Date: 2026-08-31
- Branch: `codex/reflection-trust-hardening`
- Status: completed

## Goal

Ensure an explicit QA `CHANGES REQUESTED` response with at least one structured `FAIL` reaches the bounded semantic Builder-repair loop even when QA omitted another required checklist line.

## Evidence and change

- Real local run `6a94ee8f6fbbda91fd282eec` returned an explicit `CHANGES REQUESTED` QA verdict with actionable failures, but omitted an acceptance-criterion checklist line.
- The prior classifier required complete checklist coverage for both approval and changes-requested verdicts. It therefore treated the actionable response as a format failure, spent two QA-format retries, and stopped needs-human without attempting semantic repair.
- The classifier now keeps approval strict: every expected criterion must be covered and no item may fail.
- For `CHANGES REQUESTED`, one structured `FAIL` is sufficient to enter the already bounded semantic repair/recheck loop. A missing verdict or no actionable failure still uses the bounded format-retry path.

## Safety boundaries

- No extra repair budget or new autonomous authority was added; existing semantic and format retry bounds remain unchanged.
- QA may not approve an incomplete checklist.
- Tests use an in-memory deterministic executor only; no external LLM is called.

## Validation

- Focused daily-use operational suite: 14 passed.
- API typecheck: passed.

## Next

Run another real local task with the corrected control flow, label its frozen context receipt, and continue collecting evidence before changing memory retrieval policy or budgets.
