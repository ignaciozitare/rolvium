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
- Plazas: 1–8 jugadores (orientativo, configurable). El DJ no ocupa plaza.
- Progresión **deshabilitada por defecto**. Recursos compartidos iniciales los define el sistema (p.ej. Destino 10).
- Códigos: únicos, legibles (`XXXX-XXXX`), regenerables; caducan si el DJ lo decide.

## Connections
`identity` (registro con código), `game-system` (lista de instalados + `sharedResources` iniciales), `table` (abrir),
`realtime` (canal por campaña), `notifications` (futuro: invitación por correo, próxima sesión).

## Modelo de datos
> Pending — DBA. Propuesta (prefijo `campaigns_`): `campaigns` (id, name, system_id, system_version, dm_id,
> invite_code, visibility, seats, description, progression_enabled, active_scene_id, shared_resources jsonb,
> next_session_at, archived_at); `campaign_members` (campaign_id, user_id, role dm|player, character_id, joined_at);
> `campaign_requests` (campaign_id, user_id, status).
