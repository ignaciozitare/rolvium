# WORK_STATE.md — Rolvium

## 🎯 Current task
Construir los hexágonos v1 en orden (mapa: ARCHITECTURE.md «Product hexagons»; specs: `specs/modules/*`).

**HECHO** (todo con review + QA pasados, `main`, árbol limpio en `03d0938`):
diseño `rolvium.pen` · specs de todos los hexágonos · `packages/core` (puerto `GameSystem`, `validateSheet`) ·
`packages/system-plenilunio` **auditado contra el manual** (`RULES.md`) · `identity` (H1) · `campaigns` (H2, con panel de
gestión del director) · `table` (H3) · `characters` (H4) · `dice` (H6) · `maps` (H7) **rebanada 1** · página `/systems`.

**SIGUIENTE:** `maps` rebanada 2 (niebla + visión en servidor) → `chat` (H8) + `journal` (H9) → `bestiary` (H5) →
notificaciones/deploy. Antes de nada: **el dueño prueba todo junto** con `docs/PRUEBA-MANUAL.md`.

## 📍 Punto exacto (2026-08-18, fin de sesión)
- **9 migraciones** aplican limpias (`npm run db:reset`), `supabase db lint` sin errores:
  core_users_roles · campaigns · table_shared_resources · campaigns_hardening · identity · characters · characters_api ·
  dice_rolls · maps.
- **Arquitectura que ya está en pie** (responde a «¿dónde vive el backend?»):
  - *Postgres + RLS* = permisos y atomicidad. Lo que un jugador no debe ver o tocar lo corta la RLS o un trigger, nunca el
    cliente. Operaciones atómicas en RPCs (`join_campaign_by_code`, `table_take_resource`, `dice_commit_roll`, `characters_claim`).
  - *API Fastify* = autoridad en TypeScript + service role: `PUT /characters/:id/sheet` (valida contra el `sheetSchema`,
    recalcula derivadas con el motor, autoridad de px, **persiste como el usuario** vía `characters_api_update`),
    `POST /rolls` (reconstruye la reserva con `engine.poolFor`, dados CSPRNG, `engine.resolve`, guarda la tirada inmutable,
    aplica los efectos en la ficha), `GET /invites/:code` público, `/admin/*`.
  - *Cliente* = UX y vista previa. El mismo paquete de reglas corre en los dos lados; sólo el servidor decide.
- **Suites**: web 222 · api 39 · core 2 · system-plenilunio 60. `npm run typecheck` OK · `npm run audit` 0 hard / 8 warn
  (UserMenu ×3 y 4 overlays de canvas intencionados) · `npm run build` + `build:api` OK.
- **Sin Supabase hosted ni Vercel todavía**: todo local. Las URLs de producción del harness son placeholders.

## ✅ Decisiones vigentes
- **El manual manda** en las reglas de un sistema: cada `packages/system-*` guarda `RULES.md` (resumen propio + páginas +
  «⚠ interpretación»); orden libro → RULES.md → código. Regla ya escrita en `.claude/CLAUDE.md`.
- Hexágonos y puertos: los sistemas de juego son paquetes enchufables detrás de `GameSystem`; la plataforma no sabe reglas.
  El aspecto del sistema entra como variables `--sys-*` en el contenedor de la mesa, nunca con componentes por sistema.
- Campaña anclada a `system_id`+versión para siempre. Rol de mesa (`dm`/`player`) en `campaigns_members`; roles de
  plataforma admin/game_master/player.
- Identity: las sesiones se leen de `auth.sessions` por RPC (sin tabla propia); el correo es de sólo lectura en v1.
- Characters: `data` jsonb validado en la API; auditoría por trigger con origen (`sheet|roll|damage|progression|dm|system`),
  legible sólo por el director; los px los otorga el director, el jugador sólo los gasta con la progresión abierta.
- Dice: tiradas inmutables (una corrección es una tirada nueva); visibilidad `table|dm|secret` por RLS; los dados de la
  reserva se descuentan en la misma transacción que la tirada; tirar *como* un personaje exige ser su dueño o el director.
- Maps: el jugador ve la escena activa (o marcada visible), sólo tokens visibles y sólo muros `visible_players`; mueve
  únicamente x/y de sus tokens. Canales realtime en uso: `campaign:{id}`, `campaign-rolls:{id}`, `scene:{sceneId}`.
