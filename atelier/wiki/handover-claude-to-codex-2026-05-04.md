# Handover: Claude → Codex
**Fecha:** 2026-05-04  
**Sesión:** Pixel-agents integration + UI/UX overhaul + Mobile + Orchestration  
**Estado:** Todos los cambios están en working tree (sin commit). Tests 3/3 pasan. TypeScript sin errores.

---

## Contexto de la sesión

Esta sesión partió de un dashboard funcional básico (light theme) y llegó a una aplicación con dark theme completo, vista de oficina pixel art con sprites reales del VS Code extension pixel-agents, movimiento animado de personajes, orquestación simulada de agentes, y vista móvil responsive.

---

## Cambios por área

### 1. Shared types (`packages/shared/src/types/agent.ts`)
- Añadido `"designer"` al array `AGENT_ROLES`.
- Ahora hay 6 roles: `intake | wiki-curator | pm | builder | qa | designer`.
- El modelo Mongoose en `apps/api/src/db/models/Agent.ts` usa este array como enum → acepta automáticamente el nuevo rol.

---

### 2. Dark theme global (`apps/web/src/styles.css`)
Reescritura completa del CSS. El archivo anterior (~400 líneas) creció a ~1400 líneas.

**Tokens CSS (`:root`):**
```
--bg-base: #0b0c16         (fondo principal)
--bg-sidebar: #07080e      (sidebar)
--bg-card: rgba(255,255,255,0.035)
--accent-purple: #7c5cfc   (acento primario)
--accent-teal: #1de5b5     (acento secundario / active)
--accent-orange: #f97316   (blocked/warning)
--text-primary: #e8eaf0
--text-secondary: #8b8fa8
--text-tertiary: #4b4f6b
--sidebar-w: 64px
--header-h: 48px
```

**Layout del shell (`.app-root`):**
- CSS Grid: `64px sidebar + 1fr content`, `48px header + 1fr main`
- Sidebar izquierdo con nav OF/DB + roster de avatares de agentes

**Nuevas clases relevantes:**
- `.app-root`, `.app-header`, `.app-sidebar`, `.app-main`
- `.sidebar-nav-item`, `.sidebar-nav-item--active`, `.roster-avatar`, `.roster-avatar-dot`
- `.office-full`, `.office-canvas-container`, `.office-canvas-scroll`
- `.agent-float-panel`, `.agent-float-panel--left/right` (paneles flotantes)
- `.office-bottom-bar`, `.obb-item`, `.obb-item--gas`
- `.mobile-shell`, `.mobile-agents-grid`, `.mobile-agent-card`, `.mobile-nav` (toda la suite mobile)

---

### 3. App shell architecture (`apps/web/src/app/`)

**Archivos nuevos:**

#### `AppShell.tsx`
- Layout principal con header + sidebar + vista condicional.
- `view: 'dashboard' | 'office'` — default `'dashboard'` (necesario para tests).
- Hook `useIsMobile()` detecta viewport < 768px y renderiza `MobileView` en su lugar.
- **No usar CSS toggle** entre vistas — renderiza condicionalmente `<OfficeView>` o `<Dashboard>`.

#### `Sidebar.tsx`
- Sidebar izquierdo de 64px.
- Nav buttons OF/DB con estado activo.
- Contador de agentes.
- Roster de avatares (primeras 8) con dot de status.

#### `MobileView.tsx`
- Se renderiza en viewports < 768px (teléfono).
- 3 tabs: **Agentes** (grid 2 columnas con emoji + status), **Actividad** (lista estilo imagen de referencia), **Config** (pares clave/valor).
- Bottom nav: 🤖 Agentes / ⚡ Actividad / ⚙️ Config.
- Emojis por rol: `intake=🧙`, `wiki-curator=📚`, `pm=🔮`, `builder=💻`, `qa=🔍`, `designer=🎨`.
- Los status se muestran en español con colores: teal=activo, purple=pensando/revisando, naranja=bloqueado.

---

### 4. Feature: pixel-office (`apps/web/src/features/pixel-office/`)

Esta feature es **enteramente nueva** en esta sesión.

#### `engine/types.ts`
```typescript
type PixelCharacter = {
  id, name, role, status, state: 'idle'|'working'|'blocked'|'done',
  deskX, deskY,         // posición del seat (destino home)
  currentX, currentY,   // posición animada actual
  targetX, targetY,     // destino de movimiento
  direction: 'down'|'up'|'right'|'left',
  isMoving: boolean,
  frame: number
}
```

