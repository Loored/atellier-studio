# Agent Memory Context Receipt

- Schema version: 1
- Query: Crea un plan operativo de tres días para validar la clasificación de QA. Cada día debe indicar acción concreta, señal observable de éxito y límite de aprobación humana. Entrega el artefacto para revisión humana.
- Policy: evidence-first
- Created at: 2026-08-31T03:21:35.505Z
- Stable hash: a135d7ea553e9cb1baf94b8d47432640a3c5f096e8163c83bee50aab4d82e16b
- Total budget: 16000 bytes
- Per-item budget: 4000 bytes

## Included items

### wiki/role-memory/wiki-curator.md

- Source: retrieval
- Authority: trusted
- Trust: verified
- Content SHA-256: 98c47bd3c31e4d99152d92517f9a9e3062f66670ee31d8adfc7ae11fc3c7b56d
- Bytes: 1709/1709
- Applicable role: wiki-curator
- Selection: Included as explicit role-scoped trusted memory for wiki-curator.
- Retrieval score: 3

### raw/ingest/2026-08-25-plan-operativo-de-14-d-as-para-usar-atellier-diariamente.md

- Source: retrieval
- Authority: evidence-only
- Trust: immutable-source
- Content SHA-256: 4a9cb97226553f732ef989ffe62fa13873599a708c39433e2d48135272c15b9a
- Bytes: 1994/1994
- Selection: Prioritized as immutable evidence.
- Retrieval score: 5

### raw/ingest/2026-08-31-context-pack-evaluation-brief.md

- Source: retrieval
- Authority: evidence-only
- Trust: immutable-source
- Content SHA-256: 7e0afe284975b69fcef918c6f8b9529401824aed83e60e9b331eb73564445b79
- Bytes: 770/770
- Selection: Prioritized as immutable evidence.
- Retrieval score: 5

## Excluded paths

- wiki/role-memory/builder.md: not-found
- wiki/role-memory/pm.md: not-found
- wiki/role-memory/qa.md: not-found
- wiki/deliverables/6a8f628b15c66fcd155044e1-atellier-build-loop-completed-with-validation-bl.md: context-only
- wiki/deliverables/6a94ee8f6fbbda91fd282eec-atellier-build-loop-completed-with-validation-bl.md: context-only
- wiki/deliverables/69fac3fb983854dc6a57f74a-pepe-builder-completed-execution-and-requests-re.md: context-only
- wiki/deliverables/69facb18983854dc6a581122-pepe-builder-completed-execution-and-requests-re.md: context-only
