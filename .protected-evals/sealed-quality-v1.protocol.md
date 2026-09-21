# Sealed quality campaign v1 — creation protocol

Status: **not created**. This file intentionally contains no case prompts, expected artifacts, or labels.

Create exactly eight cases only after the calibration revision is human-confirmed and the implementation/configuration fingerprint is frozen:

1. Two blank-template cases.
2. Two fact-report cases with bounded permitted run evidence.
3. Two future-procedure cases.
4. Two test-proposal cases.

For every case, store separately:

- subject-visible goal and permitted evidence;
- private expected properties and evaluator rubric;
- case fingerprint, author, creation time and campaign eligibility;
- a rule that opening the private rubric for tuning changes eligibility to `diagnostic`.

The runner must reject any case lacking a frozen calibration reference or private-rubric fingerprint. The current v1 holdout remains a regression/diagnostic suite and is not substituted for this future sealed set.
