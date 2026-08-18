# WORK_STATE.md — Rolvium

## 🎯 Current task
Construir los hexágonos v1 en orden (mapa: ARCHITECTURE.md «Product hexagons»; specs: `specs/modules/*`).

**HECHO** (todo con review + QA pasados):
diseño `rolvium.pen` · specs de todos los hexágonos · `packages/core` (puerto `GameSystem`, `validateSheet`) ·
`packages/system-plenilunio` **auditado contra el manual** (`RULES.md`) · `identity` (H1) · `campaigns` (H2, con panel de
gestión del director) · `table` (H3) · `characters` (H4) · `dice` (H6) · `maps` (H7) **rebanadas 1 y 2** · página `/systems`.

`maps` **rebanada 3** (rediseño de la escena a pantalla completa, Seleccionar, aberturas, Texto) construida en la
sesión del 18→19 de agosto a partir de la prueba del dueño sobre la app corriendo.

**SIGUIENTE:** terminar el despliegue (faltan variables de entorno en Vercel, ver abajo) → rebanada 4 (movimiento máx.
por turno, configurable por sistema) → rebanada 5 (galería de props) → `chat` (H8) + `journal` (H9) → `bestiary` (H5).

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

## 📍 Punto exacto (2026-08-19, madrugada — rebanada 3 construida, base hosted en pie, despliegue a medias)

### Lo que está hecho y commiteado (rama `feat/maps-slice-2`, el nombre se quedó corto)
Ocho commits. La rebanada 3 salió entera de que el dueño probara la app y fuera pidiendo correcciones:
- **La escena ocupa la pantalla.** Fuera la banda «ESCENA · nombre»; sus tres trabajos se repartieron (escenas al
  rail izquierdo plegable, «Fondo del mapa» y «Colocar PJ» a la barra, el nombre a la etiqueta del lienzo).
  Las pestañas y los conectados subieron a la barra negra; la Reserva de Destino se sentó en la cabecera blanca con
  su botón de plegar. **La mesa dejó de scrollear** (`.tb-root` `overflow:hidden`, `.tb-body` estirado, `.mp-stage`
  sin alto fijo), así que lienzo y registro acaban a la misma altura por construcción. Más una pasada de compactación.
- **Una sola barra de herramientas** en tres bloques separados por reglas (sin rótulos: ensanchaban). Dados primero.
- **`move` → `select`** y el paneo pasa a ser modificador: **espacio o botón central**, desde cualquier herramienta.
- **Seleccionar edita de verdad**: tiradores en los vértices de un muro, arrastrar entero o un extremo, selección por
  área arrastrando un marco, Suprimir borra, y menú al botón derecho (centrar para mí · centrar para todos · ajustar
  a la pantalla · dados · eliminar). El botón derecho también cancela un muro a medias, como Escape.
- **Aberturas**: una puerta o ventana ya no encadena la siguiente. La barra «Segmento» flota sobre el lienzo y sirve
  para elegir lo que vas a dibujar y para editar lo elegido (tipo, visible, abrir/cerrar, borrar).
- **Herramienta Texto** (el tipo `text` ya existía en la base y en el pintor; sólo faltaba la puerta).
- **Colocar PJ** estaba roto (su popover seguía anclado bajo un botón de cabecera que ya no existe) y colocaba a
  ciegas en el centro. Ahora va en dos pasos como Encuentro.
- **Dados**: el registro se lee como un chat y sigue a la última tirada; scrollea dentro de su panel con
  `scrollbar-gutter`; fuera el botón duplicado del lanzador y la línea negra de cada entrada; el lanzador se abre
  junto a la barra y mide 272 px.
- **La luna** (`Crescent`) se traza con el path del master en vez de aproximarla con dos arcos.

### La base hosted YA EXISTE y tiene el esquema
- Proyecto **`scfspsiemikfcnqteonq`** («Rolvium»), org `iuxzfnveabephkcixsaa` (**free tier — 0 €/mes**), región
  **eu-central-1**. La org de Worksuite cobra 10 $/mes por proyecto extra; ésta no. OIH lo borró el dueño tras migrar
  sus 28 tablas a Worksuite.
- **Las 11 migraciones aplicadas** contra hosted, en orden y sin errores. `npm run db:reset` las replica en local.
- **No se pudo usar `supabase link` + `db push`**: el CLI no está autenticado (`supabase login` pendiente). Se
  aplicaron con `psql` a través del contenedor local contra el **pooler** —
  `aws-0-eu-central-1.pooler.supabase.com:5432`, usuario `postgres.scfspsiemikfcnqteonq`—, porque el host directo
  `db.<ref>.supabase.co` **no resuelve** (los proyectos nuevos son sólo IPv6 por ahí).
- **`get_advisors` sin ningún CRITICAL.** Los avisos que salieron se arreglaron con la migración
  `20260819010000_harden_functions`: `SET search_path` en cinco funciones SECURITY DEFINER que no lo tenían, y fuera
  el EXECUTE de las funciones de TRIGGER (PostgREST las publicaba como RPC) y de los helpers de permisos para `anon`.

### Suites
web **300** · api **77** · core 2 · system-plenilunio 62 · `typecheck` OK · `audit` **0 hard / 9 warn** ·
`build` + `build:api` OK.

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

## ❓ Pendiente del dueño (lo primero al despertar)

