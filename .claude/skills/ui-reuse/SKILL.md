---
name: ui-reuse
description: Reglas obligatorias antes de crear o modificar CUALQUIER elemento visual en apps/web (componente, modal, diálogo, botón, card, chip, badge, picker, dropdown, tabla, vista, drawer, tooltip, avatar, timeline). Se dispara al construir o editar UI para evitar reinventar lo que ya existe en @rolvium/ui.
---

# Reutilización de UI (antes de escribir cualquier componente)

Rolvium tiene una librería de componentes en `@rolvium/ui`. El error
recurrente es reinventar localmente algo que ya existe (un modal a mano cuando
hay `Modal`, un botón con estilos inline cuando hay `Btn`). Esta skill lo corta.

## 1. Inspeccioná ANTES de crear

1. Leé **`packages/ui/CATALOG.md`** — es el índice conciso de los componentes
   de `@rolvium/ui` (más barato que `UIKit.tsx`). Es la primera parada, siempre.
2. Buscá también en el módulo destino y en `apps/web/src/shared/ui/` si ya
   existe un patrón local que encaje.
3. Mirá quién consume el componente que vas a tocar, para no romper su contrato.

## 2. Declará tu decisión (obligatorio en el reporte final)

Antes de escribir, elegí UNA y decila explícitamente en tu resumen:

- **REUSE** — un componente del catálogo ya resuelve la necesidad. Importalo.
- **EXTEND** — casi encaja; agregá una prop/variante **retrocompatible** al
  componente compartido (no una copia).
- **NEW (module-specific)** — el comportamiento es propio del módulo y no
  pertenece a la librería compartida. Justificá por qué nada del catálogo sirve.
- **NEW (shared)** — no existe y hay una necesidad compartida real. Creá en
  `packages/ui`, exportalo, y añadilo al UIKit (`apps/web/src/shared/ui/UIKit.tsx`)
  y al catálogo (`npm run ui:catalog`, que regenera `packages/ui/CATALOG.md`).

Si dudás entre REUSE y NEW → es REUSE. Reinventar es el fallo por defecto.

## 3. Prohibido sin aprobación explícita del usuario

- Reemplazar un componente que funciona en un módulo solo porque hay algo
  parecido en otro lado.
- Migrar consumidores no relacionados a un componente compartido "de paso".
- Convertir un ejemplo (una tabla, un datepicker, un board) en un caso especial:
  las reglas son generales, no por-componente.

## 4. Recordá las reglas de la casa

- UI nunca importa de `/infra/` ni hace I/O directo (usá `container.ts`).
- Texto visible siempre con `t()` de `@rolvium/i18n`.
- Colores/tamaños con CSS vars (`var(--...)`), nunca hex/px crudos — los
  valores viven solo en `apps/web/src/RolviumApp.css`.
- Iconos: Material Symbols Outlined. Nunca emojis.
- El archivo que toques necesita al menos un test que lo ejercite.

## 5. Verificación

Corré `npm run audit` — el check de "UI duplication" reporta modales/botones/cards
locales y el % de adopción de `@rolvium/ui`. El usuario lo usa para confirmar
que no duplicaste. El hook `check-ui-dup.mjs` (PostToolUse, solo avisa) marca
overlays y botones locales al escribirlos.
