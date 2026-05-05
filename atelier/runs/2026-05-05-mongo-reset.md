# 2026-05-05 Mongo reset

## Summary

Reset the local MongoDB operational database to remove stale agent/task/run/message state from previous local sessions.

## Actions

- Ensured the `atellier-mongo` container was running through Docker Compose.
- Dropped the `atellier_studio` database with `db.dropDatabase()`.
- Verified the database has no collections after reset.
- Confirmed the running API reports Mongo storage with zero agents and zero active/waiting runs.

## Verification

- `db.dropDatabase()` returned `{ ok: 1, dropped: 'atellier_studio' }`.
- `db.getCollectionNames()` returned `[]`.
- `GET /health` returned `agentsTotal: 0`, `waitingAgents: 0`, and `activeRuns: 0`.