- Harness: diseño en `.pen` → spec → dba → dev → **review + qa como subagentes** (lanzados como general-purpose leyendo
  `.claude/agents/{review,qa}.md`). QA: desviaciones de spec = warning; light/dark lo valida el dueño por ronda.

## ⏳ Siguiente paso inmediato
**Chat nuevo.** Prompt de reanudación:
> Retomo Rolvium: lee WORK_STATE.md y ARCHITECTURE.md. Primero repasamos los fallos de mi prueba manual
> (`docs/PRUEBA-MANUAL.md`); luego `maps` rebanada 2 (niebla + visión en servidor) según rolvium.pen.
> Flujo: spec → dba → dev → review → qa.

1. **Prueba manual del dueño** (`docs/PRUEBA-MANUAL.md`): arranque, usuarios, checklist por hexágono y pasada light/dark.
   Vigilar en concreto lo arreglado a ciegas hoy: scroll de la mesa (el generador se completa) y que la rueda haga zoom
   **sin** mover la mesa. Los fallos que salgan entran al backlog de aquí.
2. **`maps` rebanada 2**: endpoint que calcule el polígono de visión con **todos** los muros en servidor y escriba
   `maps_fog` por jugador; pincel revelar/ocultar del director; velo azulado en vista de director; activar las herramientas
   hoy deshabilitadas (`TOOLS_NOT_YET = ['reveal','hide']`, hay `TODO(slice 2)` en `MapCanvas`).
3. **`chat` (H8) + `journal` (H9)**: las pestañas Chat · Notas · Bitácora del panel lateral son placeholders «pronto».
4. **`bestiary` (H5)**: hoy `EncounterMenu` usa `system.catalogs.bestiary`; alinear las entradas base con bloques reales del
   manual (RULES §8: «Solitario/Chatarrero» son plantillas del prototipo, no del libro).

## 🗒️ Backlog (decisiones del dueño y deuda conocida)
- **Decidir**: el bucket `backgrounds` es de lectura pública como `avatars`/`tokens` (cualquiera con la URL ve un mapa no
  revelado) · límites duros de escenas/tokens/trazos (hoy sólo orientativos en el spec).
- Maps: `removeImage` deja el objeto huérfano en Storage · `uploadImage` siempre nombra `.png` · ruta de subida no-uuid da
  `22P02` en vez de 403 · `mapRules.visibleTokens/sceneVisibleTo` duplicados en línea en el canvas · 6 claves `maps.*` sin uso.
- Characters: subir avatar/token desde la ficha (`onImagePick` existe, sin cablear) · cambiar especialidad (3 px) ·
  registro de auditoría en «El grupo» · errores por campo del `INVALID_SHEET` en la UI · iconos ⚔/◎ por tipo de arma.
- Dice: adjuntar tirada al chat · endpoint/UI para verificar una tirada desde los dados crudos · membresía en `POST /rolls`
  sin personaje.
- Campaigns: mensajes específicos para `campaign_full`/`already_resolved` · editar nombre/descripción/plazas/visibilidad
  desde el panel · `campaigns_players_count` N+1 → RPC que devuelva conjunto.
- Plataforma: fondo de Plenilunio a WebP (3,5 MB) · `UserMenu` con botones en línea (3 warns del audit).

## 🚫 Bloqueos / notas
- Sin Supabase hosted (el plan del dueño permite 2 proyectos) → local. Al pasar a hosted: `supabase link` + `db push`,
  comprobar que `postgres` puede borrar en `auth.sessions`/`auth.refresh_tokens` (RPCs de identity), que
  `site_url`/redirects incluyan el dominio de Vercel (`/reset`, `/join/*`), y volver a correr `get_advisors`.
- Realtime `postgres_changes` respeta los grants de columna (según review) — reconfirmar en hosted.
- Arrancar: `npm run db:start` (Docker) · `npm run dev:api` (ya arreglado) · `npm run dev:web` (:5173).
  Admin de desarrollo: `admin@rolvium.local` / `rolvium123`. Correo local: Mailpit http://127.0.0.1:54324.
- Esta sesión agotó dos veces el límite de Fable con subagentes; se reanudaron sin perder contexto (`SendMessage` al agente).