#### `engine/sprites.ts`
- Caché de `HTMLImageElement` para sprites.
- `loadSprite(src)` retorna imagen cacheada (la carga si no está).
- `ROLE_CHAR_SPRITE`: mapa rol → ruta PNG del sprite (char_0–char_5).
- `preloadOfficeSprites()`: precarga todos los sprites al montar el canvas.

#### `engine/renderer.ts`
- Canvas fijo **640×640px** (`MAP_W/H`), escala 2x (`SCALE=2`, `TILE=16`, `DTILE=32`).
- 4 habitaciones de 320×320 en grid 2×2:
  - Room 1 (top-left): suelo madera (floor_2), escritorios, PCs, libreros → builders/pm
  - Room 2 (top-right): suelo verde (floor_3), sofá, whiteboard, plantas → designers
  - Room 3 (bottom-left): suelo ladrillo (floor_5), lounge con sofá y mesa → intake/wiki-curator
  - Room 4 (bottom-right): suelo gris (floor_0), cactus, reloj, papelera → qa/overflow
- Sprites de muebles a 2x desde `/sprites/furniture/`.
- `SEATS[]`: 11 posiciones globales distribuidas entre rooms.
- `drawCharacterSprite()`: usa sprite sheet (7 frames × 3 filas = down/up/right), anima frames cuando `isMoving` o `state=working`, espeja horizontalmente para `direction=left`.
- `drawCharacterLabel()` y `drawStatusBubble()` usan `currentX/Y`.
- Exporta `SEATS`, `SCALE`, `TILE`, `MAP_W`, `MAP_H`.

#### `hooks/usePixelOffice.ts`
- `agentsToPixelCharacters(agents, prev?)`: asigna agents a seats por `ROLE_SEAT_PRIORITY`.
- Preserva `currentX/Y/direction/isMoving` del estado previo para movimiento suave.
- Priority: builder/pm→room1, designer→room2, intake/wiki-curator→room3, qa→room4.

#### `hooks/useOrchestrationSim.ts`
- Simulación automática de orquestación.
- Cada 15s lanza una cadena de 2–3 agentes idle.
- Cada agente activa un status aleatorio (executing/thinking/planning/writing/reviewing/reading) durante 3–8s, luego vuelve a idle.
- Llama `useUpdateAgentStatusApi` → actualiza MongoDB → dispara re-render en todas las vistas.
- Acepta `enabled: boolean` para pausar/reanudar.
- **Importante:** los timers se rastrean en un `Set<ReturnType<setTimeout>>` y se limpian al desmontar.

#### `PixelOfficeCanvas.tsx`
- `charsRef`: ref mutable que preserva estado de movimiento entre re-renders de React.
- El RAF loop actualiza `currentX/Y` hacia `targetX/Y` a 1.2px/frame.
- Wander: agentes idle oscilan con `sin/cos` dentro de su habitación.
- Click detection: hitbox generoso (±30px centrado en `currentX/Y`).
- Try/catch en `canvas.getContext("2d")` — JSDOM lanza en lugar de retornar null.

#### `OfficeView.tsx`
- Full-width layout sin sidebar derecho.
- `orchestrationEnabled` state (default true) conectado a `useOrchestrationSim`.
- Hasta 2 paneles flotantes simultáneos (click en personaje → panel izquierdo/derecho).
- Bottom bar: **⚡ ORQUESTACIÓN** toggle, formulario de creación de agente, + botones Layout/Dashboard/GRAFO/Settings.

#### `AgentDetailPanel.tsx`
- Panel flotante glass card con `position: absolute`.
- `side: 'left' | 'right'` controla posición.
- Send button llama `useUpdateAgentStatusApi` → status `executing` → después de 4s vuelve a `idle`.
- Progress bar y activity text reflejan el status real del agente.

#### `PixelOfficePanel.tsx`
- Archivo legacy, se mantiene pero ya no se usa en el dashboard principal. OfficeView es el reemplazo.

---

### 5. Assets de pixel-agents (`apps/web/public/sprites/`)

Copiados desde la extensión de VS Code instalada en:
`~/.vscode/extensions/pablodelucca.pixel-agents-1.3.0/dist/assets/`