### 1. Las variables de entorno de Vercel — es lo ÚNICO que separa de producción
No las puedo poner yo: **el token del CLI de Vercel está caducado** (`vercel whoami` → «The specified token is not
valid») y el conector MCP de Vercel no expone ninguna herramienta para escribir variables. Dos caminos: `vercel login`
en la terminal y me lo dices, o pegarlas a mano en el panel.

En **`rolvium-api`** (ya existe y está conectado a GitHub, así que despliega solo al hacer push):
```
SUPABASE_URL=https://scfspsiemikfcnqteonq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<el `sb_secret_…` del panel de Supabase>
ALLOWED_ORIGIN=https://rolvium.vercel.app
```
En el proyecto **web** (aún NO existe: hay que crearlo apuntando al mismo repo, raíz del monorepo; `vercel.json` ya
está escrito con el build y el rewrite a `index.html`):
```
VITE_SUPABASE_URL=https://scfspsiemikfcnqteonq.supabase.co
VITE_SUPABASE_ANON_KEY=<el `sb_publishable_…`>
VITE_API_URL=https://rolvium-api.vercel.app
```
Hoy `https://rolvium-api.vercel.app/health` devuelve **500 `FUNCTION_INVOCATION_FAILED`** y los runtime logs dicen
literalmente `Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`. En cuanto estén, revive solo.

### 2. Rotar credenciales
La contraseña de Postgres y las claves llegaron por el chat, y el repo es público. **Nada de eso está en git** —
comprobado: `apps/api/.env` y `apps/web/.env` están en `.gitignore` y siguen apuntando al stack local. Aun así,
conviene rotar la contraseña y la `service_role` desde el panel una vez enlazado todo.

### 3. Guardar el `.pen`
Los dos frames de escena están sincronizados con lo construido (pestañas en la barra negra, Reserva en la cabecera
blanca, barras dentro del lienzo, lienzo a todo el alto). **Falta el Cmd+S**, que sólo puede dar el dueño.
Las otras pantallas de Mesa siguen enseñando el chrome viejo: la causa es que la barra de plataforma y las pestañas
están **copiadas** en cada frame en vez de ser un componente. Convertirlas en componente lo arregla de raíz.

### 4. Validar light/dark
Sigue pendiente de la rebanada 2 y ahora también de la 3.

## ⏳ Siguiente paso inmediato
1. **Variables de Vercel** (arriba) → el API revive → crear el proyecto web → probar `/health` y la app entera.
2. **Segunda prueba manual** contra hosted, con las tres cuentas. Ojo: la base hosted está **vacía** (no se cargó
   `seed.sql`), así que hay que registrar el primer usuario y darle rol admin a mano.
3. **Rebanada 4 — movimiento máximo por turno**, configurable por sistema (toca el puerto `GameSystem` y
   `packages/core`; se lleva por delante la deuda de `METRES_PER_CELL`).
4. Rebanada 5 (galería de props) · `chat` (H8) + `journal` (H9) · `bestiary` (H5).

## 🗒️ Backlog (decisiones del dueño y deuda conocida)
- **Enseñar fotos sobre el mapa** (pedido del dueño, 2026-08-19, explícitamente **para otra sesión**): cargar una
  imagen y mostrarla a la mesa desde el menú del botón derecho. **No es el fondo del mapa**: el fondo es el plano de
  la escena; esto es enseñar algo puntual (un retrato, una carta, una pista) encima. Decidir si es efímero
  (broadcast, se cierra y desaparece) o una entidad más de la escena con su propia tabla y RLS.
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
### Vercel — el API existe y despliega solo, pero le faltan las variables (2026-08-19)
- Panel: https://vercel.com/ignaciozitare-9429s-projects/rolvium-api · `prj_0OBlHaNEmoDHOZVoEnFTV8hr4i70` ·
  team `team_O0LMo9mzgF91fZTJ1mJg7yJw`. **Está conectado a GitHub**, así que cada push a `main` lo redespliega.
- **https://rolvium-api.vercel.app** deja de ser un placeholder: es la URL real que consume `VITE_API_URL`.
- Devuelve 500 hasta que se pongan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (ver «Pendiente del dueño» §1).
- **El proyecto web no existe todavía.** `rolvium.vercel.app` → 404.
- **El token del CLI está caducado**, y el MCP de Vercel no sabe escribir variables de entorno: por eso este paso
  quedó en manos del dueño y no lo pudo cerrar el agente.

- **Supabase hosted YA está** (`scfspsiemikfcnqteonq`, org free). Queda por comprobar allí: que `postgres` puede
  borrar en `auth.sessions`/`auth.refresh_tokens` (los RPC de identity), y que `site_url`/redirects incluyan el
  dominio de Vercel (`/reset`, `/join/*`). `get_advisors` ya se corrió: 0 CRITICAL.
- **Para volver a tocar la base hosted**: el CLI de Supabase NO está autenticado, y el host directo
  `db.<ref>.supabase.co` no resuelve (IPv6). Lo que funciona es el pooler, usando el psql del contenedor local:
  `docker exec -i -e PGPASSWORD=… supabase_db_rolvium psql -h aws-0-eu-central-1.pooler.supabase.com -p 5432
  -U postgres.scfspsiemikfcnqteonq -d postgres -f - < migracion.sql`
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
