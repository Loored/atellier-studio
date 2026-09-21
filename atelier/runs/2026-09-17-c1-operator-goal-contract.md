# C1 — contrato de objetivo y evaluación

Fecha: 2026-09-17.

## Objetivo

Convertir el objetivo original del operador en una entrada congelada más precisa antes de implementar adquisición de evidencia y el evaluador de calidad.

## Implementación

- El contrato de objetivo pasó a versión 3. Conserva una vista compatible de criterios y añade requisitos `AC-N` estables, origen `operator`, tipo de requisito, prohibiciones y tipo de artefacto.
- Reconoce `blank-template`, `future-procedure`, `test-proposal`, `fact-report` y `general`; esta clasificación describe la entrega solicitada y no afirma que el artefacto final sea correcto.
- Extrae secciones explícitas en inglés y español desde las formas `include`, `with`, `incluye` y `con`, sin interpretar frases ordinarias como cabeceras.
- Los contratos existentes con versión anterior no se reinterpretan: la ejecución los rechaza como congelados obsoletos y requiere una nueva orquestación.

## Verificación

`corepack pnpm --filter @atellier/api exec vitest run src/test/operator-goal-contract.test.ts src/test/daily-use-loop.test.ts`: 29 pruebas pasaron.

Las pruebas cubren requisitos y prohibiciones del operador, secciones en inglés/español, plantillas vacías válidas, omisiones de secciones y preservación de límites frente a criterios del PM.

## Siguiente

C2: adquirir y congelar evidencia de runs antes de Builder cuando el objetivo nombra uno o dos IDs y pide sus valores actuales.
