# Characters (H4) — SPEC
> Solo **personajes jugadores**. PNJ, monstruos y encuentros → `bestiary`.

## Purpose
Que cada jugador tenga su ficha viva en la mesa, creada con el generador del sistema, con tiradas y acciones a un
clic, progresión controlada por el director y auditoría de cambios. Who: jugador (la suya), director (todas, PJ o
PNJ; puede asignarlas o dejarlas sin dueño).

## What the user can do
- **Ficha** renderizada desde `sheetSchema` (un solo componente `<Sheet>` para todos los sistemas): identidad
  (nombre, jugador, concepto, **avatar propio**; si no tiene, el de la cuenta; si no, iniciales+color), bloque de
  tirada (dificultad, especialidad, armadura, extra), características con **TIRAR n**, estado (derivadas, casillas,
  niveles de salud, recursos, experiencia, recibir daño), armadura, **armas con icono de ataque** (⚔ cuerpo a cuerpo /
  ◎ distancia, munición y recarga), dones/habilidades **con icono de activar** (⚡, coste), equipo, historia.
- **Tooltips**: cada rótulo mecánico (características, dones, estados, armaduras…) muestra explicación breve +
  "Manual · p.XX" (referencias del sistema).
- **Generador** (pasos del sistema): concepto → características (economía de puntos, presets 16/21/25/30) →
  especialidades → Destino → dones → resumen. Director: tipo PJ/PNJ y "asignar a" (sin asignar = cualquiera lo toma).
- **Mejorar** (progresión): costes del sistema; **habilitada/bloqueada por el director** (bloqueada muestra el motivo).
- **Mis personajes** (`/characters`): todas mis fichas entre campañas, filtros, *Abrir en la mesa* / *Ver ficha*,
  borradores sin campaña, importar ficha (fuera v1).
- Ventana aparte de la ficha; el director abre fichas ajenas en modo lectura y puede ponerlas en edición.

## Flows
1. Jugador nuevo → generador → ficha creada → tokens/avatares listos → aparece en "El grupo".
2. TIRAR → `dice` con `RollRequest` del sistema → resultado en Registro y (si aplica) cambios de ficha (sube Destino, Fortuna…).
3. Recibir daño → `engine.applyDamage` → casillas + nivel de salud → auditoría (`origen: dano`).
4. Cambio cualquiera en la ficha → trigger escribe `character_audit` (quién, qué, antes/después, origen).

## Rules & limits
- La ficha se valida contra `sheetSchema` en la API; nada de reglas en el cliente más allá de la vista previa.
- Progresión deshabilitada por defecto; solo el DJ la abre/cierra por campaña.
- Un jugador solo edita su ficha; el DJ cualquiera de su campaña. Auditoría legible solo por el DJ.
- Avatar/token: subida a Storage con límite y recorte; PNG con transparencia recomendado para tokens.

## Connections
`game-system` (schema, engine, generator, progression, actions, references), `dice`, `identity` (avatar fallback),
`bestiary` (mismo `<Sheet>` y generador para PNJ), `maps` (token del personaje), `realtime`, `table`.

## Modelo de datos
- **`characters`**: un registro por personaje de una campaña. Campos: campaña, dueño (`owner_id`, vacío = «sin asignar»,
  cualquier miembro puede reclamarlo con `characters_claim`), tipo `pc`/`npc` (los PNJ los ve sólo el director), nombre,
  concepto, avatar y token propios, color, `data` (la ficha, jsonb según el `sheetSchema` del sistema de la campaña;
  validada en la API), `derived` (caché del motor), `health` y `xp` materializados para la mesa, archivado, autor, fechas.
  Acceso: leen los miembros de la campaña (PJ) y el director (todo); crea un miembro su propio PJ o el director cualquiera;
  edita el dueño o el director; borra sólo el director. Un jugador no puede cambiar campaña/tipo/dueño/archivo ni tocar
  `xp` si el director no tiene la progresión abierta (`campaigns.progression_enabled`). Al crear, la fila del miembro se
  enlaza (`campaigns_members.character_id`, FK ahora real).
- **`characters_audit`**: escrita sólo por trigger (creación, cada clave de `data` que cambia con antes/después, nombre,
  dueño, xp, salud), con autor y origen (`sheet`|`roll`|`damage`|`progression`|`dm`|`system`; el escritor lo indica con
  `set_config('rolvium.audit_origin', …)`). Sólo la lee el director de la campaña; nadie escribe directamente.
- **Bucket `tokens`**: como `avatars` (público de lectura, escritura en `{uid}/`, 2 MB, imágenes).
- Migración: `supabase/migrations/20260818100000_characters.sql`.
