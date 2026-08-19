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
web **317** · api **77** · core 2 · system-plenilunio 62 · `typecheck` OK · `audit` **0 hard / 9 warn** ·
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

**Los seis nombres están comprobados contra el código** (2026-08-19), no contra estas notas: `apps/api/src/app.ts:58`
y `apps/web/src/shared/lib/{supabaseClient,api}.ts`. `ALLOWED_ORIGIN` se parte por comas, así que admite varias.

En **`rolvium-api`** (ya existe y está conectado a GitHub, así que despliega solo al hacer push):
```
SUPABASE_URL=https://scfspsiemikfcnqteonq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<el `sb_secret_…` del panel de Supabase — es lo ÚNICO que no puedo leer yo>
ALLOWED_ORIGIN=https://rolvium.vercel.app
```
En el proyecto **web** (aún NO existe: hay que crearlo apuntando al mismo repo, raíz del monorepo; `vercel.json` ya
está escrito con el build y el rewrite a `index.html`):
```
VITE_SUPABASE_URL=https://scfspsiemikfcnqteonq.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_M6SulfHCNvzQtjKagrJ4Hw_odrg-iZV
VITE_API_URL=https://rolvium-api.vercel.app
```
Hoy `https://rolvium-api.vercel.app/health` devuelve **500 `FUNCTION_INVOCATION_FAILED`** y los runtime logs dicen
literalmente `Missing required env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY`. En cuanto estén, revive solo.

### 2. Rotar credenciales
La contraseña de Postgres y las claves llegaron por el chat, y el repo es público. **Nada de eso está en git** —
comprobado: `apps/api/.env` y `apps/web/.env` están en `.gitignore` y siguen apuntando al stack local. Aun así,
conviene rotar la contraseña y la `service_role` desde el panel una vez enlazado todo.

### 3. Guardar el `.pen` — **Cmd+S pendiente**
Las **14 vistas de Mesa** están sincronizadas con lo construido, no sólo las de escena: conectados y pestañas en la
barra negra de la plataforma, Reserva de Destino en la cabecera blanca junto al sistema, y en las de escena además
las barras dentro del lienzo y el lienzo a todo el alto. Comprobado nodo a nodo (`Conectados@8`, `Pestañas@21`,
`Reserva de Destino` dentro de `Cabecera` en las 14), no mirando miniaturas.

**Frames de escena, 6, cada uno con un estado distinto y nombrados por él** (fila `y=9960`):
`uXK3T` niebla y pincel · `vz19f` jugador · noche · `h3Q3NN` herramienta Muro · `sFipl` seleccionar y editar ·
`yZDqm` y `ORZJD` (los dos de la rebanada 1, duplicados exactos de los dos primeros — se pueden borrar cuando el
dueño lo diga; no los borro yo por mi cuenta después de haberme pasado una vez).

**Deuda de raíz**: la barra de plataforma y las pestañas están **copiadas** en cada frame en vez de ser un componente
reutilizable. Por eso cada cambio de chrome hay que repetirlo 14 veces y por eso las vistas se desincronizan. Antes
del próximo cambio de chrome, convertirlas en componente (`Shell/TopBar` ya existe para el chrome de plataforma).

### 4. Validar light/dark
Sigue pendiente de la rebanada 2 y de la 3, y ahora también del **disco de abrir**: oro (`--sys-gold`) cerrado y
`--sys-paper-hi` abierto, con el trazo en `--sys-ink`, en los dos temas; más el texto nuevo de la barra «Segmento»
en ES y EN.

## ⚠️ Incidente de la madrugada (leer antes de tocar la base)
**Rompí la creación de campañas en la base hosted y lo cazó el Review.** Queda escrito porque el fallo es sutil y
tiene enseñanza:
- `20260819010000_harden_functions` trató a `campaigns_new_code()` como función de trigger. **No lo es**: es el
  `DEFAULT` de `campaigns_campaigns.invite_code`. PostgreSQL evalúa los DEFAULT **con los privilegios de quien
  inserta** y comprueba el EXECUTE, así que quitárselo a `authenticated` reventaba todo `insert` de campaña desde el
  cliente con `permission denied for function campaigns_new_code`.
- La misma migración creía revocar los helpers de permisos a `anon` y **no revocaba nada**: `REVOKE … FROM anon`
  sólo quita la concesión explícita, no la que Postgres da a `PUBLIC`. Hay que revocar `FROM PUBLIC`. El mismo error
  estaba ya en `20260817000000_core_users_roles.sql:127-130`.
- Arreglado con `20260819020000_fix_function_grants`, **aplicada en hosted y en local**, y verificado a mano
  ejecutando `campaigns_new_code()` con `SET ROLE authenticated` (devuelve código) y comprobando
  `has_function_privilege` de los cuatro helpers. `get_advisors`: sin CRITICAL y sin nada expuesto a `anon`.
- Lo que sí era correcto: revocar EXECUTE a las funciones de **trigger** no las rompe — Postgres comprueba el EXECUTE
  al `CREATE TRIGGER`, no al dispararse. Verificado con un UPDATE real.

**Regla que sale de esto:** antes de tocar grants, comprobar `prosecdef` y si la función es DEFAULT de alguna columna;
«se llama sola» no equivale a «es de trigger».

## 📍 Sesión del 2026-08-19 — PRODUCCIÓN AL DÍA por fin, y el generador en arreglo

### Lo primero que hay que entender de esta sesión
**Producción llevaba dos días congelada.** `origin/main` seguía en `ee11a56` (18 de agosto), el commit de
handoff de ANTES de construir la rebanada 2 de maps: las tres últimas sesiones vivían en `feat/maps-slice-2`,
sin pushear. Todo lo que el dueño «probaba en producción» era código viejo — de ahí que el generador hiciera
cosas ya arregladas y que no hubiera nada de la escena. **Mergeado y desplegado**: `main` = `384fe96`,
https://rolvium.vercel.app y https://rolvium-api.vercel.app/health responden, y el bundle de producción lleva
`mp-rail-add` (comprobado, no supuesto). Lección: comprobar `git log origin/main` ANTES de diagnosticar
cualquier «esto está roto en producción».

### Arreglado hoy en `feat/maps-slice-2` (ya en `main`)
- **Cero escenas dejaba al director sin forma de crear la primera.** El rail es el único sitio con «+ Escena»
  desde la rebanada 3, y se pintaba con `isDm && scenes && live`: sin escena no había rail. El cartel «crea la
  primera escena» pedía justo lo que la pantalla no dejaba hacer. El diseño lo tenía bien desde el principio
  (`sFipl` → `Escenas rail` → `Nueva`). Ni Review ni QA lo cazaron: sólo aparece con CERO escenas, que ninguna
  prueba cubría. Ahora hay test, y otro de que el jugador NO ve el rail.
