# Game System port (`packages/core`) — SPEC

## Purpose
Un **sistema de juego** (Plenilunio hoy; Cyberpunk, D&D 5e mañana) es un paquete enchufable. La plataforma
no conoce ninguna regla: solo pide cosas a un objeto que implementa el puerto `GameSystem`. Así una campaña
de Plenilunio y una de D&D usan la misma mesa, el mismo chat, el mismo mapa y las mismas tablas.
Who: lo consumen `campaigns`, `table`, `characters`, `bestiary`, `dice`; lo implementan `packages/system-*`.

## Contract (`packages/core/src/gameSystem.ts`)
```ts
interface GameSystem {
  id: string;            // 'plenilunio'
  version: string;       // semver del paquete; la campaña queda anclada a él
  name: I18nKey;         // nombre mostrado (clave i18n del paquete)
  locales: Record<Locale, Messages>;   // el paquete trae sus propios textos (es, en…)

  sheetSchema: SheetSchema;            // campos de la ficha y su agrupación (secciones, tipos, límites)
  catalogs: Catalogs;                  // armas, armaduras, equipo, dones, especialidades, bestiario base
  references: Record<RuleKey, { page: number; title: I18nKey; summary: I18nKey }>; // tooltips + página del manual
  theme: VisualTheme;                  // CSS vars (--sys-*), fuentes, imagen de fondo, iconografía

  engine: {
    derived(sheet): Derived;                          // p.ej. Aguante, Resistencia, Fortuna máx
    poolFor(sheet, action): RollRequest;              // cuántos dados / de qué tipo / opciones
    resolve(request, dice): RollResult;               // resolución completa (grado, revés, efectos)
    applyDamage(sheet, damage): SheetPatch;
    progression: ProgressionRules;                    // costes y límites de mejora
    sharedResources?: SharedResourceDef[];            // p.ej. la reserva de Destino
    actions?: ActionDef[];                            // acciones con icono: atacar con arma, activar don…
  };

  generator: GeneratorStep[];          // asistente de creación declarado en datos
}
```
- `RollRequest/RollResult` viajan a `dice` (H6). `dice` genera los dados y llama a `engine.resolve` **en el servidor**.
- `SharedResourceDef` = `{ id, label, max, initial, whoCanTake: 'player'|'dm'|'all', whoCanReset: 'dm', perTakeMax, blockedIf?(sheet) }`.
- `ActionDef` = `{ id, icon, label, appliesTo, appliesToRow?(row), cost?, spend?(sheet, itemId), toRoll?(sheet, target, options) }`.
  - **`toRoll` es OPCIONAL**: hay acciones que sólo GASTAN y no tiran dados — recargar mueve balas de la munición
    al cargador y no lanza nada.
  - **`spend`** devuelve el patch que la acción cuesta en la ficha, o `null` si ahora mismo no se puede pagar; `null`
    apaga el botón. Existe por la munición: sin balas no se dispara, y un botón vetado tiene que VERSE vetado.
  - **`appliesToRow`** decide si la acción aplica a ESA fila. Un arma cuerpo a cuerpo no ofrece «Disparar».
- `FieldDef` (un campo de la ficha) admite además:
  - `appliesToRow?(row)` — sólo columnas de tabla: si la columna aplica a esa fila (un arma c/c no lleva cargador).
  - `options[].hint?` — dato secundario de una opción, que la ficha saca en un TOOLTIP y no en la celda (el alcance
    se lee «Medio» y los metros con la dificultad se consultan por encima).
  - `note?(sheet)` — sólo campos `health`: aviso calculado que la ficha pinta bajo el campo, en rojo. Lo declara el
    sistema porque la plataforma no sabe qué condición avisa (en Plenilunio, «Inconsciente»).
  - `hidden?` — el campo existe en el esquema (se guarda y se valida) pero NO se pinta. Para valores que escribe el
    motor y no se eligen a mano. Ojo: `derived` no sirve para eso — un derivado no se guarda, y `validateSheet`
    rechaza como `unknown` toda clave que el esquema no declare.
- `SectionDef.span` — cuánto ocupa la sección en la rejilla de SEIS de la ficha (6 = fila entera, 3 = media,
  2 = un tercio). Lo declara el sistema: la plataforma no sabe que «Estado» pide más sitio que «Dones».
- `VisualTheme` se aplica como variables CSS **en el contenedor de la mesa** (`.rv-table[data-system=...]`), nunca con condicionales en componentes.

## Rules & limits
- Un sistema no importa nada de la plataforma salvo `packages/core`. La plataforma no importa nada de `packages/system-*` salvo por el registro de sistemas (`systems/registry.ts`).
- Cambiar de sistema en una campaña existente no está permitido; se crea otra.
- Todo texto visible del sistema es clave i18n del paquete; los resúmenes de reglas son texto propio (no transcripción del manual); la página remite al ejemplar de cada mesa.
- Aviso: el puerto solo se considera bien diseñado cuando hay dos sistemas dentro. Antes de cerrar la interfaz se esboza el segundo (Cyberpunk o D&D) en papel.

## Página `/systems`
Catálogo para el usuario: sistemas instalados (nombre, editor, versión, qué incluye según el paquete cargado, referencia al
manual) y próximos. Sólo lectura; «Crear campaña con …» lleva al alta de campaña.

## Connections
`campaigns` (elige sistema), `characters` (schema, derived, generator, progression, actions), `bestiary` (catalogs.bestiary),
`dice` (poolFor/resolve), `table` (theme, sharedResources).

## Modelo de datos
Sin tablas propias. `campaigns.system_id` + `system_version` anclan el paquete. Los datos de ficha van en `jsonb`
validados contra `sheetSchema` en la API.
