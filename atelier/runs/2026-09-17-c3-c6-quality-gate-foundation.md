# C3–C6 — base de contrato, calidad, reparación y campañas

Fecha: 2026-09-17.

## C3

La proyección de capacidades operativas deriva estados y campos de tipos compartidos y el catálogo de herramientas. Builder recibe el contrato y su hash. Campos/estados técnicos no listados se registran como incompatibles; ejemplos marcados explícitamente como propuestas no se interpretan como estado actual.

## C4

El parent almacena un recibo determinista de calidad separado de QA y del review humano. Vincula hashes de objetivo, artefacto, contrato operativo y evidencia previa. Las plantillas vacías solicitadas con secciones completas pueden verificarse sin inventar incidentes; contradicciones estructurales, identificadores inventados y evidencia autorreferencial se rechazan. Lo no decidible permanece sin verificar.

## C5

Cuando una reparación semántica válida no modifica el Requested Artifact, el loop se detiene y guarda hashes antes/después en `repairStall`. Esto sustituyó una prueba histórica que agotaba tres reparaciones idénticas.

## C6

El runner tiene identidad opcional de campaña y variante. El primer evento registra modelo/configuración y hash de matriz; su journal aislado solo puede reanudarse con la misma identidad.

## Verificación

Pruebas focalizadas para contrato de objetivo, recibo previo de runs, contrato operativo, calidad y loop pasaron. `corepack pnpm test:dev-local` pasó con 15 subpruebas. La suite completa de API se repite tras el nuevo caso de reparación antes de declarar este slice validado.

## Pendiente

Calibrar evaluación positiva/negativa, crear casos nuevos que no hayan sido vistos por desarrollo, aplicar presupuesto acumulado y producir el reporte C7. No se ejecutó campaña real ni se cambió aprobación/promo­ción alguna.
# C3–C6 quality-gate foundation — follow-up

## 2026-09-17 C5/C6 continuation

- The live orchestration view now displays the server-owned quality receipt and an explicit no-artifact-progress stop. Neither is an approval control.
- A named campaign freezes 12 minutes of measured child execution time and one semantic repair per case. If either is exceeded, the runner writes `budget-exceeded` to its campaign journal and stops before dispatching a later case.
- The runner does not claim a token metric because local Ollama receipts do not currently provide a provider-confirmed token count.
- Added a 24-fixture calibration package across blank templates, fact reports, future procedures, and test proposals. It exercises the same deterministic evaluator used by the API. Fixture labels are agent-proposed, not human-confirmed; the semantic families deliberately retain `unverified` rather than being overstated as positive quality.

## Validation

- `corepack pnpm test:dev-local` — passed (16 tests).
- `corepack pnpm test:api` — passed (292 tests; 7 opt-in Mongo tests skipped).
- `corepack pnpm -r typecheck` — passed.
- `corepack pnpm build` — passed (existing Vite chunk-size warning only).
- `git diff --check` — passed.

## Remaining closure

Compact human adjudication of subjective calibration labels, a protected fresh sealed case set, a real serial campaign, and C7 report remain required before steps 5–8.

## Local operational verification

- `GET /health` on the local API reported Mongo connected, Ollama mode, `qwen3.5:4b` default and `qwen3.5:9b` for QA, with zero active runs at the time of the check.
- The Vite UI loaded at `http://127.0.0.1:5174/` and rendered the selected models, agents, orchestration form and current local API state.
- The quality-receipt card has type/build/test coverage. It cannot be visually populated without a newly completed orchestration; starting one solely for UI evidence would consume local model time and contaminate the next sealed campaign, so it was intentionally not dispatched.

## Calibration handoff

- Added `docs/quality-calibration-human-review.md`: a six-row operator decision table for the only subjective cases. The other 18 fixture results are already replayed by deterministic tests.
- Added `.protected-evals/sealed-quality-v1.protocol.md` with no actual goals or labels. It defines the conditions for creating the eight cases only after the calibration and configuration fingerprints freeze.
- Focused calibration test, script tests, workspace typecheck, and `git diff --check` passed.

## Reload and campaign-identity verification

- The C5 no-progress test reloads the completed parent through `GET /orchestrations/:id/status`, confirming its independent quality receipt and repair stall remain visible after the service boundary.
- The C6 campaign manifest now includes `HEAD`, the sorted dirty-path snapshot and a stable hash of those values. This makes the actual worktree state inspectable instead of assuming it is clean.
- Focused API test, script tests, workspace typecheck and `git diff --check` passed.

## Delegated calibration and sealed campaign preparation

- The operator delegated the six subjective calibration decisions to Codex. The decision record deliberately says `delegated-agent-adjudication`; it is not represented as independent human confirmation.
- Added `sealed-quality-v1` with two cases per artifact family. Its matrix hash is enforced by a protected audit, and the runner requires `--sealed=quality-v1` to give it an isolated journal.
- Script tests verify exact sealed-suite identity, command selection and a protected negative control. API calibration tests and workspace typecheck passed.
- No sealed case was dispatched. The next authorized operation is the serial real campaign, not tuning against these cases.
