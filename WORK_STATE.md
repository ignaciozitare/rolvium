# WORK_STATE.md — Rolvium

## 🎯 Current task
Construir los hexágonos v1 en orden (mapa: ARCHITECTURE.md «Product hexagons»; specs: `specs/modules/*`).

**HECHO** (todo con review + QA pasados):
diseño `rolvium.pen` · specs de todos los hexágonos · `packages/core` (puerto `GameSystem`, `validateSheet`) ·
`packages/system-plenilunio` **auditado contra el manual** (`RULES.md`) · `identity` (H1) · `campaigns` (H2, con panel de
gestión del director) · `table` (H3) · `characters` (H4) · `dice` (H6) · `maps` (H7) **rebanadas 1 y 2** · página `/systems`.

**SIGUIENTE:** rebanada 3 (movimiento máx. por turno, configurable por sistema) → rebanada 4 (galería de props para
construir mapas) → `chat` (H8) + `journal` (H9) → `bestiary` (H5) → notificaciones/deploy.

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

## 📍 Punto exacto (2026-08-18, fin de sesión — rebanada 2 de `maps` construida)
- **`maps` rebanada 2 HECHA**: dev + review + qa pasados. **Sin commitear todavía** (árbol sucio, ver «Siguiente paso»).
  El dueño **aún no ha validado light/dark** de las pantallas nuevas: es el único paso manual pendiente.
- **Dónde vive la visión: en el servidor, y eso es la frontera de seguridad.**
  - `packages/core/src/maps.ts` — contrato compartido (`SceneVision`, `FogCell`, `VisionPolygon`, `sightRadiusPx`) y
    `METRES_PER_CELL`, que **se mudó aquí desde `mapRules`** para que la API y el navegador usen el mismo número
    (`mapRules` lo reexporta, nadie se enteró). Sigue siendo deuda: la rebanada 3 lo sube al puerto `GameSystem`.
  - API: `application/maps/vision.ts` (barrido de rayos puro), `application/maps/sceneVision.ts`
    (`computeSceneVision` / `paintSceneFog`), puerto `domain/maps/IMapsRepository.ts`, adaptador service-role
    `infrastructure/supabase/SupabaseMapsRepo.ts`, rutas `POST /scenes/:id/vision` y `POST /scenes/:id/fog`.
  - Web: `VisionPort` + `HttpVisionAdapter` + `container.visionPort`. **El navegador nunca calcula la visión**: sólo
    recibe polígonos (visión actual) y casillas (lo explorado) y los pinta con máscaras SVG.
- **Lo explorado se guarda como CASILLAS** (`maps_fog.explored = [[x,y],…]`), no como polígonos libres: la unión entre
  sesiones es una operación de conjuntos, está acotada por el tamaño de la escena y es justo lo que pinta el pincel.
- **El bug del spec que encontró QA está corregido**: abrir una puerta NO llega por `postgres_changes` (aplica la RLS de
  cada suscriptor, y al jugador no le llega la fila de una puerta oculta). Viaja un **broadcast `fog.updated`** por el
  canal `scene:{id}` que dice «vuelve a pedir tu visión»; quien lo recibe recalcula y **no vuelve a emitir** (sería un
  bucle infinito — hay test que lo fija).
- **UI**: `MapCanvas` dibuja la niebla con máscaras SVG (`seen` = explorado ∪ visión · `lit` = visión · `dim` = lo
  recordado apagado · `unexplored` = velo azul del director); `WallShape` dibuja los tres tipos de segmento;
  `DmOptionsBar` (nuevo) lleva niebla automática + luz día/noche + recuento; `StrokeBar` se convierte en la barra
  «Pincel» con la herramienta Revelar/Ocultar activa y en la barra «Muro» (tipo del siguiente segmento) con la
  herramienta Muro; `Toolbar` usa el **`Tooltip` nuevo de `@rolvium/ui`** (en el UI
  Kit y en `CATALOG.md`).
- **10 migraciones**, sin cambios en esta sesión: la de la rebanada 2 (`20260818140000_maps_vision`) ya estaba aplicada
  y sólo añade columnas con DEFAULT. Verificado contra la base local: las 4 columnas de `maps_walls` y las 2 de
  `maps_scenes` están vivas.
- **Suites**: web **263** · api **77** · core 2 · system-plenilunio 62. `npm run typecheck` OK ·
  `npm run audit` **0 hard / 9 warn** (8 de `ui-reuse` preexistentes + 1 nuevo aceptado a conciencia, abajo) ·
  `npm run build` + `build:api` OK.
