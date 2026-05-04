# Sugerencias de producto — Atellier Studio
**Fecha:** 2026-05-04  
**Contexto:** Evaluación post-sesión de Claude Code

---

## Veredicto general

Para una herramienta local-first de orquestación de agentes con UI propia, Atellier Studio está entre los proyectos más completos y cuidados en este espacio. El problema que resuelve es real, el execution es disciplinado, y tiene una identidad visual propia que lo distingue. Eso es raro.

La arquitectura base (monorepo con shared types, servicio → hook → componente, wiki markdown como memoria durable) es sólida y ya paga dividendos: añadir un nuevo rol de agente propagó el cambio desde validación de API hasta la UI automáticamente.

---

## Riesgo principal

**La orquestación es todavía teatral.**

Los agentes parecen trabajar — caminan, cambian de status, se "pasan" tareas — pero no hacen nada real. Eso está bien para demostrar el concepto y diseñar la UX. El siguiente riesgo crítico es conectar LLMs reales sin que el costo, la latencia y el manejo de errores rompan la experiencia que ya construyeron.

El salto de simulación → ejecución real es el momento donde la mayoría de proyectos como este se rompen o se complican demasiado.

---

## Sugerencias técnicas (prioridad alta)

### 1. Orquestación real con LLM
Conectar el Send button del `AgentDetailPanel` a la Anthropic API. El agente recibe la instrucción, la procesa, y actualiza su status basado en el resultado real.

**Cómo:** Crear un endpoint `POST /agents/:id/run` en la API de Fastify que:
- Acepta `{ instruction: string, context?: string }`
- Llama a Anthropic API con el rol y descripción del agente como system prompt
- Transmite la respuesta (streaming) al frontend via SSE o polling
- Actualiza el status del agente durante la ejecución

**Por qué primero:** Todo lo demás depende de esto. Sin ejecución real, el resto es decoración.

### 2. Handoff real entre agentes
Cuando un agente termina su tarea, puede "pasar el trabajo" a otro agente con contexto acumulado. 

**Cómo:** Añadir `handoffAgentId` y `handoffContext` al tipo `Run`. El agente receptor recibe el contexto del anterior como parte de su prompt.

**Por qué:** Es el core de la propuesta de valor — un swarm coordinado, no agentes aislados.

### 3. Chat persistente por agente
Historial de mensajes guardado en MongoDB (nueva colección `messages`).

**Cómo:** `{ agentId, role: 'user'|'assistant', content, timestamp, runId? }`

**Por qué:** Actualmente el chat en el panel flotante es stateless — se pierde al cerrar.

---

## Sugerencias UX (prioridad media)

### 4. Instrucciones de rol (system prompts editables)
Cada agente debería tener un "system prompt" que defina su personalidad, especialización y restricciones. Editable desde el panel de agente.

**Cómo:** Añadir campo `instructions: string` al modelo `Agent` en MongoDB. El panel flotante muestra un textarea editable.

**Por qué:** Diferencia un agente genérico de uno especializado. Es lo que hace que "designer" se comporte diferente a "builder".

### 5. GRAFO / Knowledge graph view
La vista GRAFO del bottom bar existe como botón pero no tiene implementación. Un grafo de nodos (agentes, tareas, runs, documentos wiki) visualizaría la red de conocimiento operacional.

**Cómo:** D3.js o Cytoscape.js con datos de la API. Nodos: agentes + tareas + runs. Edges: asignaciones y handoffs.

**Por qué:** Es el "cerebro visible" del swarm — útil para debugging de orquestaciones complejas.

### 6. Notificaciones cuando agente necesita input
Cuando un agente entra en estado `needs-human`, debería haber una señal visual prominente — badge en el bottom nav de mobile, destello en el personaje pixel art, notificación del sistema.

**Cómo:** `status === 'needs-human'` ya existe. Solo hay que conectar a `Notification API` del browser.

**Por qué:** Sin esto, el usuario puede perderse que un agente está bloqueado esperando su respuesta.

### 7. Sprites personalizados por agente
Actualmente todos los agentes con rol "builder" tienen el mismo sprite. Cada agente debería poder tener un sprite asignado.

**Cómo:** Campo `avatar.sprite: '0'|'1'|...'5'` ya existe en el tipo `Agent`. El renderer debería usarlo en lugar de mapear por rol.

**Por qué:** Cuando hay 5 builders en la oficina y todos se ven iguales, pierdes identidad individual.

---

## Sugerencias de infraestructura (prioridad baja pero importante)

### 8. Modo sin MongoDB para demos
`API_STORAGE=memory` ya existe pero la data se pierde al reiniciar. Añadir un modo "seed" que cargue agentes de demo al arrancar en memoria.

**Por qué:** Para demos o primeras instalaciones sin Docker/Colima.

### 9. Health check robusto
El endpoint `/health` existe pero solo responde `{ status: 'ok' }`. Añadir estado de MongoDB, memoria usada, número de agentes activos.

**Por qué:** Útil para el panel Dashboard y para diagnosticar problemas locales.

### 10. Logs de orquestación visibles
Los runs ya tienen `logs: RunLogEntry[]`. Cuando un agente real ejecuta una instrucción, cada paso debería añadir un log. El timeline de runs debería mostrar esto en tiempo real.

**Por qué:** La trazabilidad es lo que diferencia una herramienta profesional de un juguete.

---

## Reflexión final

El mayor activo de Atellier Studio no es el código — es la coherencia de la visión. Hay una dirección clara: herramienta local-first, durable, con agentes que realmente trabajan, visible en tiempo real a través del pixel office.

La trampa a evitar: añadir features de demo antes de que la orquestación sea real. La simulación actual es útil para diseñar la UX, pero no para validar si el producto funciona.

La próxima sesión de trabajo debería enfocarse en un solo agente real que reciba una instrucción, la ejecute con Claude, y actualice su estado en la UI. Todo lo demás puede esperar.

---

*Generado por Claude Code — 2026-05-04*