```
public/sprites/
  characters/char_0.png – char_5.png  (112×96 sprite sheets, 7 frames × 3 rows)
  floors/floor_0.png – floor_8.png    (16×16 tiles)
  walls/wall_0.png
  furniture/
    DESK_FRONT.png (48×32)
    PC_FRONT_ON_1.png, PC_FRONT_ON_2.png (16×32)
    PLANT.png, PLANT_2.png, LARGE_PLANT.png (16×32, 32×48)
    SOFA_BACK.png, SOFA_FRONT.png, SOFA_SIDE.png (32×16)
    BOOKSHELF.png, DOUBLE_BOOKSHELF.png (32×16)
    WHITEBOARD.png (32×32)
    COFFEE_TABLE.png (32×32)
    CUSHIONED_BENCH.png, CUSHIONED_CHAIR_BACK/FRONT.png (16×16)
    CACTUS.png, CLOCK.png (16×32)
    SMALL_PAINTING.png, SMALL_TABLE_FRONT.png (16×32)
    BIN.png (16×16)
    WOODEN_CHAIR_BACK/FRONT.png (16×32)
    COFFEE.png (16×16)
```

**Formato sprite de personaje:**
- 7 columnas × 3 filas → cada frame es 16×32 nativo → 32×64 a 2x
- Fila 0: walking down, Fila 1: walking up, Fila 2: walking right (izquierda = row2 espejada)

---

### 6. Dashboard (`apps/web/src/features/dashboard/Dashboard.tsx`)
- Eliminado el wrapper `<main class="app-shell">` (AppShell maneja el layout).
- Clases actualizadas: `dashboard-content`, `dashboard-topbar`, `dashboard-title`.
- La `PixelOfficePanel` fue eliminada del grid del dashboard.

### 7. AgentsPanel (`apps/web/src/features/agents/components/AgentsPanel.tsx`)
- Formulario de creación con campo nombre + selector de rol (incluye `designer`).
- El selector de rol viene de `AGENT_ROLES` del shared package.

---

## Pitfalls importantes para Codex

1. **Tests**: `findByText("Builder Agent")` solo funciona si `Dashboard` está en el DOM activo. El default view en `AppShell` debe ser `'dashboard'`, no `'office'`.

2. **Canvas en JSDOM**: `canvas.getContext("2d")` **lanza un error** en JSDOM (no retorna null). Siempre usar try/catch en `PixelOfficeCanvas.useEffect`.

3. **charsRef vs characters prop**: El movimiento se maneja en `charsRef` (ref mutable). No uses la prop `characters` directamente en el RAF loop — usa `charsRef.current`.

4. **Sprites path**: Los sprites están en `public/sprites/` → se sirven como `/sprites/...` en el browser. Deben tener la ruta `/sprites/` con la barra inicial.

5. **SEATS exportado**: `usePixelOffice.ts` importa `SEATS` desde `engine/renderer.ts`. Si se mueve la definición, actualizar el import.

6. **Mobile breakpoint**: `useIsMobile()` usa `window.innerWidth < 768`. En SSR esto explotaría, pero Vite/CSR está bien.

7. **Timers en useOrchestrationSim**: Limpiar TODOS los timers en el cleanup del useEffect. Si no, hay memory leaks y llamadas API después de desmontar.

---

## Estado de tests

```
pnpm test:web → 3/3 pasan (render, create task, append log)
pnpm typecheck → 0 errores
```

---

## Próximos pasos sugeridos

1. **Commit y PR** de todos estos cambios (branching desde `main`).
2. **Orquestación real con LLM**: conectar el Send button del AgentDetailPanel a la Anthropic API → el agente realmente ejecuta la instrucción.
3. **Movimiento entre habitaciones**: cuando un agente hace handoff a otro, el personaje camina físicamente de una habitación a otra (pathfinding cross-room).
4. **Chat persistente**: historial de mensajes por agente guardado en MongoDB (nueva colección `messages`).
5. **GRAFO view**: implementar la vista de knowledge graph (D3 o similar) accesible desde el bottom bar.
6. **Sprites personalizados**: cada agente puede tener un sprite asignado (actualmente todos los builders usan char_3).
7. **Notificaciones móviles**: cuando un agente cambia a `blocked` o `needs-human`, mostrar badge en el bottom nav de la vista móvil.
8. **Wiki integration**: WikiPanel debería reflejar las instrucciones enviadas a cada agente.

---

## Comandos para retomar

```bash
# Verificar estado
pnpm typecheck && pnpm test

# Desarrollo sin MongoDB
pnpm --filter @atellier/api dev:memory &
pnpm --filter @atellier/web dev

# Con MongoDB
colima start
docker compose up -d mongo
pnpm dev
```

---

*Generado por Claude Code — 2026-05-04*
