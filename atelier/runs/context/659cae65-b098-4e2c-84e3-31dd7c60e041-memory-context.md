# Agent Memory Context Receipt

- Schema version: 1
- Query: Crea un checklist operativo de una jornada para validar un receipt de Context Pack. Debe incluir una acción concreta, una señal observable de éxito y el límite de revisión humana. No uses ni propongas el plan de 14 días. Validar receipt con brief fuente-acotado Crear un checklist de una jornada con acción concreta, señal observable y límite de revisión humana. No usar ni proponer el plan de 14 días.
- Policy: evidence-first
- Created at: 2026-08-31T04:24:04.146Z
- Stable hash: b41eac65f0f2b48dc334a43bdaeb1ee17da457defe353a3d6df270fbcee293c4
- Total budget: 16000 bytes
- Per-item budget: 4000 bytes

## Included items

### raw/ingest/2026-08-31-context-pack-evaluation-brief.md

- Source: direct
- Authority: evidence-only
- Trust: immutable-source
- Content SHA-256: 7e0afe284975b69fcef918c6f8b9529401824aed83e60e9b331eb73564445b79
- Bytes: 770/770
- Selection: Direct task source.

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
- Retrieval score: 10

## Excluded paths

- wiki/role-memory/builder.md: not-found
- wiki/role-memory/pm.md: not-found
- wiki/role-memory/qa.md: not-found
- wiki/deliverables/6a8f6b4a1e35355494d1eac2-atellier-build-loop-completed-with-validation-bl.md: context-only
- wiki/deliverables/6a94ee8f6fbbda91fd282eec-atellier-build-loop-completed-with-validation-bl.md: context-only
- wiki/deliverables/c38de41b-3d53-401e-8054-f428c8cd5057-atellier-build-loop-completed-with-validation-bl.md: context-only
- wiki/sources/2026-08-25-plan-operativo-de-14-d-as-para-usar-atellier-diariamente.md: context-only
- raw/ingest/2026-08-31-context-pack-evaluation-brief.md: duplicate