- **Arquitectura que ya está en pie** (responde a «¿dónde vive el backend?»):
  - *Postgres + RLS* = permisos y atomicidad. Lo que un jugador no debe ver o tocar lo corta la RLS o un trigger, nunca el
    cliente. Operaciones atómicas en RPCs (`join_campaign_by_code`, `table_take_resource`, `dice_commit_roll`, `characters_claim`).
  - *API Fastify* = autoridad en TypeScript + service role: `PUT /characters/:id/sheet`, `POST /rolls`,
    **`POST /scenes/:id/{vision,fog}`**, `GET /invites/:code` público, `/admin/*`.
  - *Cliente* = UX y vista previa. El mismo paquete de reglas corre en los dos lados; sólo el servidor decide.
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
- **Maps rebanada 2**: la visión la calcula el **servidor** con TODOS los muros y devuelve polígono + casillas; el
  cliente sólo pinta. Corolario general de realtime: `postgres_changes` aplica la RLS de cada suscriptor, así que
  cualquier cambio al que un usuario deba **reaccionar** sin poder leer la fila viaja por **broadcast** (aquí,
  `fog.updated`). La visión sigue al **control** del token, no a su visibilidad: un token que el director oculta sigue
  dando vista a su dueño. Recalcular está **coalescido** en un tick y el pincel va a 20 Hz, porque cada llamada
  reescribe la niebla de todos los jugadores.
- Harness: diseño en `.pen` → spec → dba → dev → **review + qa como subagentes** (lanzados como general-purpose leyendo
  `.claude/agents/{review,qa}.md`). QA: desviaciones de spec = warning; light/dark lo valida el dueño por ronda.

## ❓ Pendiente del dueño
1. **Aprobar el frame `sFipl`** de `rolvium.pen` («Mesa/Plenilunio · Escena · Rediseño (sin cabecera · rail ·
   seleccionar)») y **guardarlo con Cmd+S**. Es lo que desbloquea el dev de la rebanada 3 — el harness prohíbe UI sin
   blueprint aprobado.
2. **Validar light/dark** de la rebanada 2 (`SceneTab`, niebla, `DmOptionsBar`, barra «Pincel», `Tooltip`).
3. **Supabase**: crear el proyecto de Rolvium cuesta **10 $/mes** en la organización actual — el Pro de 25 € NO
   incluye proyectos extra, sólo 10 $/mes de crédito de cómputo que ya se gastan los dos que hay. El dueño va a
   **fusionar OIH dentro de Worksuite con el agente de Worksuite** para liberar el hueco. Datos que le pasé:
   OIH tiene **28 tablas / ~5,1 M filas / 7,2 GB** en un esquema propio `oih` (no en `public`), 12 funciones,
   **0 políticas RLS**, **0 usuarios de auth** y **0 ficheros en Storage** — sin usuarios ni Storage, la fusión es
   mucho menos peligrosa de lo normal; el volumen es lo que la hace lenta.

## ⏳ Siguiente paso inmediato
**La rebanada 2 está commiteada en la rama `feat/maps-slice-2`** (49 archivos, sin subir a `main` ni a GitHub — el
repo es público, así que el push lo pide el dueño explícitamente).

**Rebanada 3 — spec ✅ · diseño ✅ (falta aprobación) · queda DEV.** Salió entera de la prueba del dueño sobre la
rebanada 2; está en `specs/modules/maps/SPEC.md` § «Rebanada 3» y en `specs/modules/dice/SPEC.md` § «Dados 3D»:
1. **Fuera la cabecera «ESCENA · nombre»** (el dueño la señaló como espacio muerto) y **el lienzo a todo el alto, sin
   scroll**. Ojo al orden: la cabecera **no se puede quitar antes** de que existan el rail y las entradas nuevas de la
   barra, porque hoy aloja el desplegable de escenas, «Fondo del mapa» y «Colocar PJ» — quitarla antes deja al
   director sin acceso a las tres cosas.
2. **Rail de escenas** plegable (miniatura + nombre + punto oro en la activa) sustituyendo al desplegable.
3. **Una barra de herramientas** en tres bloques rotulados: JUEGO (Dados primero · Seleccionar · Medir · Pin) ·
   LIENZO (dibujo) · DIRECTOR tras el separador oro (Muro · Revelar · Ocultar ‖ Encuentro · Colocar PJ · Fondo).
4. **Herramienta Seleccionar** (sustituye a Mover): selecciona tokens, trazos y **muros**, con **tirador en cada
   vértice** para estirarlos y barra de segmento para cambiar el tipo / visibilidad / borrar. Abrir puertas pasa a un
   **disco oro al pasar el ratón** sobre el vano, lo que además mata el choque de la rebanada 2 (empezar un muro cerca
   de una puerta la abría).
5. **Una puerta dibujada sobre un muro lo parte** — hoy se superponen y la puerta no hace nada. Es el agujero más
   grave que dejó la rebanada 2.
6. **Dados 3D** (H6) con `import()` dinámico y aterrizando en el resultado que ya decidió el servidor.

**HECHO ya de la rebanada 3** (aditivo, no necesitaba diseño): **paneo con barra espaciadora** desde cualquier
herramienta, con guarda para no robarle el espacio a quien escribe en un campo y para no quedarse pegado al perder
el foco. El botón central ya paneaba.