- Rebanada 3 de maps cerrada, arreglos del generador, `optionVetoed`, `rowKey` también en `TableField`.

### En marcha: rama `fix/generator-gifts` (3 commits, Review pasado, QA en curso)
Sale de que el dueño probó el generador con la versión buena. Los tres arreglos:
- **El paso de Dones era un callejón.** `giftTrade` gasta puntos de CREACIÓN pero el presupuesto que guarda el
  paso es el DE DONES —y canjear sólo lo sube— así que el guardia decía que sí siempre. Con 10 canjes son 23
  puntos de don y, con el tope de nivel 5, hacen falta 5 dones para gastarlos: con 3 filas «Continuar» no se
  encendía nunca. Ahora el techo del canje es lo pagable (sólo se capa la SUBIDA: un borrador en rojo tiene que
  dejarse reparar). Y `canAdvance` avisa de los puntos de creación en rojo PRIMERO.
- **Un don no se repite** (era nivel 6 por la puerta de atrás). Ojo con el efecto colateral que cazó el Review:
  una fila en blanco toma la PRIMERA opción del select, así que el veto de duplicados dejaba muerto el
  «+ Añadir» desde el segundo clic. `ListField` ahora propone la primera variante que el guardia acepta.
- **El cupo de especialidades se aplica AL ELEGIR** (RULES.md §1.3), en los DOS pasos que listan las
  características — el de Características también las pinta.

### Lo que el dueño pidió y NO está hecho
- **Faltan 4 de las 6 vistas del generador en `rolvium.pen`**: sólo están `GjeeD` (Características) y `kB8pn`
  (Dones). Concepto, Especialidades, Destino y Resumen nunca se diseñaron, y se nota.
- **Características y Especialidades se ven igual**: el campo `stat` arrastra sus desplegables de especialidad
  a cualquier paso que lo liste. Es deuda de pantalla; se resuelve en el `.pen`, no con un parche.
- **El paso de Destino no se entiende**: enseña un `- 3 +` pelado. No dice que empieza en 3, que va de 1 a 5,
  que cada +1 cuesta un punto de característica y devuelve uno al bajar, ni —lo más importante— que **el
  Destino ES tu número de puntos de don**.
- Columna de ayuda a la derecha, leyenda del Continuar legible, tipografía general más oscura.

### El `.pen` (guardado por el dueño, commit `c7a99ae`)
- Las 14 copias de `Rolvium Bar` son ya instancias de **`Shell/TableBar`** (`njHz3`) con las pestañas como
  `slot`. Al hacerlo salió que **12 de las 14 tenían el orden mal** (Conectados suelto a la izquierda); las
  correctas eran las dos que parecían raras, que son las que coinciden con `TablePage.tsx`.
- **La cabecera ya no se solapa.** Causa: fila horizontal `space_between` con hijos de 1583 px en 1408 → Pencil
  reparte el déficit como hueco NEGATIVO. Arreglado como lo hace la web (`min-width:0` + `overflow:auto`): fila
  con hueco y la Reserva en su propio contenedor con recorte.
- Seis vistas de Escena igualadas a 1440×1130; fuera los 13 `Reserva Wrap` vacíos.
- ~~⚠ PENDIENTE: el ancho de los 14 frames de Mesa~~ — **CERRADO** (2026-08-19 noche): el dueño dice que en
  producción se ven bien y no se toca. El desajuste 1486 vs 1420 se queda en el `.pen` como está.

## 📍 Sesión del 2026-08-19 (tarde-noche) — rama cerrada y desplegada, y el generador diseñado entero

### Lo que se cerró y está en producción
`main` = **`c2460da`** (merge de `fix/rules-audit`, Review + QA pasados). Dieciséis commits.

- **Reglas contra el PDF.** El Destino se capa AL ELEGIR (base 3, 1–5 al crear, p.23). El canje de dones a
  máx. 2, el segundo asumiendo permiso del DJ — ⚠ interpretación declarada: p.25 NO lleva cláusula, y se lee
  calcado a especialidades (p.23), donde sí es literal. **El Review cazó un error factual del diff**: decía
  en tres sitios que el libro no pone techo al Destino, y **sí lo pone** (p.88, «entre 1 y 10»). El `max: 10`
  del esquema es regla del manual, no validación inventada.
- **El tope del canje rige las DOS lecturas** (hallazgo del QA): `budgetOf` recortaba y `derived()` usaba el
  valor crudo, así que una ficha guardada con 3–10 canjes iba a enseñar puntos de don inflados para siempre.
  Decisión del dueño: **capar también en `derived`**, no indultar. `MAX_GIFT_TRADES`/`MAX_SPECIALTY_TRADES`
  se mudan a `catalogs.ts` porque `engine.ts` no puede importar del generador sin ciclo.
- **Punto 12 acotado** (ver abajo).

Puertas: web 344 · api 77 · core 6 · plenilunio 70 · typecheck OK · audit 0 hard / 9 warn · build + build:api
OK · i18n 647 claves sin desajuste · advisors 0 ERROR · sondas de producción vivas de verdad.

### Punto 12 — el personaje YA SE GUARDA (dueño, 2026-08-19 noche). Causa raíz nunca identificada
**Cerrado por observación, no por diagnóstico.** El dueño confirma que ya se guarda. Empezó a funcionar
después del merge y el despliegue, y eso encaja con la sospecha que quedó viva —**sesión caducada**
(`PGRST301 JWT expired`) en la prueba larga de la tarde— pero **nadie llegó a leer el mensaje**, así que no
está demostrado. ⚠ Si vuelve a pasar, lo primero es leer el aviso: ya trae motivo, hint y código.

Lo que sí queda hecho y desplegado de aquí: el motivo de cualquier fallo de guardado ahora se ve.

### Cómo estaba antes (se deja escrito porque el fallo es sutil)
**El arreglo anterior (`a028692`) no funcionaba.** `setFailed(e instanceof Error && e.message ? … : true)`, y
**supabase-js no lanza `Error`**: sin `throwOnError`, el campo `error` de la respuesta es un OBJETO PLANO
`{message, details, hint, code}` (`postgrest-js` sólo construye su clase `PostgrestError` en la rama
`shouldThrowOnError`), y los repos hacen `throw error`. Ese `instanceof` descartaba justo los fallos de base,
que son los únicos que se dan ahí. Comprobado contra el stack local: nombre vacío →
`{code:'23514', message:'…violates check constraint "characters_name_check"'}` con `instanceof Error === false`.

Arreglado en `apps/web/src/shared/lib/errors.ts` (`DbError`, `dbError()`, `reasonOf()`), aplicado a los 9
`throw error` de `SupabaseCharactersRepo` y al catch del generador. El `hint` viaja dentro del mensaje porque
para un 42501 PostgREST mete ahí el GRANT literal que lo arregla.

