# Campaigns (H2) — SPEC

## Purpose
Un grupo se organiza en campañas: el director crea una, elige el sistema, invita jugadores y abre la mesa.
Who: crear → `game_master`/`admin`; unirse → cualquier usuario.

## What the user can do
- **Home `/campaigns`**: "Mis campañas" (sistema, nombre, director, mi personaje, última sesión, próxima sesión,
  *Entrar a la mesa* / *Abrir la mesa* si dirijo) · "Campañas abiertas a nuevos jugadores" (plazas, *Pedir unirme*) ·
  "Unirme con código" · atajos Crear campaña.
- **Crear campaña** (asistente): Nombre → **Sistema de juego** (instalados; con vista previa "así se verá la mesa") →
  Visibilidad (abierta / por invitación) y plazas → Opciones de mesa (progresión habilitada, recursos compartidos
  iniciales según el sistema, idioma de la mesa) → **Invitar jugadores** (código, enlace, correo; plazas ocupadas/libres).
- **Como director**: regenerar código, aceptar/rechazar solicitudes de campañas abiertas, expulsar, cambiar plazas y
  visibilidad, habilitar/deshabilitar progresión, archivar la campaña, programar próxima sesión (fecha/hora).
- **Como jugador**: unirse con código/enlace, pedir unirse a una abierta, salir de la campaña.
- Un campaña sin el sistema instalado se muestra atenuada ("sistema no instalado") y no se puede abrir.

## Flows
1. Crear → queda anclada a `system_id`+`system_version` → soy `dm` → invitar → *Abrir la mesa* (`/table/:id`).
2. Jugador con código → miembro `player` → mesa → si no tiene personaje: generador o tomar uno sin asignar.
3. Solicitud a campaña abierta → el DJ ve la solicitud en la home/mesa → acepta → miembro.

## Rules & limits
- Nunca cambiar de sistema; el asistente lo avisa antes de crear.
- Plazas: 1–12 jugadores (8 recomendadas). El DJ no ocupa plaza.
- Progresión **deshabilitada por defecto**. Recursos compartidos iniciales los define el sistema (p.ej. Destino 10).
- Códigos: únicos, legibles (`XXXX-XXXX`), regenerables; caducan si el DJ lo decide.

## Connections
`identity` (registro con código), `game-system` (lista de instalados + `sharedResources` iniciales), `table` (abrir),
`realtime` (canal por campaña), `notifications` (futuro: invitación por correo, próxima sesión).

## Modelo de datos
Migración: `supabase/migrations/20260817120000_campaigns.sql` (aplicada en local, lint 0 errores, audit 0 hard).

- **`campaigns_campaigns`** — una fila por campaña: nombre, descripción, **sistema anclado** (`system_id` +
  `system_version`, un trigger impide cambiarlos), director (`dm_id`), visibilidad (`open`/`invite`), plazas (1–12),
  código de invitación (`XXXX-XXXX`, único, regenerable, `invite_enabled`), progresión habilitada, `shared_resources`
  (jsonb que gestiona el sistema), idioma de la mesa, escena activa (FK la añade `maps`), próxima/última sesión,
  archivado. **Lee**: sus miembros y su director; cualquiera si es abierta y no archivada. **Escribe**: crear solo
  `game_master`/admin como propio director; actualizar/archivar solo el director (o admin).
- **`campaigns_members`** — quién está en la campaña y con qué rol de mesa (`dm`/`player`); `character_id` enlaza la
  ficha (FK la añade `characters`). El director se inserta solo por trigger al crear la campaña. **Lee**: miembros de
  la misma campaña. **Escribe**: el director cualquier fila; un jugador solo puede salir (borrar la suya) o actualizar
  la suya (p. ej. su personaje). Un jugador **se une solo a través de `join_campaign_by_code(code)`** (SECURITY
  DEFINER: valida código habilitado, no archivada, plazas libres; idempotente) o cuando el director acepta su solicitud.
- **`campaigns_requests`** — solicitudes a campañas abiertas (`pending`/`accepted`/`rejected`). **Lee**: el solicitante y
  el director. **Escribe**: el solicitante crea/borra la suya pendiente; el estado cambia solo con
  `campaigns_resolve_request(req, accept)` (director).
- Endurecimiento (`20260817140000_campaigns_hardening.sql`, tras la review): los jugadores solo pueden **UPDATE de
  `character_id`** en su fila de miembro (grant por columna + trigger que impide cambiar rol/campaña/usuario si no eres
  DJ); `invite_code` **no es legible por SELECT** para `authenticated` (grant por columnas) — el DJ lo obtiene con
  `campaigns_my_invite_code(cid)` y lo rota con `campaigns_regenerate_invite_code(cid)`; `campaigns_players_count(cid)`
  da el conteo a quien puede ver la campaña; `join_campaign_by_code` bloquea la fila; `campaigns_resolve_request` exige
  `pending` y plaza libre. En `table`, `table_take_resource(cid, rid, n)` lee `perTakeMax` del recurso guardado.
- Helpers reutilizados por el resto de hexágonos: `is_campaign_member(id)`, `is_campaign_dm(id)`,
  `can_create_campaigns()`; `campaign_invite_preview(code)` para la vista previa (autenticados; los visitantes la
  obtienen vía API con service role — nunca `TO anon`).

## Estado v1 (2026-08-18)
Hecho además de crear/unirse: panel **Gestionar** del director (código + enlace + regenerar, solicitudes aceptar/rechazar,
miembros con expulsar, próxima sesión, progresión abierta/cerrada, archivar), **Abandonar** para jugadores, página `/systems`.
Pendiente: mensajes específicos para `campaign_full`/`already_resolved`, editar nombre/descripción/plazas desde el panel.
