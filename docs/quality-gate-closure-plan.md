# Plan de cierre de los pasos 1–4 antes de implementar 5–8

Fecha: 2026-09-17. Estado: C1–C4 implementados y validados; C5 y C6 parcialmente implementados; C7 pendiente.

Complementa `docs/autonomous-improvement-roadmap.md`. El objetivo es que el harness produzca resultados fundamentados, reconozca cuándo faltan pruebas y mida calidad de forma reproducible antes de usar esa medida para aprender o adoptar cambios.

## Diagnóstico y correcciones de interpretación

- Builder puede ignorar `runs.read` y confundir rutas Wiki elegibles con disponibilidad de datos operativos. Anunciar una herramienta en el prompt no garantiza su uso.
- QA pudo leer los dos runs, pero su lectura posterior no fundamenta retroactivamente el artefacto de Builder. Las reparaciones necesitan el recibo original y su procedencia, no solamente el comentario de QA.
- La comprobación `qaPassEvidenceIsCurrentArtifact` usa coincidencias de palabras. Puede aceptar razonamientos incorrectos con vocabulario compartido y bloquear observaciones correctas sobre ausencia de contenido.
- `requiredSections` reconoce una forma limitada con `include`; peticiones como `with … sections` pueden perder esa validación. La interpretación del objetivo también necesita pruebas en español y con restricciones negativas.
- Una plantilla solicitada **en blanco** puede ser correcta con campos vacíos. No se debe añadir después del experimento una exigencia de contenido que el objetivo no contenía. Su utilidad y la corrección del bloqueo siguen pendientes de adjudicación, no están demostradas por el fallo del parent.
- El plan formalmente listo menciona campos y estados sin procedencia comprobada. La aprobación textual de QA no demuestra compatibilidad con el contrato actual.
- Los auditores actuales son controles negativos específicos: solo producen `rejected` o `unverified`. No constituyen todavía un evaluador positivo de calidad.
- Los cuatro casos ejecutados comparten journal aunque se hicieron cambios entre ellos. Ese journal no es una medición de una única versión congelada. El runner tampoco permite repetir un caso terminado en una campaña nueva con una variante explícita.
- La matriz v1 completa fue accesible y consultada durante el desarrollo. Se conserva como diagnóstico/regresión; ninguno de sus casos servirá como prueba de generalización desconocida para esta implementación.
- Las revisiones anteriores realizadas por el agente deben registrarse como auditoría del agente. No equivalen a etiquetas confirmadas por el usuario, aunque una nota histórica diga «human reading».

## Secuencia de implementación

Los identificadores C1–C7 pertenecen a este cierre; no renumeran los pasos 5–8 del roadmap. Cada slice debe quedar revisable y probado antes del siguiente. Solo C2 y C3 pueden implementarse en paralelo una vez fijado C1; las inferencias de Ollama se mantienen seriales.

### C1 — Contrato de objetivo y evaluación

**Resultado:** un contrato versionado que distinga lo solicitado, la prueba necesaria y el tipo de artefacto.

- Conservar cada cláusula original, su procedencia y un ID estable; PM solo complementa donde el objetivo permite interpretación.
- Representar secciones, cantidades, prohibiciones y requisitos de evidencia explícitos. Soportar las formas de los casos existentes, incluyendo `with … sections`, `include`, `con … secciones` e `incluye`, sin interpretar cualquier lista como cabeceras.
- Distinguir plantilla vacía, informe de hechos, procedimiento futuro y propuesta de pruebas. No exigir ejecución previa a un plan ni hechos observados a una plantilla.
- Separar dimensiones: estructura, procedencia, fidelidad al objetivo, compatibilidad con capacidades actuales, límites de acción y costo. El costo nunca compensa un fallo de calidad.
- Definir códigos de causa: dato ausente, acceso denegado, evidencia no adquirida, cita sin soporte, contrato inventado, instrucción incumplida, evaluador inconcluso y resultado incorrecto.
- Preservar contratos antiguos en sus runs. Una versión nueva no reinterpreta ni modifica resultados históricos.