**Lo que YA está descartado como causa** (probado con el cliente real, no leyendo código):
- login como director, RLS del insert, `owner_id NULL`, `kind 'pc'`, `created_by`;
- el SELECT con sus **dos embeds** (`campaigns_campaigns` y `users!characters_owner_id_fkey`) y el `.single()`;
- un borrador **completo salido del generador de verdad** (los seis `canAdvance` en verde, `finalizeDraft` +
  `engine.derived`, 773 bytes) — entra sin un error;
- la **caché de esquema de PostgREST en hosted** resuelve tabla y los dos embeds (sonda HTTP con la clave
  publicable: 200 en las cuatro consultas).

**Sospecha viva, sin confirmar**: sesión caducada (`PGRST301 JWT expired`) en una prueba larga — daría
exactamente «no se guarda y no dice nada». **Lo primero: crear un personaje y LEER el aviso, que ahora sí trae
motivo, hint y código.** Ojo: hasta este merge, producción no tenía el arreglo, así que un intento anterior
no habría dicho nada.

### ✅ Producción verificada contra el bundle (2026-08-19 noche)
No de memoria: descargados `index-*.css` e `index-*.js` de https://rolvium.vercel.app y grepeados.
- `tb-root-page` → **está** (CSS y JS): el scroll de la ficha en pestaña aparte está desplegado.
- `DbError` / `unknown_error` → **están**: el motivo legible del fallo al crear está desplegado.
- `MEJORAR` → **no está**, y es correcto: eso es diseño del `.pen`, todavía sin código.

**Lo que el dueño ve como «la hoja del jugador no se subió» es exactamente eso**: el rediseño de la ficha
vive sólo en `rolvium.pen`. Nunca se escribió como código — es el punto 5 del backlog de esta sesión.

### Deuda que dejó el QA, sin tocar
- **20 `throw error` crudos** fuera de `characters`: `SupabaseCampaignsRepo` (12), `SupabaseRoleRepo` (5),
  `SupabaseUserRepo` (3). Misma clase de fallo; rebanada propia o se deja.
- `GeneratorWizard.tsx:148` pinta el texto crudo de Postgres (sin i18n, con detalle interno). Decisión
  consciente para no volver a perder un personaje en silencio.
- `create` sigue ignorando el error del enlace a `campaigns_members`.
- RULES.md §1.5 marca «un don no se repite» como ⚠ interpretación, pero **p.89 casi lo dice**: al subir el
  Destino «recibe un nuevo punto para adquirir otro don **o aumentar la puntuación de uno que ya posea**».
  Se puede ascender a regla citada.

### 🎨 El `.pen`: los SEIS pasos del generador, construidos — ⚠ **SIN GUARDAR**
Fila `y=7860`, ahora en orden de paso y sin duplicados. **Los dos que existían se MOVIERON, no se copiaron.**

| x | paso | frame | Hoja/Generador |
|---|---|---|---|
| 0 | 1 Concepto | `fyIR5` | `NGlGX` |
| 1520 | 2 Características | `GjeeD` | `glSFU` |
| 3040 | 3 Especialidades | `vE82H` | `CIYdA` |
| 4560 | 4 Destino | `u4eNh` | `rbmLQ` |
| 6080 | 5 Dones | `kB8pn` | `GfYkv` |
| 7600 | 6 Resumen | `z5q8XR` | `GuDBo` |

Lo que resuelve, del backlog:
- **Las 4 vistas que faltaban** (Concepto, Especialidades, Destino, Resumen).
- **Características y Especialidades ya NO son la misma pantalla**: Características son números (−/+, reparto,
  derivadas) y **no enseña especialidades**; Especialidades enseña el valor en gris, sin controles, y sólo los
  chips + «+ Especialidad», con el contador de cambios «1 de 2».
- **El paso de Destino se entiende**: escala de 5 lunas con la activa grande, «AL CREAR, DE 1 A 5 · en juego
  llega a 10 (p.88)», la banda de equivalencia **«3 · PUNTOS DE DON — tu Destino ES tu número de puntos de
  don»**, y la tabla Destino / puntos de don / coste / qué significa.
- **Leyenda en cada paso**: banda dorada arriba con rótulo, página del manual y una frase de qué estás haciendo.
- **Columna de ayuda a la derecha**: el `Side` (272) deja de ser el registro de tiradas y pasa a ser **GUÍA**
  (`Hoja/Panel` de cada frame), en tres bloques — «en este paso», la descripción **al vuelo** de lo que señalas
  (con su página), y una nota. El botón «Lanzador de dados» queda `enabled:false` en el generador.
- **Contador legible y con el mismo significado en los dos pasos**: rótulo **«TE QUEDAN»**, el número grande es
  lo que queda, y el detalle dice de cuánto («de 21 del reparto · 18 ya repartidos» / «de 3 · tu Destino es tu
  número de puntos de don · 2 repartidos»).
- **Canje con su tope a la vista**: «0 de 2».

**⚠ EL `.pen` NO ESTÁ GUARDADO EN DISCO.** Sólo lo puede guardar el dueño con **Cmd+S** en la pestaña de
Pencil (no hay permiso de Accesibilidad para automatizarlo). Comprobar `ls -la rolvium.pen` y `git status`
antes de dar por hecho nada. Si se cierra sin guardar, se pierde toda la fila.

### Decisiones del dueño de esta sesión
- **El ancho de los 14 frames de Mesa: NO se toca.** «Se ven bien en producción, eso ya está.» El desajuste
  1420 vs 1486 se queda como está; cerrada la pregunta.
- **El interruptor del director SÍ va como opción de campaña**, y gobernará LOS DOS canjes (dones y
  especialidades). Es su propia rebanada: migración + panel del director + guardia. No entra en este lote.
- **Claro/oscuro**: mergear ya y mirarlo en producción; la rama no tocaba ningún token de color.

### 🎨 La FICHA en el `.pen` — hecha, y con una sorpresa
Trabajado sobre `qjLDu` (ficha de la Mesa, dentro de `zt5B6`) y **sincronizada** a `g6RyaZ` (ficha en ventana
aparte, `PiVhB`): las seis tarjetas de la Mesa se copiaron encima y se borraron las siete viejas, que eran el
mismo diseño desactualizado. Ya no hay dos fichas divergiendo.

**Lo que se rediseñó:**
- **#10 Reordenada.** Armas sube a su propia card a todo el ancho; **Dones · Equipo · Armadura** quedan en una
  fila de tres creciendo a la vez.
- **Resistencia invertida al derecho (p.25).** Antes se pintaban en negro las casillas que te quedaban y al
  recibir daño se despintaban — justo al revés del libro. Ahora **en blanco = lo que te queda** y las tachadas
  con una equis son el daño, con la cuenta «17 en blanco de 21».
- **#5 «Lo de recibir daño no lo entiendo».** Bloque propio que lo explica en dos frases (se resta la
  protección, el resto tacha casillas de izquierda a derecha; cada múltiplo del Aguante baja un nivel de
  salud) y la cuenta hecha al lado del botón: «5 − 1 de protección = 4 casillas tachadas».
