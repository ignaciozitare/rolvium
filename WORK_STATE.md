# WORK_STATE.md — Rolvium

## 🎯 Current task
Construir los hexágonos v1 en orden (mapa: ARCHITECTURE.md «Product hexagons»; specs: `specs/modules/*`).

**HECHO** (todo con review + QA pasados, `main`, árbol limpio en `03d0938`):
diseño `rolvium.pen` · specs de todos los hexágonos · `packages/core` (puerto `GameSystem`, `validateSheet`) ·
`packages/system-plenilunio` **auditado contra el manual** (`RULES.md`) · `identity` (H1) · `campaigns` (H2, con panel de
gestión del director) · `table` (H3) · `characters` (H4) · `dice` (H6) · `maps` (H7) **rebanada 1** · página `/systems`.

**SIGUIENTE:** `maps` rebanada 2 (niebla + visión + día/noche + puertas/ventanas) → rebanada 3 (movimiento máx. por
turno, configurable por sistema) → rebanada 4 (galería de props para construir mapas) → `chat` (H8) + `journal` (H9) →
`bestiary` (H5) → notificaciones/deploy.

## 🔎 Prueba manual del dueño (2026-08-18) — cerrada
- **(a) El generador se atascaba en «Características».** Causa: `GeneratorWizard.canChange` sólo miraba el presupuesto,
  nunca el máximo del reparto; `canAdjustStat` estaba exportada y testeada pero la UI no la llamaba, y el campo `stat`
  declara `max: 10`. **Arreglado** con un miembro opcional nuevo del puerto, `GeneratorStep.applyChange(draft, campo,
  valor) → SheetPatch | null`: el sistema veta o normaliza cada edición (la plataforma sigue sin conocer `PRESETS` ni
  `maxStat`). Plenilunio lo implementa: tope por reparto y **re-clamp al bajar de reparto** conservando especialidades.
  Además `canChange` ahora permite siempre un cambio que **reduce** el sobregasto — sin eso, un borrador sobregastado
  (los canjes de dones se presupuestan en puntos de don y pueden dejar los de creación en negativo) desactivaba también
  los `−` y sólo se salía con «Cancelar». Hallazgo del Review; hay test que falla sin el arreglo.
- **Especialidades:** las reglas son correctas (RULES.md §1.3, p.21–22). **Deuda de UI, sin tocar:** los desplegables
  «+ Especialidad» salen ya en el paso de Características porque el campo `stat` arrastra sus `itemFields` a cualquier
  paso que lo liste; su paso propio es el siguiente.
- **(b) «La Reserva de Destino no funciona»:** funciona como está diseñada — `whoCanTake: 'player'`, el director no coge
  dados, sólo reinicia (lo dice el propio `.pen`). El dueño probaba solo, como admin/director.
- **(c) «No se guarda nada»:** la BD estaba bien (9 migraciones, campaña guardada). Eran dos cosas: **la API no estaba
  levantada** (`:3001` sin escuchar → `PUT /characters/:id/sheet` y `POST /rolls` fallaban) y `characters` tenía 0 filas
  porque (a) impedía terminar el generador. **Arrancar `npm run dev:api` es obligatorio; sin él la mesa parece rota.**
- **Leyendas «pronto»:** ya estaban Bestiario, Chat/Notas/Bitácora, herramientas de niebla, sistemas y Notificaciones.
  El único hueco era el avatar de la ficha → `characters.sheet.imageSoon` («Subir imagen: pronto»).
- **Cuentas de desarrollo en `supabase/seed.sql`** (sobreviven a `db:reset`, contraseña `rolvium123`):
  `jugador1@ejemplo.com` (Marta Ruiz · «Marta») y `jugador2@ejemplo.com` (Nico Vega · «Nix»). **No** están unidas a
  ninguna campaña a propósito. El §1 de `docs/PRUEBA-MANUAL.md` da de alta `jugador3@ejemplo.com` para no chocar.

## 📍 Punto exacto (2026-08-18, fin de sesión)
- **10 migraciones** aplican limpias (`npm run db:reset`), `supabase db lint` sin errores:
  core_users_roles · campaigns · table_shared_resources · campaigns_hardening · identity · characters · characters_api ·
  dice_rolls · maps · maps_vision.
- **Arquitectura que ya está en pie** (responde a «¿dónde vive el backend?»):
  - *Postgres + RLS* = permisos y atomicidad. Lo que un jugador no debe ver o tocar lo corta la RLS o un trigger, nunca el
    cliente. Operaciones atómicas en RPCs (`join_campaign_by_code`, `table_take_resource`, `dice_commit_roll`, `characters_claim`).
  - *API Fastify* = autoridad en TypeScript + service role: `PUT /characters/:id/sheet` (valida contra el `sheetSchema`,
    recalcula derivadas con el motor, autoridad de px, **persiste como el usuario** vía `characters_api_update`),
    `POST /rolls` (reconstruye la reserva con `engine.poolFor`, dados CSPRNG, `engine.resolve`, guarda la tirada inmutable,
    aplica los efectos en la ficha), `GET /invites/:code` público, `/admin/*`.
  - *Cliente* = UX y vista previa. El mismo paquete de reglas corre en los dos lados; sólo el servidor decide.
