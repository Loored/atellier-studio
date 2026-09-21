# C2 — evidencia de runs antes de Builder

Fecha: 2026-09-17.

## Objetivo

Evitar que un Builder de una comparación operativa concluya que un recibo actual no existe solo porque no aparece como una ruta Wiki elegible.

## Implementación

- Objetivos que nombran uno o dos IDs exactos y solicitan comparación/inspección de estado activan una lectura previa `runs.read`; menciones incidentales y tres o más IDs no la activan.
- El adaptador conserva sus límites, rol Builder y presupuesto de canary. La invocación queda en el parent, junto con IDs solicitados, estado, registros acotados y hash de evidencia.
- Builder, Runtime, QA y reparaciones reciben el mismo recibo serializado como datos. Si la lectura se deniega o falla, el contexto exige marcar solo los campos afectados como no verificados.
- El recibo se recupera después de un reinicio y no se vuelve a pedir mientras coincidan hash de objetivo e IDs.

## Verificación

Una prueba de Build Loop crea dos runs, inicia una comparación y confirma una única invocación `runs.read` antes de Builder, el snapshot durable y ambos IDs en su contexto. Las pruebas usan UUIDs en memoria; el detector también acepta los ObjectIds de Mongo.

## Siguiente

C3: una proyección versionada de capacidades/estados reales para impedir que planes describan campos o colas inexistentes como si fueran contratos actuales.