- **Estado ya ocupa el ancho**: las filas de salud y de Destino/Fortuna/Experiencia se reparten en vez de
  dejar el hueco de la derecha. Fortuna dice «2 de 2 sin gastar» en vez de dos cuadros mudos.
- **#4 Equipo con «+» de verdad**: desplegable abierto con buscador, opciones del catálogo y «…o escribe una
  tuya». Sin lunas por fila.
- **#9 Tooltip con cuerpo**: 300 → 360 px, texto 12 → 13,5, y la especialidad pasa a bloque propio con rótulo
  dorado y una explicación que dice lo que importa — **el dado extra lo da la especialidad, no el arma**.
- **#3 Leyenda por dado** en la card de Armas: 1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo (p.82), con los
  dados dibujados y la nota de que a distancia el arma NO da dados extra.
- **#13 «Mejorar» fuera de las pestañas**: la pestaña queda apagada y el botón se suma a la cabecera de la
  ficha, junto a **EDITAR** y **ABRIR FICHA APARTE**.
- **Contraste (las letras que no se leen).** Medido, no opinado: `tx3` estaba en **2,79:1** en claro y
  **3,44:1** en oscuro, por debajo del mínimo de 4,5:1, y se usa en textos pequeños. Ahora `#67605a` (5,52:1)
  y `#8f87a0` (5,43:1). `pl-tinta-tenue` de 4,52 a **5,61:1** (`#55534c`). Y **`pl-oro` sobre fondo oscuro
  daba 3,95:1**: el rótulo del tooltip salía invisible, así que hay `pl-oro-claro` `#c9a44e` (7,89:1) para
  superficies oscuras. **Falta portarlo a `apps/web/src/RolviumApp.css`** — es un cambio de tokens, afecta a
  toda la app y va con su propia ronda de review.
- **Fallo del `.pen` arreglado de paso**: la **Reserva de Destino de la Mesa del jugador estaba anidada dentro
  de la cabecera de la card de Armas**, aplastando los rótulos de columna. Movida a la `Cabecera` de la mesa,
  con su envoltorio de recorte y su botón de plegar, como en la del director. La comprobación «Reserva dentro
  de Cabecera en las 14» daba falso positivo porque casaba por nombre.

### ⚠️ Cinco puntos del QA del dueño NO eran de diseño: el `.pen` ya estaba bien y es el código el que diverge
Comprobado nodo a nodo, no supuesto. **No hay que rediseñar nada de esto; hay que arreglar la web:**
1. **#7 Cargador sólo en armas a distancia** — el diseño ya pinta «—» en el Bate. La tabla de la web pinta la
   columna para todas las filas.
2. **#8 Un solo botón por arma** — el Bate ya tiene sólo ⚔ (`swords`) y el Revólver sólo ◎ (`my_location`).
3. **#2 Munición** — el Revólver ya lleva su «6/6» con el icono de recargar al lado del botón.
4. **#11 Registro de tiradas dentro de la ficha** — en el `.pen` **no existe**, ni en `qjLDu` ni en `g6RyaZ`.
   Es un añadido del código.
5. **Cards sin borde y con sombra** — `PL/Hoja` (`LtIYz`) ya es `fill #f2f0ea80`, sin borde y con dos sombras.

## 📜 Aventuras (H12) — spec cerrado, nada construido (2026-08-19)
`specs/modules/adventures/SPEC.md`. El director escribe aventuras dentro de la campaña; cada una con su
documento, sus escenas y sus encuentros. Decidido por el dueño:
- **Toda campaña tiene aventuras** (la migración crea «Aventura 1» y le cuelga las escenas que ya haya);
  `maps_scenes` gana `adventure_id`, nullable → relleno → NOT NULL. Borrar una aventura NO borra escenas.
- **Tablas de PNJ y encuentros como texto enriquecido en v1**; cada fila lleva `npcId` siempre null, que es
  el hueco para que el Bestiario (H5) enlace sin migrar documentos.
- **Sección propia en la cabecera de plataforma**, rail lateral de aventuras a lo OneNote, y **abrible en
  ventana aparte** como la ficha. ⚠ La página suelta no puede heredar `.tb-root` (`height:100dvh;
  overflow:hidden`) o se queda sin scroll — ya pasó con la ficha.
- **Guarda solo**, sin botón; `Cmd+S` fuerza.
- El documento es **JSON de bloques, no HTML**: se pinta desde el cliente, nunca se inyecta como marcado.
- RLS sólo para el director y el admin: al jugador la fila no le existe.

**Siguiente paso del flujo: dba → scaffold → design (`.pen`) → dev → review → qa.** No hay ni una línea.

### La regla que sale de aquí, y a quién señala
**El contenido vive en la BASE, nunca hardcodeado en el front** — aventuras, personajes, encuentros. El
dueño lo quiere así también para poder llegar a ellos desde fuera algún día (un MCP, Drive, una IA que los
lea). Personajes, campañas, escenas y tiradas ya cumplen. **Los textos de reglas del sistema NO**: los
tooltips y referencias de Plenilunio viven en `packages/system-plenilunio/src/{references,locales}.ts` y se
compilan en el bundle, así que una errata exige tocar código y desplegar (comprobado: cero tablas de textos
en las migraciones). Rebanada propia y hay que pensarla: choca con «el paquete del sistema es enchufable y
trae sus reglas», así que lo más probable es mixto — el paquete pone los textos por defecto y la base guarda
sólo las correcciones, por sistema e idioma.

## ✅ Primera tanda del rediseño de la ficha — EN PRODUCCIÓN (2026-08-19 noche)
`main` con `fix/ficha-diseno` mergeada (Review + QA pasados, cinco commits). Comprobado contra el bundle
desplegado, no de memoria: el CSS nuevo trae `rv-sheet-box.hit` y el JS trae `tx-off`.

- **Resistencia al derecho** (p.25): en blanco lo que queda, dañadas en bordó (`--sys-blood`), la última
  devolvible. ⚠ El Review corrigió el razonamiento: en la hoja impresa hay TRES estados (sombreado = las
  que no tienes de las 30 impresas · blanco = tu Resistencia · tachado = daño); lo que autoriza el cambio
  digital es «para poder tacharlos durante el juego», porque en pantalla se pintan exactamente
  `resistanceMax` casillas y el sombreado no existe. En RULES.md.
- **Bug que se coló y cazó el Review**: los clics se contaban contra `max` y no contra las casillas
  pintadas, así que una ficha con `resistance > resistanceMax` llegaba a Resistencia **negativa** y perdía
  el deshacer. Test de los tres bordes.
- **Armas a todo el ancho · Dones · Equipo · Armadura en fila · Estado con `span: 2`** (`SectionDef.span`
  nuevo, declarado por el SISTEMA: el kit no puede saber que Estado pide más sitio).
