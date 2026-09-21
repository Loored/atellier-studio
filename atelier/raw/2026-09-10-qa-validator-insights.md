# QA validator insights received from external review

Received: 2026-09-10

The review identified two coupled failure modes in the lightweight-model QA path:

1. QA criteria were compared using normalized exact equality, so a small model's faithful paraphrase could be classified as an omitted criterion.
2. Checklist lines without evidence were silently discarded, causing a present-but-incomplete criterion to be reported as omitted.

The review recommended treating model adherence and validator measurement as separate concerns before changing model size, retry counts, or timeouts.