**Archivos principales:** `packages/shared/src/types/`, `apps/api/src/services/operator-goal-contract.ts`, `apps/api/src/services/skill-orchestration.service.ts` y sus pruebas.

**Salida verificable:** casos válidos e inválidos del mismo tipo se distinguen; las plantillas vacías permitidas pasan estructura, las secciones omitidas fallan y ninguna cláusula PM desplaza una prohibición del usuario.

**Estado 2026-09-17:** implementado en el contrato congelado v3. Cada requisito tiene `AC-N`, `source: operator` y un tipo; se preservan prohibiciones, se distinguen plantillas vacías/procedimientos/propuestas de pruebas/informes, y se reconocen secciones con `include`, `with`, `incluye` y `con`. Los contratos v2 encolados fallan cerrados por revisión obsoleta. Las pruebas cubren secciones en inglés/español, una plantilla vacía válida, omisiones y prohibiciones. La evaluación de calidad por dimensión corresponde a C4.

### C2 — Evidencia disponible antes de construir y reparar

**Resultado:** Builder y las reparaciones reciben evidencia operativa trazable cuando el objetivo la requiere.

- Para uno o dos IDs explícitos y una petición clara de estado/comparación, construir una necesidad de evidencia en el servidor. Resolverla antes de generar el artefacto usando el adaptador registrado `runs.read`.
- Esa lectura consume el presupuesto existente, aplica rol/política/canary y deja invocación durable. No añade una segunda llamada oculta ni convierte IDs arbitrarios presentes en documentos en órdenes de lectura.
- En objetivos ambiguos, conservar selección de herramienta por el agente; cuando la lectura falla o está denegada, conservar la causa exacta y exigir `unverified` solo para los campos afectados.
- Persistir un snapshot acotado con ID de recibo, IDs de runs, campos presentes, fecha de captura, versión y hash. Separar datos faltantes de valores como `0`, `false` y listas vacías.
- Reutilizar el mismo snapshot en Builder, QA y reparación. Si QA adquiere evidencia nueva, crear una revisión de evidencia explícita y una nueva revisión del artefacto; nunca validar retroactivamente el anterior.
- Acotar campos antes de serializar, preservando JSON válido; reemplazar el corte ciego de texto a 6.000 caracteres por selección y metadatos de omisión.
- Un recibo cambiado, truncado o de otro run no puede respaldar la afirmación actual. La reanudación conserva la referencia original o registra de forma explícita una nueva lectura.

**Archivos principales:** `agent-run.service.ts`, `tool-harness.service.ts`, `skill-orchestration.service.ts`, tipos de run/evidencia y pruebas de Tool Harness/runtime.

**Salida verificable:** una comparación real cita correctamente ambos recibos; la misma prueba con lectura denegada abstiene los valores, sin inventarlos; reinicio/reparación mantiene hashes y presupuesto.

**Estado 2026-09-17:** implementado para objetivos explícitos de comparación/inspección de uno o dos IDs de run. El servidor adquiere una vez `runs.read` bajo el rol Builder y presupuesto vigente, persiste ID de invocación, resultado, hash y estado en el parent, y lo reutiliza en Builder/QA/reparaciones. Admite ObjectIds de Mongo y UUIDs del almacenamiento de pruebas. Una lectura denegada o fallida queda como recibo sin registros y el contexto exige dejar únicamente esos campos sin verificar. Falta la validación operativa real y pruebas de reinicio/presupuesto de C5–C6.

### C3 — Contrato operativo comprobable

**Resultado:** los planes usan nombres y capacidades reales de Atellier.

- Crear una proyección pequeña y versionada de capacidades a partir de contratos compartidos, validadores y catálogo existentes: campos públicos relevantes, estados reales, lecturas disponibles y frontera de review.
- No mantener otra lista manual de enums que pueda divergir. Incluir versión/hash y pruebas de concordancia con las fuentes de autoridad.
- Los hechos del estado actual provienen de recibos vivos; el contrato solo describe lo que el sistema puede representar o hacer. Wiki aporta contexto, no sustituye esas autoridades.
- Verificar identificadores técnicos presentados como existentes. Si no se conocen, usar instrucciones orientadas a la interfaz o marcarlos como propuesta/hipótesis, sin afirmar que existe un campo nuevo.
- Aplicar esta verificación al contenido solicitado; un ejemplo explícitamente hipotético no debe confundirse con un campo existente.

