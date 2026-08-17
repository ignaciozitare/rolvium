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
> Pending — DBA. Propuesta: `characters` (id, campaign_id, owner_id nullable, name, concept, avatar_url, token_url,
> color, data jsonb, derived jsonb, hp/health materializadas para la mesa, xp, created/updated);
> `character_audit` (character_id, campaign_id, author_id, field, before, after, origin sheet|roll|damage|progression|dm, at)
> escrita por trigger; buckets `avatars`, `tokens`.