- **Contraste**: `--tx3` de 3,60→5,69 (oscuro) y 2,68→5,30 (claro); `--sys-ink-dim` 4,52→5,61.
  **`--tx-off` aparte para «desactivado»**: subir `--tx3` a secas acercaba activo y desactivado de 4,36:1
  a 2,76:1 y un control vetado se veía MENOS vetado — regresión mía, hallazgo del QA.

**Decisiones del dueño**: claro/oscuro se mira en producción · **no se estrechan las cards para 1280 px**
(«un portátil de 1280 es algo muy viejo, me da igual»); con 340 de mínimo hacen falta ~1350 px en la Mesa.

### Lo que queda de la ficha, sin hacer
Cargador sólo en armas a distancia · un solo botón por arma (⚔ o ◎) · munición al disparar · fuera el
registro de tiradas duplicado · Equipo con «+» desplegable · tooltip de recibir daño · tooltip de
característica con cuerpo · leyenda por dado · «Mejorar» fuera de las pestañas. Todo está diseñado en el
`.pen`; es llevarlo a código.

### Deuda que dejó el QA
- `.rv-sheet-box:disabled` sólo cambia el cursor, sin `opacity`: en solo lectura las casillas parecen
  pulsables. Mismo caso en `.rv-sheet-health-opt`. Es cambio visual → pasa antes por el `.pen`.
- `--sys-gold` sobre `--sys-paper-hi` da 4,03:1 en `.rv-sheet-btn.gold`, y como texto sobre card 3,17:1.
  El `.pen` ya tiene `pl-oro-claro` `#c9a44e`; el código no, a propósito, hasta que entre con consumidores.
- `audit.mjs` no detecta `var()` con fallback **anidado** (`var(--x,var(--y))`): cuatro casos en
  `DateRangePicker.tsx`. Fallo del comprobador determinista, no del código.
- `table.css:5` sigue duplicando en hex la paleta de Plenilunio bajo el nombre «neutral defaults».
- `specs/modules/system-plenilunio/SPEC.md:33` lista el orden viejo de secciones — se actualiza ahora que
  ya está desplegado.

## 🗒️ Backlog (decisiones del dueño y deuda conocida)

### Últimos cuatro del dueño (2026-08-19, tarde)
12. ~~**Un personaje creado no aparece**~~ → **NO SE GUARDA**. **(2026-08-19 noche: el motivo ya se lee — ver «Punto 12» arriba; causa raíz aún abierta.)** El dueño lo precisó: salió de la campaña, volvió
    y no estaba. La base NO es el problema: probado el insert exacto bajo RLS como director, con `owner_id NULL`
    y `kind 'pc'`, y entra. Lo que había era que **el generador se tragaba el error** (`catch { setFailed(true) }`),
    así que un fallo de guardado era indistinguible de que no hubiera pasado nada. **Ya se ve el motivo**
    (commit `a028692`): el estado de fallo guarda el mensaje y se pinta. **La causa raíz sigue sin identificar** —
    lo primero del chat nuevo es crear un personaje y LEER lo que dice ese aviso.
    (Redacción original, por si sirve: no aparecía ni en `/characters` ni en «Colocar PJ» del mapa.) Revisado el código y
    **debería aparecer**: `CharactersPage` lista `listMine()` + `listByCampaign()` de cada campaña mía y filtra
    los `isUnassigned`; el mapa usa `listByCampaign().filter(kind === 'pc')`. La RLS tampoco lo tapa (el
    director ve todo lo de su campaña). Sospechas por orden: que la campaña no salga en `campaigns.listMine()`
    para ese usuario, o que la creación fallara en silencio. **Sin reproducir. Hay que crear uno y mirar la
    fila en la base ANTES de tocar código.**
13. **«Mejorar» no debe estar en la barra de pestañas**: va como botón dentro de la ficha, al lado de «Editar»
    y «Abrir ficha aparte». → `.pen`
14. **Multiidioma: existe, pero no dentro de la Mesa.** El conmutador ES/EN vive en `UserMenu` (menú del avatar)
    y en `/account`. Pero `TablePage` pinta un `UserAvatar` pelado, **no** el `UserMenu`: dentro de la mesa no
    hay forma de cambiar de idioma. Por eso «desapareció».
16. **Armadura y escudo a la vez.** Hoy `armour` es un select único y los tres escudos son filas de la
    misma tabla, así que o llevas armadura o llevas escudo. El dueño quiere las dos. **El manual no lo
    resuelve**: p.98 mete los escudos DENTRO de la tabla de Armadura con sus dos columnas (pequeño 1/–,
    grande 2/1, antidisturbios 3/2), las fichas de PNJ del libro listan el escudo aparte y con protección
    propia («Espada 10 (daño 9), escudo (protección 5)», Azelías p.133–134; la Égida es «un escudo de
    protección 4», p.160), y **en ningún sitio dice que puedas llevar ambos ni cómo se sumarían**.
    Decisión: **sumar las dos columnas** —protección + protección, penalización + penalización— porque es la
    única lectura que no inventa ningún número. Va a RULES.md como ⚠ interpretación con las citas. **Sin
    implementar**: hace falta un campo de escudo aparte en el esquema y que `derived()` sume ambos.
17. **Los textos de reglas viven en el front, no en la base.** Ver «Aventuras · la regla que sale de aquí».
15. **A distancia y cuerpo a cuerpo usan la MISMA característica (Combate)** — matiz que el dueño preguntó. Lo
    que cambia es el tipo de tirada: a distancia es un **reto** contra la dificultad del alcance y el arma no
    suma dados; cuerpo a cuerpo es un **conflicto enfrentado** y ahí sí suma la bonificación (p.96–97).


### QA del dueño sobre la ficha (2026-08-19, tarde) — 11 puntos, 3 hechos
Marcados los que el **libro** resuelve (verificado en el PDF) y los que son pantalla (→ `.pen` antes que código).
**Actualizado 2026-08-19 noche:** la rama `fix/ficha-diseno` cierra el punto 10, la Resistencia invertida y el
contraste de los rótulos. El resto sigue igual. Ver «Primera tanda del rediseño de la ficha» al final.

1. ~~**La ficha en pestaña aparte no scrollea**~~ — **HECHO** (`a028692`), con test. Causa: `CharacterSheetPage` usa `className="tb-root"`,
   y `.tb-root` lleva `height:100dvh; overflow:hidden` — que existe para que la ESCENA no scrollee (el mapa se
   comía el alto). La página suelta hereda esa regla y se queda sin scroll. Necesita su propia clase.
2. **Disparar tiene que gastar munición.** El libro trae columna «Cargador» por arma (p.97) y recargar es una
   acción que consume dados de Combate (p.96–97). ⚠ interpretación: el libro no fija cadencia, así que
   1 disparo = 1 bala es lectura nuestra.