**Archivos principales:** contratos de `packages/shared`, catálogo Tool Harness, construcción de contexto y validación de artefactos.

**Salida verificable:** el plan de revisión usa el contrato real; un control con estados/campos inventados falla por causa concreta, mientras una propuesta claramente hipotética no recibe un falso rechazo.

**Estado 2026-09-17:** implementado. El contrato operativo toma estados de run/review/readiness desde tipos compartidos y las lecturas desde el catálogo Tool Harness. Builder recibe su hash, campos de `runs.read` y estados disponibles. Identificadores técnicos no listados se bloquean como afirmaciones de contrato; los precedidos por `proposed field/state` o `hypothetical field/state` se conservan como hipótesis. Falta contrastarlo contra una campaña real nueva.

### C4 — Evaluador de calidad y recibo de decisión

**Resultado:** un veredicto positivo solo existe cuando sus criterios tienen pruebas suficientes.

- Introducir una evaluación de calidad separada del resultado de ejecución y del review humano, con `verified`, `rejected` y `unverified` como estados propuestos.
- Vincular el recibo a hashes de objetivo, artefacto exacto, snapshots de evidencia, contrato operativo, rúbrica, configuración y evaluador. La revisión de cualquiera de ellos invalida su reutilización.
- Para cada criterio, registrar el método de comprobación y sus referencias: fragmento/posición del artefacto, campo de recibo o check estructural. El servidor resuelve y comprueba las referencias; una cita declarada por el modelo no se acepta sola.
- Separar existencia de una cita de su capacidad para sostener una afirmación. Usar comprobaciones deterministas para campos, valores, estructura y formatos conocidos; reservar juicio semántico para lo que realmente lo necesita.
- Sustituir el solapamiento de palabras como autoridad de aceptación. Puede quedar como señal diagnóstica, sin decidir calidad positiva.
- Para requisitos negativos, verificar la condición pertinente: p. ej. campos vacíos de una plantilla conocida. Ausencia de palabras como «crash» no demuestra ausencia de todas las afirmaciones falsas. Casos no decidibles quedan `unverified`.
- Si se usa un juez local 9B, ejecutarlo separado del Builder, con rúbrica, artefacto y evidencia, sin la conclusión previa de QA ni el objetivo de declarar mejora. Ejecutarlo serialmente. Usar el mismo modelo en otro rol no lo vuelve estadísticamente independiente: necesita calibración.
- Datos recuperados y artefactos se tratan como datos, incluso si contienen instrucciones para el evaluador. Rúbrica y resultados esperados quedan fuera del acceso de la variante y del modelo ejecutor.
- Mantener separados «calidad verificada», «listo para revisión» y «aprobado por el operador». Un resultado correcto no concede permiso para promover memoria o activar un bundle.

**Archivos principales:** nuevo servicio pequeño de calidad, `operator-goal-contract.ts`, integración en `skill-orchestration.service.ts`, tipos del Evaluation Ledger y pruebas.

**Salida verificable:** positivos y negativos conocidos reciben causas correctas; cambiar el artefacto o sustituir un recibo invalida el veredicto; un checklist PASS sin soporte no genera calidad verificada.

**Estado 2026-09-17:** implementado el recibo determinista inicial. Persiste hashes de objetivo, artefacto, contrato operativo y evidencia previa, con veredictos `verified`, `rejected` o `unverified`. Verifica plantillas vacías de estructura conocida y reportes con recibos disponibles; rechaza secciones/campos inventados y evidencia autorreferencial. Las familias que requieren juicio semántico permanecen `unverified`. No sustituye la calibración de C6 ni decide review humano.

### C5 — Reparación con progreso y visibilidad operativa

**Resultado:** recuperar fallos corregibles sin gastar varias inferencias en repetir la misma carencia.

