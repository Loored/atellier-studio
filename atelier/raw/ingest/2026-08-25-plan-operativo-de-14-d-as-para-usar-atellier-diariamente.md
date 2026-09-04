# Plan operativo de 14 días para usar Atellier diariamente

- Captured at: 2026-08-25T22:21:13.840Z
- Source type: decision

## Content

Necesitamos convertir Atellier Studio en una herramienta de uso diario y dejar de evaluar sus capacidades únicamente mediante pruebas sintéticas.

Objetivo:
Diseñar un plan operativo de 14 días que use el flujo completo de Atellier con trabajo real:

fuente → Wiki → tarea → run durable → entregable → QA → review → memoria → aprendizaje

El plan debe:

- Proponer una actividad concreta para cada día.
- Alternar trabajo del propio proyecto Atellier con trabajo personal o de cliente.
- Definir qué evidencia debe conservarse en cada ejecución.
- Incluir al menos una ejecución interrumpida y recuperada.
- Incluir una revisión aprobada y una con cambios solicitados.
- Capturar únicamente aprendizajes reutilizables en role memory.
- Resolver explícitamente cualquier signal generado.
- Registrar fricciones observadas sin convertir inmediatamente cada fricción en una feature.
- Terminar con una revisión de evidencia y una recomendación priorizada para el siguiente desarrollo.

Entregable esperado:
Un plan de 14 días organizado por día, con objetivo, actividad, evidencia esperada, criterio de éxito y decisión de cierre.

Criterios de aceptación:

1. El plan debe ser ejecutable con las capacidades actuales del repositorio.
2. No debe proponer auth, cloud, multiplayer, pixel polish ni nuevas integraciones.
3. Cada actividad debe ser pequeña y verificable.
4. Debe distinguir entre evidencia local temporal y memoria durable.
5. Debe incluir puntos explícitos de aprobación humana.
6. La recomendación final debe depender de fricciones repetidas, no de ideas especulativas.

Restricciones:
Atellier es privado, local-first y orientado al trabajo real. Mongo es estado operativo y Markdown Wiki es memoria durable. No se deben realizar llamadas a servicios externos ni introducir autonomía sin supervisión.