3. **Los dados de ataque necesitan leyenda por dado**: 1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo (p.82).
   Hoy sólo sale el texto de grado de éxito.
4. **Equipo como lista de verdad**: un «+» que abre desplegable y añade. Fuera las lunas por fila. → `.pen`
5. **«Lo de recibir daño no lo entiendo».** → `.pen`
6. **El generador necesita leyendas en cada paso**: qué es, qué estás haciendo y cómo repartir. → `.pen`
7. **Las armas cuerpo a cuerpo no llevan munición. LO DICE EL LIBRO** (p.97): toda arma c/c tiene «-» en
   Cargador. Los datos ya están bien (`cargador: null` en las nueve de c/c); es la TABLA la que pinta la
   columna para todas las filas. Sale «Cargador 0» en unas Nudilleras.
8. **Los dos botones (⚔ y ◎) en todas las armas: SÍ es de reglas, y lo tenemos mal.** Son acciones distintas:
   - **A distancia** = *reto* contra la dificultad del alcance (corto Media 2 · medio Difícil 3 · largo Muy
     difícil 5 · muy largo Épica 6, p.96) y **el arma NO da dados extra**: «al contrario de lo que ocurre en el
     combate cuerpo a cuerpo, las armas no proporcionan dados extra en este tipo de combate: sin ellas
     simplemente no se puede atacar a distancia» (p.96).
   - **Cuerpo a cuerpo** = conflicto enfrentado, y ahí **sí** aplica la bonificación: «la bonificación de Combate
     solo se aplica en alcance cuerpo a cuerpo» (p.97).
   Así que cada arma debe ofrecer **sólo su acción**. Ya estaba anotado como «iconos ⚔/◎ por tipo de arma».
9. **Tooltip de característica: sale un segundo tooltip que no debería**, y debe explicar la especialidad como
   dice el diseño, con más cuerpo porque no se lee. → `.pen` + bug de tooltip.
10. ~~**Dones, Equipo y Armadura, uno al lado del otro**, creciendo a la vez; Armas en su propia card y las otras
    tres debajo.~~ — **HECHO a medias** (`bffc7b2`): `armour` baja detrás de `equipment` y pasa a `stack`, y el
    grid de `.rv-sheet` baja de 420 a 340 de mínimo. ⚠ **Sólo se cumple a partir de 1052 px de ancho
    disponible** (3×340 + 2×16 de gap). En la Mesa el ancho útil es `viewport − 298` (24 de padding de
    `.tb-table` + 264 de `.tb-side` + 10 de gap), así que hacen falta **≥1350 px de viewport**: en un portátil
    de 1280 salen dos columnas y Armadura se queda sola, que es justo lo que se quería evitar. En «ficha
    aparte» (sin `.tb-side`) sí caben las tres a 1280. Medido por QA, 2026-08-19.
11. **Fuera el registro de tiradas de la ficha**: ya está en la barra de tiradas. Duplicado.


### Ficha y generador — prueba del dueño en producción (2026-08-19, tarde). NADA de esto está hecho
Cinco de los siete son trabajo de **pantalla**: por la regla del dueño van al `.pen` ANTES que al código.

- **Características y Especialidades siguen siendo la misma pantalla.** No es un bug de reglas: el campo `stat`
  arrastra sus `itemFields` (los desplegables de especialidad) a **cualquier** paso que liste las características, y
  los dos pasos las listan. Lo que se elige en uno se ve en el otro porque **es el mismo campo**. Se arregla
  decidiendo en el diseño qué enseña cada paso, no con un parche.
- **El paso de Destino no dice qué hay que hacer.** Enseña un `- 3 +` pelado. Falta: empieza en 3, va de 1 a 5, cada
  +1 cuesta un punto de característica y cada −1 devuelve uno, y —lo que más importa— **el Destino ES tu número de
  puntos de don**. Sin vista en el `.pen`.
- **Descripciones al vuelo, pedidas más de una vez y aún sin hacer**: al pasar por encima de una opción (un don, una
  especialidad, una característica) debe decir qué es, y al elegirla debe quedar **en la columna de la derecha**.
  Los datos YA existen: `catalog.gifts.<id>.summary` y `references` (clave → página + resumen propio). Falta la UI.
  El **glosario por característica ya está diseñado** en `GjeeD` y nunca se construyó.
- ~~**Las letras siguen sin leerse.**~~ — **HECHO** (`bffc7b2`) para el token que más dolía: `--tx3` (rótulos y
  notas pequeñas) y `--sys-ink-dim`. Afecta a TODA la app. ⚠ Queda vivo el dorado: `--sys-paper-hi` sobre
  `--sys-gold` da **4,03:1** en `.rv-sheet-btn.gold` y `.rv-sheet-icon-btn`, y `--sys-gold` como texto sobre la
  card da **3,17:1** (`.tb-btn-gold`) — los dos por debajo de 4,5:1 y en pantalla hoy. El `gold-hi` `#c9a44e`
  (7,89:1) existe en el `.pen` como `pl-oro-claro` pero **no** en `theme.ts`: se retiró a propósito en `2a22c09`
  porque no tenía consumidores. Entra con ellos, en el mismo commit, y sólo para fondo oscuro (sobre `paper` da 1,72:1).
- **Las cards van sin borde y con sombra** (así está en el diseño); en producción no tienen sombra.
- **Estado deja un hueco en blanco a la derecha**: tiene que ocupar el ancho que queda y reordenar sus componentes.
  ⚠ **Sigue abierto y el cambio de 340 no lo arregla** (QA 2026-08-19): con tres columnas las secciones anchas
  (`identity` por el avatar, `roll` y `creation` por `layout:'row'`, `weapons` y `story` por sus campos) cortan
  la fila, y `stats` · `state` dejan la tercera celda vacía. Antes, con dos columnas, el hueco caía detrás de
  `armour`; ahora cae detrás de `state`. Se ha movido, no se ha cerrado.

### ~~Resistencia — la casilla está INVERTIDA respecto al libro (p.25)~~ — HECHO (`bffc7b2` + `2a22c09`)
**Cerrado en `fix/ficha-diseno`.** En blanco = lo que te queda, marcada en bordó (`--sys-blood`) = daño, el daño
por delante y de izquierda a derecha, y la última marcada se devuelve al pulsarla. `RULES.md` recoge la lectura
del libro y la ⚠ interpretación de la ficha digital (no hay estado *sombreado* porque se pintan exactamente
`resistanceMax` casillas). El segundo commit arregla además que los clics se contaban contra `max` en vez de
contra las casillas pintadas, lo que daba **Resistencia negativa** en una ficha con `resistance > resistanceMax`.
Sigue vivo el aviso ⚠ de abajo sobre el «6 de 24» — no se ha reproducido.