- Clasificar primero la causa: adquisición faltante, estructura, contradicción factual, infracción del objetivo o incertidumbre del evaluador. Un fallo del evaluador no debe desencadenar automáticamente una reescritura del documento.
- Reparar con criterio, evidencia original, discrepancia exacta y versión del artefacto. No pedir a Builder que invente información que nunca recibió.
- Detectar repetición por causa + evidencia + artefacto. Sin nueva evidencia ni cambio sustantivo, detener el ciclo antes de consumir todos los intentos.
- Aplicar presupuesto acumulado de tiempo/tokens/llamadas además del límite por intento. Propuesta inicial para la campaña: 12 minutos por caso, una reparación dirigida por discrepancia con evidencia y sin repetirla si no hay progreso; congelar estos valores antes de medir.
- Mostrar en Runs/Review calidad, motivo, evidencia disponible/faltante, reparaciones y costo. Diferenciar incertidumbre, resultado incorrecto y decisión humana pendiente.
- Conservar la cadena frontend service → API hook → coordinador → componente; reutilizar la vista operatoria existente.

**Salida verificable:** un fallo de evidencia no produce tres reparaciones idénticas; un caso reparable se recupera con el recibo correcto; la interfaz explica el estado tras recargar/reiniciar.

**Estado 2026-09-17:** implementada la primera parada de progreso: una reparación semántica válida cuyo Requested Artifact tiene el mismo hash que el anterior detiene el loop y registra `repairStall` con ambos hashes. La vista de estado expone el recibo de calidad y el bloqueo de progreso, separado de la aprobación humana. Las campañas identificadas congelan 12 minutos de duración medida por caso y una reparación semántica; una violación queda durablemente en el journal y bloquea despachar casos posteriores. El endpoint de estado conserva ambos recibos tras la ejecución, cubierto por test. El límite por paso sigue siendo autoridad del API; tokens no se inventan como métrica hasta que el proveedor los confirme. Falta clasificación completa de causas y una comprobación operacional de reinicio real.

### C6 — Campañas reproducibles y calibración

**Resultado:** poder comparar una versión concreta y medir también los errores del evaluador.

- Ampliar el runner con campañas y variantes explícitas. Clave de ejecución: campaña + configuración + caso + repetición. Reanudar esa identidad sin duplicarla; repetir un caso en otra campaña sin editar su journal histórico.
- Registrar un manifiesto con revisión Git y hash del árbol relevante (hay cambios sin commit), prompts/configuración, modelo confirmado y digest disponible, rúbrica, casos y snapshots. Rechazar cambios de variante a mitad de campaña.
- Conservar la suite original y v1 como regresión. Terminar los cuatro casos v1 pendientes dentro de una campaña claramente identificada, sin mezclar sus cifras con las de versiones anteriores.
- Armar una calibración propuesta de 24 artefactos: 12 correctos y 12 incorrectos, distribuidos entre cuatro familias. Incluir plantillas vacías válidas, datos desconocidos legítimos, contradicciones de recibos, hechos inventados, fuentes irrelevantes y planes con capacidades inexistentes.
- Etiquetar por separado checks verificables por código, auditoría del agente y confirmación humana. El agente prepara el paquete; una revisión humana compacta resuelve solo los criterios subjetivos/disputados antes de congelarlos.
- Medir falsos positivos, falsos rechazos, abstenciones y cobertura por familia. Un evaluador que rechaza o abstiene todo no puede pasar calibración.
- Umbral inicial propuesto, fijado antes del ensayo: cero aceptaciones de los 12 negativos y al menos 11/12 positivos reconocidos; ningún error de autoridad, procedencia o permiso. Estos números son un criterio de salida de esta muestra pequeña, no una estimación de fiabilidad general.
- Preparar ocho casos nuevos, dos por familia, después de congelar implementación y rúbrica. Separar prompts del caso de criterios/respuestas privados; el sujeto ve solo la tarea y evidencia permitida. Si se inspeccionan resultados para ajustar, retirar esa tanda de la función de holdout.
- Evaluador y fixtures se ejecutan desde una ubicación que la variante no puede modificar ni recuperar. Una carpeta oculta y un hash en el mismo árbol no constituyen aislamiento suficiente para el futuro paso 8.
- Mantener Ollama serial y pausar la campaña ante trabajo del usuario. Los tests unitarios/CI siguen usando mocks; las campañas reales son explícitas y separadas.