- **Suites**: web 225 · api 39 · core 2 · system-plenilunio 62. `npm run typecheck` OK · `npm run audit` 0 hard / 8 warn
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
**Chat nuevo** (el transcript del 2026-08-18 llegó a 8,2 MB, por encima del umbral de handoff). Prompt de reanudación:
> Retomo Rolvium: lee WORK_STATE.md y ARCHITECTURE.md. Toca el **dev de `maps` rebanada 2** (niebla + visión en
> servidor, luz día/noche, puertas y ventanas, tooltips de la barra) — el spec, la migración y el diseño ya están
> aprobados. Flujo: dev → review → qa.

1. **Segunda pasada de la prueba manual** con las tres cuentas (`docs/PRUEBA-MANUAL.md`), ahora que el generador se
   completa y la API está arriba. Los fallos que salgan entran al backlog de aquí.
2. **`maps` rebanada 2 — spec ✅ · dba ✅ · diseño ✅ · queda DEV → review → qa.**
   Spec confirmado por el dueño y migración `20260818140000_maps_vision` aplicada. Diseño aprobado y `.pen` guardado.
   **Lo único que falta es el código.** Punto de partida exacto para el dev:
   - **Semántica de aberturas, ya en la BD** (no la reinventes): `corta la vista ⇔ blocks_sight AND NOT is_open`;
     `corta el paso ⇔ blocks_move AND NOT is_open`. Muro `t/t/cerrado` · Puerta `t/t/abrible` · Ventana `f/t/abrible`.
     `blocks_move` no hace nada hasta la rebanada 3. Restricciones probadas contra la base real.
   - **Visión:** cada jugador ve lo que ven **sus** tokens; el director la unión de lo explorado por todos. El cálculo
     va **en servidor con TODOS los muros** (los `visible_players=false` no viajan al cliente) — es la frontera de
     seguridad: si se calculase en el cliente habría que mandarle la planta entera.
   - **Luz:** `maps_scenes.lighting` (`day`/`night`) + `night_radius_m` (10 por defecto, en METROS). La conversión a
     casillas usa `METRES_PER_CELL` de `mapRules` — ⚠ deuda: es una regla de Plenilunio en la plataforma, y con la luz
     nocturna pasa de cosmética a decidir quién ve a quién. Subirla al puerto `GameSystem` en la rebanada 3.
   - **Recalcular** al mover token, abrir/cerrar puerta, cambiar luz o muros, y al entrar en la escena.
   - **Activar** `TOOLS_NOT_YET = ['reveal','hide']` en `mapRules` y quitar el `TODO(slice 2)` de `MapCanvas`.
   - **Diseño 1:1** en `rolvium.pen`: frames `uXK3T` (Escena · Director · Niebla) y `vz19f` (Escena · Jugador · Noche);
     componente nuevo `PL/Tooltip herramienta` (`YQHKf`). El jugador ve **negro** fuera de su visión, no un velo.
   - **Tooltip de las herramientas**: los botones ya tienen `title`/`aria-label`; hay que sustituir el nativo por el
     componente. El `aria-label` se queda.
   - ⚠ **Corregir el spec antes de implementar** (hallazgo de QA): dice que abrir una puerta llega sola por realtime
     porque `maps_walls` está en la publicación, pero `postgres_changes` aplica RLS por suscriptor y al jugador no le
     llega el evento de una puerta oculta. Tiene que llegarle por el recálculo del servidor.
3. **Rebanada 3 — movimiento máximo por turno**, configurable **por sistema** (toca el puerto `GameSystem` y `packages/core`).
4. **Rebanada 4 — galería de componentes** (muebles, árboles…) que se puedan ir cargando, para construir mapas dentro
   de la app. Tabla + bucket + UI + diseño propios; da para un hexágono.
5. **`chat` (H8) + `journal` (H9)**: las pestañas Chat · Notas · Bitácora del panel lateral son placeholders «pronto».
6. **`bestiary` (H5)**: hoy `EncounterMenu` usa `system.catalogs.bestiary`; alinear las entradas base con bloques reales del
   manual (RULES §8: «Solitario/Chatarrero» son plantillas del prototipo, no del libro).

## 🗒️ Backlog (decisiones del dueño y deuda conocida)
- **Decidir**: el bucket `backgrounds` es de lectura pública como `avatars`/`tokens` (cualquiera con la URL ve un mapa no
  revelado) · límites duros de escenas/tokens/trazos (hoy sólo orientativos en el spec).
- Maps: `removeImage` deja el objeto huérfano en Storage · `uploadImage` siempre nombra `.png` · ruta de subida no-uuid da
  `22P02` en vez de 403 · `mapRules.visibleTokens/sceneVisibleTo` duplicados en línea en el canvas · 6 claves `maps.*` sin uso.