Después: segunda pasada de la prueba manual · rebanada 4 (movimiento máx. por turno, toca `GameSystem`) ·
rebanada 5 (galería de props) · `chat` (H8) + `journal` (H9) · `bestiary` (H5).

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
- ~~**El director no puede crear puertas ni ventanas**~~ (hallazgo de Review y QA, 2026-08-18) — **CERRADA** el
  mismo día: diseño en `rolvium.pen` `h3Q3NN` + selector de tipo cableado en la barra «Muro». Ver «Siguiente paso» §2.
- **`MASK_SHOW = '#ffffff'` en `canvasLayers.tsx` es un warning permanente aceptado.** No es un color: es el valor de
  **luminancia** de una `<mask>` de SVG (blanco = opaco, negro = transparente). Un token del sistema sería blanco roto y
  filtraría un 5 % de niebla sobre lo que debería verse limpio. Review y QA lo revisaron por separado y coinciden: no
  tocar, y **no** enseñarle la excepción a `audit.mjs` por una línea.
- **`maps_walls` no ata `kind` a los flags** (preexistente): nada impide `kind='window'` con `blocks_sight=true`. La
  invariante vive en `WALL_FLAGS` y en el spec. Un `CHECK (kind <> 'window' OR NOT blocks_sight)` la cerraría.
- **El tope por reparto es guardia de cliente, no de servidor.** `applyChange` corre en el navegador; la creación es un
  `insert` directo en `characters` y `PUT /characters/:id/sheet` valida contra `sheetSchema` (`stat.max = 10`), no
  contra `preset.maxStat`. Editando la ficha se puede dejar Fortaleza 7 con reparto Estándar. No es frontera de
  seguridad (personaje propio, el director lo ve) pero rompe el «mismas reglas en los dos lados» de ARCHITECTURE.
- **`maps_tokens.vision_radius`** quedó redundante con `night_radius_m` de escena y la rebanada 2 **no lo usa**;
  decidir si se aprovecha (visión por token) o se retira de la tabla.
- **Edición neutra de presupuesto con borrador sobregastado** (preexistente): añadir/quitar una especialidad no cuesta
  puntos pero sigue vetada mientras el paso esté en negativo, y el `<select>` no se deshabilita — el usuario elige y no
  pasa nada. Ya no es callejón sin salida.
- **Los desplegables «+ Especialidad» aparecen en el paso de Características** (el campo `stat` arrastra sus
  `itemFields` a cualquier paso que lo liste). El dueño preguntó por ello; las reglas son correctas, la pantalla no.
- `UIKit.tsx` pasa `labels` a `<Sheet>` sin la clave `soon`, así que la leyenda nueva no se ve en el UI Kit.
- `packages/ui` no tiene runner de tests propio: sus ramas las cubren los consumidores desde `apps/web`.
- Flake preexistente: `CampaignManagePanel.test.tsx > shows the invite code…` falla bajo carga y pasa aislado.

## 🚫 Bloqueos / notas
### Vercel: el proyecto de la API ya existe, pero **está caído a propósito** (2026-08-18)
El dueño creó `rolvium-api` en Vercel «para cuando estemos listos para subir»:
- Panel: https://vercel.com/ignaciozitare-9429s-projects/rolvium-api · `prj_0OBlHaNEmoDHOZVoEnFTV8hr4i70` ·
  team `team_O0LMo9mzgF91fZTJ1mJg7yJw` (`ignaciozitare-9429s-projects`). Framework `fastify`, Node 24.x.
- Dominio: **https://rolvium-api.vercel.app** — deja de ser un placeholder. `apps/web` lo consume con
  `VITE_API_URL`, y `.claude/commands/{review,qa,deploy}.md` sondean esta URL.
- **`GET /health` → 500 `FUNCTION_INVOCATION_FAILED`.** No es un bug del código: el build está `READY` y la función
  arranca, pero `supabaseDeps()` lanza `Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`
  (confirmado en los runtime logs). Falta configurarlas, y **no se pueden configurar todavía porque no hay Supabase
  hosted**: primero el proyecto de Supabase, luego las variables, luego el deploy vuelve solo.
- **No existe aún el proyecto web** (`rolvium.vercel.app` → 404 `DEPLOYMENT_NOT_FOUND`). Hacen falta los dos: web
  (estático + rewrites a `index.html`) y api (Build Output API v3 vía `apps/api/bundle.mjs`).
- Ojo con la regla «nunca dar por terminado con producción caída» de `.claude/CLAUDE.md`: **no aplica todavía**. Esto
  no es producción caída, es producción que aún no ha nacido — no hay código subido ni base hosted. En cuanto se
  suba de verdad, la regla vuelve a morder.
- **Orden correcto para subir**: (1) proyecto Supabase hosted → (2) `supabase link` + `db push` → (3) variables en
  Vercel (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_ORIGIN`) → (4) proyecto web + `VITE_API_URL` →
  (5) `get_advisors` → (6) volver a sondear `/health`.

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