**Salida verificable:** una campaña se reanuda sin duplicados, detecta cambios de versión, conserva evidencia completa y produce el mismo reporte a partir de sus recibos persistidos.

**Estado 2026-09-17:** el runner acepta `--campaign=ID --variant=ID` emparejados y escribe un journal independiente con manifest de modelo/configuración, presupuesto y fingerprint. Impide mezclar identidades en el mismo journal y conserva la compatibilidad con journals históricos. La decisión de los seis casos semánticos fue delegada explícitamente por el operador a Codex y se conserva como `delegated-agent-adjudication`, no como una etiqueta humana independiente. La suite `sealed-quality-v1` contiene ocho casos (dos por familia), hash inmutable, auditor protegido y journal con `--sealed=quality-v1`; después de su creación no se debe ajustar la variante usando sus prompts o rúbrica. Falta ejecutar esa campaña serial, analizar sus recibos y redactar C7.

### C7 — Cierre con evidencia y enlace a 5–8

**Resultado:** un reporte de salida que indique qué está probado y qué sigue limitado.

Para cerrar los pasos 1–4 deben cumplirse todos estos puntos:

1. Los falsos positivos históricos se detectan con razones específicas; las muestras legítimamente vacías no fallan solo por el vocabulario de QA.
2. La comparación de dos runs usa evidencia real en Builder y la conserva durante reparación/reinicio; el acceso denegado y los campos ausentes se representan correctamente.
3. No se acepta como existente ningún campo/estado sin contrato que lo respalde en el conjunto evaluado.
4. La calibración de C6 pasa, con etiquetas y autoría explícitas.
5. En la tanda nueva: integridad de evidencia 8/8, cero aceptación de errores críticos, al menos 7/8 artefactos sustantivamente correctos y al menos uno en cada familia. El caso restante, si lo hay, debe abstenerse por una razón verificada. No contar abstención como artefacto exitoso.
6. Repetir un caso de comparación y uno documental sin contradicciones factuales; verificar interrupción/reanudación con mocks y una comprobación operativa acotada.
7. Presupuesto, trazabilidad y frontera de review se cumplen; pruebas relevantes, types y build pasan. El reporte separa calidad, abstenciones, costo y corrección del evaluador.

Si una tanda falla, se registra como diagnóstico y se corrige la clase de fallo antes de reservar una nueva. No ajustar umbrales, borrar fallos o cambiar casos para aprobar la misma tanda.

Al cerrar:

- **Paso 5:** registrar lecciones con recibos de calidad, contradicciones y caducidad; las conclusiones generadas continúan como contexto hasta su promoción válida.
- **Paso 6:** automatizar experimentos usando campañas y evaluación ya verificadas, con una hipótesis/configuración por experimento.
- **Paso 7:** conectar evidencia de mejora a las autorizaciones duraderas, canary y rollback existentes. La aceptación de este plan no autoriza por sí sola una adopción futura.
- **Paso 8:** reutilizar el evaluador protegido fuera del árbol editable de código; preparar cambios revisables y conservar la frontera de integración humana.

La parte humana queda concentrada en calibración semántica inicial, excepciones y autorizaciones finales. Adquisición de evidencia, validación, reparación acotada, campañas y reportes se automatizan.

## Handoff y alcance de esta sesión

Primer trabajo de implementación: C1, con los casos de contrato y medición definidos antes de seguir ajustando prompts. Después C2–C3, C4, C5, C6 y C7. No lanzar otra batería costosa antes de que C1–C5 tengan pruebas de comportamiento y presupuesto.

Esta sesión solo crea el plan y su registro documental. No cambia servicios, prompts, tests, permisos, configuración, revisiones, modelos ni estado de los runs; tampoco ejecuta campañas o publica cambios.