Texto original, para contexto:
El libro dice: «sombrea los puntos **sobrantes** y deja los cuadrados **en blanco** correspondientes a tu
Resistencia **para poder tacharlos durante el juego**». O sea: en blanco = la Resistencia que te queda, y se van
**tachando** según recibes daño. Hoy el kit pinta en negro las `val` primeras casillas, con `val` = Resistencia
actual: un personaje sano sale **todo negro**, y al recibir daño se va **despintando**. Justo al revés.
- Afecta a `packages/ui/src/components/Sheet.tsx` (campo `boxes`) y a su CSS. Es el único campo `boxes` del
  esquema, así que el cambio está contenido — pero es interacción, no sólo color: hay que decidir qué hace un clic.
- ⚠ **Aparte y sin confirmar**: en la captura del dueño un personaje recién creado marca «6 de 24», y 6 es
  justo el valor de la ficha en blanco (`newSheet`). `finalizeDraft` pone `resistance = resistanceMax` y el wizard
  lo usa, así que o esa ficha no pasó por ahí o el patch no se guardó. **Reproducir antes de tocar nada.**


### Maps — pedidos del dueño 2026-08-19 (sin spec ni diseño todavía)
- **Rejilla más fina**, para poder cuadrar los muros con el plano que se pone de fondo. Hoy `grid.size` sale a 27 px
  y sólo se ajusta por escena; el dueño quiere un paso menor (y probablemente un control, no un valor fijo).
- **Deshacer / rehacer** con `Cmd/Ctrl+Z` y `Shift+Cmd/Ctrl+Z`, **con sus iconos en la barra**. Hoy NO existe nada:
  cada acción va directa al repo (`st.addWall`, `addDrawing`, `removeToken`…). Necesita una pila de comandos en
  `useScene` con su inverso, y decidir qué entra (¿mueve de token ajeno? ¿pincel de niebla?) y si es por usuario.
- **Muros a mano alzada y muros circulares**, cada uno **su propio botón**, sin tocar el de muro recto. La tabla
  `maps_walls` guarda segmentos `a→b`, así que un trazo libre son N segmentos: decidir si se guarda como polilínea
  (columna nueva) o como N filas hermanas con un id de grupo — afecta a Seleccionar, a borrar y a la visión.
- **GIFs animados** sobre el mapa. Hoy el bucket `backgrounds` sólo admite `image/png|jpeg|webp` y los tokens pintan
  con `<image>`; hay que decidir bucket, tipos permitidos y si un GIF es fondo, token o «enseñar foto» (ver abajo).
- ~~Toggle de «ver como jugador»~~ — **YA EXISTE**, `playerView` en `CanvasControls` (i18n `maps.playerView`).
  El dueño no lo veía porque producción iba dos días atrasada.

### Generador de dones — lo que vio el dueño el 2026-08-19 (aún sin arreglar)
- **El canje de dones no comprueba que puedas pagarlo.** El `+` de `giftTrade` sólo lo frena el `max: 10` del
  esquema: el guardia del paso mira el presupuesto **de dones**, y canjear lo *sube*, así que siempre pasa. Con 10
  canjeados tienes 23 puntos de don y, con el tope de nivel 5, hacen falta **5 dones** para gastarlos — con 3 filas
  es imposible avanzar y el error sólo dice «reparte los puntos restantes», sin señalar el canje.
- **El contador del paso es ilegible**: Dones pinta `restantes` grande y `total` pequeño; Características pinta
  `total/gastados`. Dos significados con la misma forma.
- **Nada impide dos filas del mismo don.** Por el libro un don tiene un nivel 1–5; dos filas de «Alegoría» a 3 son
  un nivel 6 por la puerta de atrás. Falta unicidad (en `canAdvance` y en el desplegable).

- **Enseñar fotos sobre el mapa** (pedido del dueño, 2026-08-19, explícitamente **para otra sesión**): cargar una
  imagen y mostrarla a la mesa desde el menú del botón derecho. **No es el fondo del mapa**: el fondo es el plano de
  la escena; esto es enseñar algo puntual (un retrato, una carta, una pista) encima. Decidir si es efímero
  (broadcast, se cierra y desaparece) o una entidad más de la escena con su propia tabla y RLS.
- **Decidir**: el bucket `backgrounds` es de lectura pública como `avatars`/`tokens` (cualquiera con la URL ve un mapa no
  revelado) · límites duros de escenas/tokens/trazos (hoy sólo orientativos en el spec).
- Maps: con **Medir**, un clic sin arrastrar deja una medición de longitud cero en pantalla hasta que se cambia de
  herramienta (preexistente; lo notó QA al mirar el disco, que también se puede pulsar con Medir).
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

## 🔁 Prompt para el chat nuevo
> Retomo Rolvium: lee WORK_STATE.md y ARCHITECTURE.md. Producción al día; `main` lleva la rama
> `fix/rules-audit` mergeada (Review y QA pasados), el `.pen` con el generador Y la ficha ya guardado
> por el dueño y commiteado, y el spec de **Aventuras (H12) cerrado sin construir**.
> **Comprueba `git status` y `ls -la rolvium.pen` antes de dar nada por hecho.**
>
> El diseño de la tanda está HECHO (6 pasos del generador en `y=7860`; ficha `qjLDu` sincronizada a
> `g6RyaZ`). Ahora toca CÓDIGO, en este orden:
>
> 1. **Punto 12 — el personaje no se guarda.** Crea uno y LEE el aviso: ya trae motivo, hint y
>    código. Descartados con el cliente real: RLS, los dos embeds, `.single()` y un borrador completo
>    del generador. Sospecha viva: sesión caducada (`PGRST301`).
> 2. **Los cinco puntos que NO eran de diseño** (sección con ese título): cargador sólo en armas a
>    distancia, un solo botón por arma (⚔ o ◎), munición al disparar, fuera el registro de tiradas de
>    la ficha, y cards con sombra sin borde. El `.pen` ya lo dice bien; diverge la web. Son los más
>    baratos y se ven enseguida. Ojo: la munición es la única con carga de reglas (1 disparo = 1 bala
>    es lectura nuestra; recargar consume dados de Combate, p.96–97).
> 3. **Tokens de contraste** a `apps/web/src/RolviumApp.css`: `tx3` → `#67605a` claro / `#8f87a0`
>    oscuro, `pl-tinta-tenue` → `#55534c`, y `pl-oro-claro` `#c9a44e` nuevo para dorado sobre fondo
>    oscuro (`pl-oro` daba 3,95:1 y el rótulo del tooltip salía invisible). Afecta a toda la app.
> 4. **Armadura + escudo** (backlog 16): campo de escudo aparte y `derived()` sumando las dos
>    columnas, con la nota en RULES.md. El manual NO lo resuelve; las citas están en el backlog.
> 5. **El resto del diseño nuevo**, contra el `.pen` 1:1: reordenar la ficha, Resistencia con las
>    dañadas en bordó (`pl-sangre`), el tooltip de recibir daño, Equipo con «+» desplegable, el
>    tooltip de característica con cuerpo, la leyenda por dado, «Mejorar» fuera de las pestañas, y las
>    seis vistas del generador con su columna de GUÍA.
> 6. **Aventuras (H12)**: spec cerrado en `specs/modules/adventures/SPEC.md`. Sigue por **dba →
>    scaffold → design (`.pen`) → dev**. Nada empezado.
>
> El manual manda: PDF en `~/Documents/Developer/Rolvium context/PlenilunioEbook.pdf`, **con 2 de
> desfase** sobre las páginas del libro. Diseño en `.pen` ANTES de cualquier código de UI, orden del
> dueño. Flujo: dev → review → qa.
> Ya decidido: el ancho de los frames de Mesa no se toca · el interruptor del director va como opción
> de campaña gobernando los dos canjes (rebanada propia) · el contenido vive en la BASE, nunca
> hardcodeado en el front.

