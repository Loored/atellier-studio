import assert from "node:assert/strict";
import { test } from "node:test";
import { assertFrozenRubric, auditFrozenNegativeControls } from "./quality-audit.mjs";

test("frozen rubric remains eight cases, with no automatic positive quality verdict", () => {
  assert.equal(assertFrozenRubric().cases.length, 8);
  assert.equal(auditFrozenNegativeControls({ caseId: "document-review-memo", artifact: "## Summary\n[Run facts pending]" }).verdict, "unverified");
});

test("historically misleading artifacts trip distinct independent negative controls", () => {
  const cases = [
    { caseId: "plan-failed-run-triage", parentRunId: "real-parent", artifact: "Day 1: list failures from orchestration real-parent." },
    { caseId: "plan-review-queue", artifact: "Query execution-queue.service.ts to fetch all needs-human runs in the Review queue." },
    { caseId: "document-review-memo", artifact: "## Summary\nNo critical errors or crashes were recorded during execution." },
    { caseId: "document-memory-decision", artifact: "### Summary\n### Approach\nApprove everything." },
    { caseId: "run-qa-parent-disagreement", artifact: "### Status\nCompleted and approved.\nNew session entry appended." },
    { caseId: "reasoning-qa-regression", artifact: "Test artifact Day-001 and Day-002." },
    { caseId: "reasoning-citation-boundary", artifact: "Modify agent-response-validator.service.ts." },
  ];
  for (const item of cases) {
    const result = auditFrozenNegativeControls(item);
    assert.equal(result.verdict, "rejected", item.caseId);
    assert.ok(result.reasons.length);
  }
});