- Generador: los desplegables «+ Especialidad» aparecen ya en el paso de Características (`stat` arrastra sus
  `itemFields`) · bajar de reparto re-clampa sin aviso ni deshacer (Mítico 10 → Estándar 5 → volver a Mítico deja 5).
- Characters: subir avatar/token desde la ficha (`onImagePick` existe, sin cablear) · cambiar especialidad (3 px) ·
  registro de auditoría en «El grupo» · errores por campo del `INVALID_SHEET` en la UI · iconos ⚔/◎ por tipo de arma.
- Dice: adjuntar tirada al chat · endpoint/UI para verificar una tirada desde los dados crudos · membresía en `POST /rolls`
  sin personaje.
- Campaigns: mensajes específicos para `campaign_full`/`already_resolved` · editar nombre/descripción/plazas/visibilidad
  desde el panel · `campaigns_players_count` N+1 → RPC que devuelva conjunto.
- Plataforma: fondo de Plenilunio a WebP (3,5 MB) · `UserMenu` con botones en línea (3 warns del audit).

## 🧾 Deuda abierta con nombre y apellidos (de Review y QA, 2026-08-18)
- **El tope por reparto es guardia de cliente, no de servidor.** `applyChange` corre en el navegador; la creación es un
  `insert` directo en `characters` y `PUT /characters/:id/sheet` valida contra `sheetSchema` (`stat.max = 10`), no
  contra `preset.maxStat`. Editando la ficha se puede dejar Fortaleza 7 con reparto Estándar. No es frontera de
  seguridad (personaje propio, el director lo ve) pero rompe el «mismas reglas en los dos lados» de ARCHITECTURE.
- **`maps_walls` no ata `kind` a los flags**: nada impide `kind='window'` con `blocks_sight=true`. La invariante de los
  tres tipos vive sólo en el spec. Un `CHECK (kind <> 'window' OR NOT blocks_sight)` la cerraría.
- **`maps_tokens.vision_radius`** queda redundante con `night_radius_m` de escena; decidir si se usa o se retira.
- **Edición neutra de presupuesto con borrador sobregastado** (preexistente): añadir/quitar una especialidad no cuesta
  puntos pero sigue vetada mientras el paso esté en negativo, y el `<select>` no se deshabilita — el usuario elige y no
  pasa nada. Ya no es callejón sin salida.
- **Los desplegables «+ Especialidad» aparecen en el paso de Características** (el campo `stat` arrastra sus
  `itemFields` a cualquier paso que lo liste). El dueño preguntó por ello; las reglas son correctas, la pantalla no.
- `UIKit.tsx` pasa `labels` a `<Sheet>` sin la clave `soon`, así que la leyenda nueva no se ve en el UI Kit.
- `packages/ui` no tiene runner de tests propio: sus ramas las cubren los consumidores desde `apps/web`.
- Flake preexistente: `CampaignManagePanel.test.tsx > shows the invite code…` falla bajo carga y pasa aislado.

## 🚫 Bloqueos / notas
- Sin Supabase hosted (el plan del dueño permite 2 proyectos) → local. Al pasar a hosted: `supabase link` + `db push`,
  comprobar que `postgres` puede borrar en `auth.sessions`/`auth.refresh_tokens` (RPCs de identity), que
  `site_url`/redirects incluyan el dominio de Vercel (`/reset`, `/join/*`), y volver a correr `get_advisors`.
- Realtime `postgres_changes` respeta los grants de columna (según review) — reconfirmar en hosted.
- Arrancar: `npm run db:start` (Docker) · `npm run dev:api` (ya arreglado) · `npm run dev:web` (:5173).
  Admin de desarrollo: `admin@rolvium.local` / `rolvium123`. Correo local: Mailpit http://127.0.0.1:54324.
- **Repo en GitHub: https://github.com/ignaciozitare/rolvium — PÚBLICO** (`origin/main`, push por gh CLI). El dueño lo
  eligió público a sabiendas tras plantearle privado o reescribir el historial; contiene `RULES.md` (digesto del manual
  comercial de Plenilunio) y `fondo.png` desde commits del 17-08. Cambiar la visibilidad ya no basta para retirarlo.
- **Arrancar `npm run dev:api` NO es opcional**: sin él no se guarda ninguna ficha ni se tira ningún dado, y la mesa
  parece rota sin dar ningún error claro. Fue la causa de dos de los tres «fallos» de la prueba manual.
- `npm run db:reset` **borra la base local**, campañas de prueba incluidas. La migración de la rebanada 2 se aplicó en
  caliente por eso. Si necesitas resetear, avisa al dueño antes.
- El `.pen` **sólo lo puede guardar el dueño** (Cmd+S en la pestaña): no hay permiso de Accesibilidad para automatizarlo.
  Comprobar siempre `ls -la rolvium.pen` antes de dar por hecho que el diseño está en disco.