### Lección de esta sesión, que se repitió cuatro veces
**Un guardia que mide sólo el estado RESULTANTE convierte cualquier borrador ya fuera de norma en un callejón
sin salida**, porque veta también los controles que lo repararían. Se capa la subida, nunca la bajada. Salió en
el canje de dones, en el cupo de especialidades, en el techo del Destino y en el canje contra el valor recortado.
Y su gemela: **un control vetado tiene que VERSE vetado**; si no, el usuario elige y no pasa nada.

**Y la de fondo**: producción llevaba dos días congelada porque la rama nunca se pusheó, y media mañana se fue
en diagnosticar «bugs» que ya estaban arreglados. **Comprueba `git log origin/main` antes de creerte cualquier
«esto está roto en producción».**

## 🚫 Bloqueos / notas
### Vercel — el API existe y despliega solo, pero le faltan las variables (2026-08-19)
- Panel: https://vercel.com/ignaciozitare-9429s-projects/rolvium-api · `prj_0OBlHaNEmoDHOZVoEnFTV8hr4i70` ·
  team `team_O0LMo9mzgF91fZTJ1mJg7yJw`. **Está conectado a GitHub**, así que cada push a `main` lo redespliega.
- **https://rolvium-api.vercel.app** deja de ser un placeholder: es la URL real que consume `VITE_API_URL`.
- Devuelve 500 hasta que se pongan `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` (ver «Pendiente del dueño» §1).
- **El proyecto web no existe todavía.** `rolvium.vercel.app` → 404.
- **El token del CLI está caducado**, y el MCP de Vercel no sabe escribir variables de entorno: por eso este paso
  quedó en manos del dueño y no lo pudo cerrar el agente.

- **El registro de migraciones de hosted está VACÍO** (hallazgo del 2026-08-19). El esquema está entero —14 tablas,
  RLS en todas, `get_advisors` 0 ERROR / 20 WARN de las esperadas— pero como las 12 migraciones entraron con `psql`
  por el pooler, `supabase_migrations.schema_migrations` no tiene ni una anotada (`list_migrations` devuelve `[]`).
  **El día que se autentique el CLI, `db push` intentará re-aplicarlas todas y reventará.** Se arregla insertando las
  12 versiones (el nombre de cada fichero de `supabase/migrations/`) en esa tabla. **No lo he hecho**: escribir en la
  base hosted necesita tu visto bueno.
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

## 📍 Primera tanda del rediseño de la ficha — rama `fix/ficha-diseno` (2026-08-19, QA pasado)

Dos commits: `bffc7b2` (Resistencia + orden + contraste) y `2a22c09` (arreglos del Review). Puertas verificadas
por el subagente QA: web 346 · api 77 · core 6 · plenilunio 70 · `typecheck` OK · `audit` 0 hard / 9 warn ·
`build:web` + `build:api` OK · sondas de producción 200/200 · advisors de Supabase 0 CRITICAL (21 WARN, la línea
base de siempre; la rama no toca migraciones).

**Lo que cierra:** la Resistencia al derecho del libro (p.25, releída en el PDF por QA: página 27 del fichero),
`armour` detrás de `equipment` y en `stack`, el grid de la ficha a 340, y `--tx3` / `--sys-ink-dim` por encima
de 4,5:1. `RULES.md` corregido ANTES que el código, como manda la regla del manual.

**Deuda encontrada por QA y NO tocada** (decisión del dueño, ninguna bloquea):
1. **El hueco de `state` sigue ahí** y ahora es el hueco de tres columnas — ver el punto de arriba. Es trabajo
   de `.pen`, no de CSS suelto.
2. **En la Mesa hacen falta ≥1350 px de viewport** para que Dones · Equipo · Armadura salgan en fila. A 1280 no.
   Si el dueño trabaja en un portátil de 1280, el cambio no se le nota en la Mesa (sí en «ficha aparte»).
3. **`--tx3` es a la vez «texto atenuado» y «control desactivado»** (`DataTable.tsx:216`, `DateRangePicker.tsx:238`,
   `MultiSelectDropdown.tsx:170`). Al subirle el contraste, la distancia entre activo (`--tx`) y desactivado
   (`--tx3`) cae de 4,36:1 a 2,76:1 en oscuro y de 5,29:1 a 2,68:1 en claro: **un control vetado se ve menos
   vetado**. Choca con el invariante del proyecto. Hace falta un token propio de «desactivado», no reusar `--tx3`.
4. **Las casillas de Resistencia no se ven vetadas en solo lectura**: `.rv-sheet-box:disabled` sólo cambia el
   cursor, sin `opacity` como sí hacen `.rv-sheet-btn` y `.rv-sheet-icon-btn`. Igual `.rv-sheet-health-opt`.
   Viene de antes de esta rama, pero con la inversión duele más (21 cuadrados vacíos que parecen pulsables).
5. **Tautología nueva en `Sheet.tsx`**: en `hits = Math.min(len, Math.max(0, len - val))`, el `Math.max(0, …)`
   no se alcanza nunca porque `len = Math.max(max, val) ≥ val`. El `Math.min` sí hace falta (protege de un
   `val` negativo). Es la misma clase de tautología que el 2º commit quitó de `val`.
6. **`--sys-gold` sigue por debajo de 4,5:1** — ver el punto del contraste más arriba.
7. **`npm run audit` no detecta los `var()` con fallback anidado**: `design:var-fallback` da 0, pero hay cuatro
   en `packages/ui/src/components/DateRangePicker.tsx` (185, 188, 193, 297) con la forma `var(--x,var(--y))`.
   Es un agujero en la puerta determinista, no en esta rama.
8. **`.tb-root` duplica en hex la paleta de Plenilunio** (`table.css:5`). Ya se desincronizó una vez con
   `ink-dim`. Anotado en el propio fichero por el Review; sigue pendiente de limpiar.
