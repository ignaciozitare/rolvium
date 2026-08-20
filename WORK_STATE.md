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

## 🟢 PUNTO EXACTO — 2026-08-21 (noche): los CUATRO rechazos del Bestiario, ARREGLADOS y mirados en pantalla

Rama **`feat/bestiario`**. Los cuatro puntos que el dueño rechazó por la mañana —MÁS cinco que vio probando por la
noche— están hechos, comprobados en la app corriendo y con tests. **661 tests verdes** (477 web + 77 api + 6 core + 16 ui + 78 plenilunio),
typecheck limpio, `audit` **0 hard**, `build:web` y `build:api` en verde.

### Prompt de resume, de una línea
> Retomo Rolvium: el Bestiario tiene los cuatro rechazos arreglados y sin mergear — pásale Review y QA,
> y decide lo que queda anotado en «Pendiente de decidir» del bloque 🟢.

---

### ✅ Los cuatro, uno a uno

1. **«respeta el diseño, no has leído el .pen»** → **`SheetOverlay.tsx`**, hoja de pergamino propia que
   replica `PL/Hoja` del `.pen`: papel `--sys-card`, filete `--sys-border`, sombra del sistema, rótulo en
   versalitas con línea debajo y el texto de origen a la derecha («Propio · manual p.152» = «Titulo
   Derecha» del `.pen`). Sustituye al `Modal` de plataforma en las tres fichas.
2. **«te abre el lanzador avanzado de dados, no lo que establecimos»** → **construido** (el dueño eligió
   construirlo, no quitar el botón). Ver abajo.
3. **«Nuevo PNJ con ficha… es horrible, ¿por qué no usaste la que está hecha?»** → **sí era** la que está
   hecha (`<Sheet>` de `@rolvium/ui`); lo que la estropeaba era el `Modal` negro alrededor. Con el
   pergamino se ve lo que es. **No se tocó `<Sheet>`.**
4. **«las letras de todo más oscuras y con más cuerpo»** → hecho en el Bestiario **y en toda la mesa**.

### 🎯 LA CAUSA RAÍZ, confirmada mirando el código
El `Modal` de `@rolvium/ui` pinta el panel en `var(--sf)` (chrome oscuro) sobre scrim `rgba(0,0,0,.6)`. Como
`--sys-card` es **traslúcido** (alfa 80), el papel sobre ese negro salía sucio y el texto ilegible. Por eso
un solo arreglo cerró los rechazos 1 y 3. **No se tocó `Modal`** —lo usa toda la plataforma y ahí está
bien—: se dejó de usar dentro de la mesa, mismo precedente que `EncounterMenu`, `DiceRoller` y
`BackgroundPopover`.

### 🐞 DOS FALLOS REALES que sólo aparecieron al mirar la app (no los cazaba ningún test)
- **`--sp-xs` / `--sp-sm` / `--sp-md` NO EXISTEN en el repo.** Sólo los usaba `bestiary.css`, 20 veces, y
  nadie los define: el navegador tiraba la declaración y **todos los `gap` y `padding` de la pestaña salían
  a cero**. De ahí el amontonamiento. Pasados a px (6/10/16), que es la convención de la casa (`table.css`,
  `sheet.css` ya lo hacen así).
- **`.bs-btn[aria-pressed='true']` le ganaba en especificidad a `.bs-btn-on`**, así que el botón elegido
  salía con filete en vez de relleno de tinta — no se veía cuál estaba marcado. Arreglado con
  `.bs-btn.bs-btn-on`. Compilaba y pasaba los tests igual: sólo se veía en pantalla.

### 🎲 La tirada de criatura (rechazo 2) — construida
`ui/CreatureRollPopover.tsx` + `domain/useCases/creatureRoll.ts`, diseño en el `.pen`
«Bestiario/Tirar por una criatura · popover» (creado en esta sesión).
- **No duplica la matemática**: arma la ficha que el motor sabe leer y delega en `engine.poolFor`.
- Sin penalización por heridas (la criatura lleva Resistencia, no salud) · **nunca** coge dados de la
  Reserva de Destino (es de los jugadores, p.88) · un **PNJ aliado tira con su ficha de personaje**.
- Una característica **ausente no se ofrece**: el manual deja bloques sin publicar enteros.
- **Comprobado de punta a punta contra la API real**: `POST /rolls → 200` y en el Registro aparece
  **«AAMEL · COMBATE»** con sus 8 dados contra la dificultad. Antes ponía «3D12 · GAME MASTER ROOT».

### 🔠 Las letras (rechazo 4)
La norma, ya escrita en `bestiary.css` y `table.css`: **el texto que se LEE va en `--sys-ink-soft` y con
`font-weight:500`; nunca en `--sys-ink-dim`**, que queda para filetes y adornos grandes. Las dos veces
anteriores se intentó bajando sólo el color del token y no bastó — **el problema es el PESO**, porque
Cormorant Garamond es una romana de trazo fino.
Tocados: `bestiary.css` entero · `table.css` (`.tb-dim`, `.tb-placeholder`) · `maps.css` (`.mp-enc-sub`) ·
`packages/ui/src/components/sheet.css` (6 reglas) · `characters.css` (7 reglas).

### 📄 Ficheros
**Nuevos:** `bestiary/ui/SheetOverlay.tsx` (+test, 8) · `bestiary/ui/CreatureRollPopover.tsx` (+test, 8) ·
`bestiary/domain/useCases/creatureRoll.ts` (+test, 10) ·
`tests/regression/bestiary-sheets-on-parchment.test.tsx` (5).
**Modificados:** `EntrySheetModal.tsx` · `NpcSheetModal.tsx` · `PhotoModal.tsx` · `BestiaryTab.tsx` (+test) ·
`bestiary.css` · `TablePage.tsx` · `table.css` · `maps.css` · `characters.css` · `sheet.css` ·
`locales/{es,en}.json` · `specs/modules/bestiary/SPEC.md` · `rolvium.pen` · `apps/web/shot-bestiary.mjs`.

### 🔁 SEGUNDA VUELTA — cinco cosas más que el dueño vio probando (2026-08-21, noche)
Todas arregladas y comprobadas en la app corriendo.

1. **La foto salía recortada.** `.bs-card-photo` iba con `object-fit: cover`. El fichero subido está
   intacto (el compresor escala por el lado largo), así que era sólo al pintarla. Ahora `contain`.
2. **El desplegable de tirada parecía otra pantalla** («no es un modal, me abre una vista nueva… lo tiene
   que abrir sobre la card»). Reusaba el pergamino a pantalla completa de `SheetOverlay`. Ahora es un
   popover DENTRO de su propia ficha (`.bs-card` es `relative`, el popover `absolute`): arranca en su
   esquina y crece hacia abajo, así que el catálogo se sigue viendo y el botón «Tirar» no queda fuera.
   Cierra con Escape y con un captador **invisible** — un velo opaco lo volvería a convertir en pantalla.
3. **«Colocar» no colocaba.** Sólo cambiaba de pestaña. Ahora manda la criatura ya elegida a la escena
   (`armEncounter` / `onArmed`), sale el aviso «Coloca a X: haz clic en el mapa» y el buscador NO se abre,
   que ya sobra. **Comprobado contra la base: 8 → 9 tokens, el último «Ogro».**
4. **La pestaña «Ficha» del director enseñaba a otro.** Si había abierto la ficha de un jugador desde «El
   grupo», `viewCharacterId` se quedaba pegado para el resto de la sesión. Pulsar «Ficha» vuelve ahora
   SIEMPRE a la propia.
5. **Sin salida desde «El grupo».** La ficha ajena no tenía ni cartel de quién era ni puerta. Ahora lleva
   «← Volver al grupo» y «Estás viendo la ficha de X».
6. **«Ficha» YA NO ES PESTAÑA DEL DIRECTOR** (lo que el dueño pedía de verdad en el punto 4: «el director
   de juego no tiene personaje propio, por eso te pedí que quites el botón»). `tabsFor('dm')` pasa a
   `['group','scene','bestiary','create']` y el director **aterriza en «Escena»** (`initialTabFor`).
   La VISTA de la ficha sigue existiendo para él: se llega por «El grupo» → «Ver ficha», y mientras la
   mira queda marcada «El grupo», que es de donde viene y a donde vuelve.
   ⚠ **Al jugador NO se le toca** — aviso expreso del dueño. Sigue con `['sheet','scene','create']`,
   «Ficha» primera y aterrizando en ella. Hay tests que lo pinchan en `tests/functional/table.test.tsx`.

**Ficheros de esta vuelta:** `bestiary.css` · `CreatureRollPopover.tsx` · `EntryCard.tsx` ·
`BestiaryTab.tsx` · `SceneTab.tsx` (+test, 4) · `TablePage.tsx` · `tabs/SheetTab.tsx` (+test, 2) ·
`characters.css` · `locales/{es,en}.json` · el pin de regresión (+1) · `rolvium.pen` · el spec ·
`tableRules.ts` (+`initialTabFor`) · `tests/functional/table.test.tsx` (+2).

### ⚠️ PENDIENTE DE DECIDIR (nada de esto está hecho)
- **Review y QA NO se han pasado.** Esta sesión tenía instrucción de no lanzar subagentes, así que se
  hicieron sólo las comprobaciones mecánicas (audit, tests, builds, fronteras hexagonales, hex crudos,
  i18n). **Antes de mergear hay que pasar `/review` y `/qa`** — y el hook de QA lo bloquea igualmente.
- **`bestiary_entries` sigue SIN estar en producción.** Repetir `get_advisors` DESPUÉS de subir la
  migración: el chequeo limpio de antes hablaba de una tabla que no está allí.
- **La ficha del encuentro perdió el arrastrar-y-soltar de imagen.** Se cambió `ImagePicker` (pintado con
  tokens de plataforma en estilos en línea: sobre el papel era un recuadro oscuro) por el botón «SUBIR
  IMAGEN (WEBP)» del `.pen`, con el mismo camino que ya usa `NpcSheetModal`. Sube, comprime y avisa igual.
  **Si el dueño quiere el arrastrar-y-soltar de vuelta**, hay que vestir `ImagePicker` con `--sys-*`, y eso
  toca un componente compartido con `characters` y `maps`.
- **`ConfirmModal` (borrar una entrada) sigue siendo el modal negro de plataforma.** No se tocó: vestirlo
  es o duplicar un componente compartido o migrar a sus otros consumidores. Decisión del dueño.
- **En el `.pen` quedan textos pequeños en `ink-dim` en OTROS frames** (fichas de personaje, escena,
  campañas). No se barrieron en bloque para no reescribir el master sin permiso. Hay una nota dentro del
  `.pen` («Regla de tipografia — texto pequeno») con el cambio mecánico que haría falta.
- **`.tb-person-label` está a `font-size:8px` crudo** — ilegible y además px crudo. No se tocó porque subirlo
  mueve la maqueta bajo los avatares y hay que mirarlo.
- El **bucket `tokens` sigue siendo PÚBLICO** — deuda aparcada a propósito por el dueño el 2026-08-20.

### 🧰 Cómo mirarlo
Docker + Supabase local + `dev:api` :3001 + `dev:web` :5173.
`http://localhost:5173/table/8f506705-e348-415c-82a9-5a37e2c0ce51` · `admin@rolvium.local` / `rolvium123`.
Capturas: `node shot-bestiary.mjs` **desde `apps/web`** (playwright vive ahí). Salen en `/tmp/bs-*.png`:
`bs-catalogo` · `bs-ficha` · `bs-foto` · `bs-pnj` · **`bs-tirada`** (nuevo).

---

## 🟢 PUNTO EXACTO — 2026-08-20 (tarde), Bestiario (H5) en curso

Rama **`feat/bestiario`**, 12 commits sobre `main`. **Review pasado** (cazó y arregló 3 defectos reales: ruta de
subida que habría dado 403 en producción, `tokenUrl` que no se guardaba, e interpolación sin validar en el filtro
de PostgREST). **QA automático pasado** (617 tests, advisors 0 críticos / 21 WARN = línea base, ambas apps
compilando). **Sin mergear**: falta la verificación visual light/dark del dueño.
Alcance aprobado por el dueño: **el hexágono entero**, no una rebanada.

### Hecho y en verde
- `af1ffdf` **DBA** — tabla `bestiary_entries` (campaña en blanco = «todas mis campañas», `owner_id` obligatorio
  porque es lo que sostiene la RLS de las globales), enlace `maps_tokens.bestiary_entry_id` con **ON DELETE SET
  NULL** (borrar la plantilla no vacía la escena). RLS sólo director, doble condición (dueño **Y** director si
  cuelga de campaña). Aplicada en local, `db lint --level error` sin resultados.
- `de2adbe` **el `.pen` del dueño commiteado** — el diseño de tiradas ya no depende de que nadie cierre el editor.
- `b6af70f` **datos del manual** — especialidades de las 45 criaturas + **los 8 bloques que faltaban**.
- `07d9d11` **scaffold** — dominio, puerto, repo Supabase y contenedor del módulo, con 27 tests.
- **Diseño** — el listado **ya estaba diseñado** (`qLGcY`). Añadidos tres frames y aplicadas las 5 correcciones
  del dueño (2026-08-20):
  - `kD9lH` **Ficha del encuentro** — imagen a 152 px con el ojo encima; cajas de características **alineadas en
    columna y del mismo tamaño** (el fallo era que el nombre no tenía ancho fijo, así que «Fortaleza» y «Cultura»
    empujaban la caja a distinta x).
  - `g0L0jJ` **Catálogo a pantalla completa** — rejilla de 4×2 fichas con imagen grande, buscador, filtros, crear
    y editar. La primera enseña el **estado hover con el ojo**.
  - `muyDX` **Modal de la foto** — lo que abre el ojo: foto a tamaño grande, nombre, página y «abrir ficha».
  - Corregido el rótulo del pie del listado: «SUBIR TOKEN PNG» → **«SUBIR IMAGEN (WEBP)»** (el PNG era viejo).
  **Pendiente: que el dueño lo apruebe** — es gate obligatorio antes de escribir UI.

### Construido después (2026-08-20, tarde)
- `36a55f8` **diseño** — las 5 correcciones del dueño: imagen grande, ojo sobre el token + modal de la foto,
  cajas de características alineadas, catálogo a pantalla completa, y «PNG» → «WEBP».
- `ec16cbc` **el código** — compresor de imágenes en `packages/ui` (con vitest nuevo en ese paquete), y el
  catálogo, la ficha y el modal de la foto enganchados en la pestaña «Bestiario» de la mesa, que era un cartel
  de «en construcción». `audit` 0 hard, `build:web` y `build:api` en verde.
- `efa120e` **los 3 arreglos del Review** · `91c41b3` **encuentros propios en la escena** · `2617588` **PNJ
  aliados con la ficha completa de personaje** · `40f0000` **el bucket público, anotado como deuda**.
  Total tras el QA: **617 tests en verde** (440 web + 77 api + 6 core + 16 ui + 78 plenilunio).

### ⏳ Lo que falta del hexágono
1. ~~Visto bueno del dueño al diseño~~ **dado** · ~~compresor~~ **hecho** · ~~UI del catálogo y la ficha~~
   **hecha** · ~~i18n~~ **hecha**.
2. ~~Los PNJ aliados con ficha COMPLETA de personaje~~ **hecho** (`2617588`, `NpcSheetModal` reutiliza `<Sheet>`).
3. ~~Alimentar `EncounterMenu` de la escena con las entradas propias~~ **hecho** (`91c41b3`, `DmScene` +
   `extraEncounters` + `tokenFromBestiary`).
4. ~~Review~~ **pasado** → ~~QA~~ **pasado** → falta light/dark del dueño → merge.

### 🟡 Lo que el QA dejó anotado (2026-08-20) — no bloquea, decide el dueño
- **«Tirar» y «Colocar» de la ficha son atajos, no la acción del spec.** `TablePage` los engancha como
  `onRoll={() => setRollerOpen(true)}` y `onPlace={() => setTab('scene')}`: abren el lanzador libre y llevan a
  la escena, pero **no tiran en nombre de la criatura** (sin sus características, sin elegir especialidad, sin
  visibilidad mesa/DJ/secreta) ni colocan el token — eso se hace desde el desplegable de la escena. El spec
  describe la tirada completa; depende del **panel del director de tiradas**, que es lo siguiente.
- **«N en escena» no se pinta**: `EntryCard` acepta `placedCount` pero `BestiaryTab` nunca se lo pasa.
- **No hay menú «…» con duplicar / borrar / token PNG**: el botón `more_horiz` abre la ficha, igual que «Editar»;
  duplicar y borrar viven dentro del modal. La **descarga del token en PNG no existe** en ninguna parte.
- **La migración NO está en producción todavía** — `bestiary_entries` no aparece en el proyecto hosted. Los
  advisors salen limpios porque la tabla aún no está allí: **hay que volver a pasarlos después del deploy**.
- **`ARCHITECTURE.md` no tiene fila de implementación para `bestiary`**, sólo la del mapa de hexágonos (H5).
  Todos los módulos construidos (auth, identity, characters, dice, maps…) sí la tienen.

### 🔎 Lo que me encontré y NO toqué (decidir aparte)
- 🔒 **El bucket `tokens` es PÚBLICO** (`public = true`, migración de `characters`, línea 221). Cualquiera con
  la URL ve la imagen **sin sesión siquiera**. En un módulo que grita «SOLO DIRECTOR» eso chirría: un jugador
  curioso podría ver la ilustración de un monstruo antes de enfrentarse a él. **Es config preexistente**, pero
  el Bestiario es lo primero que mete ahí contenido secreto del director. Arreglarlo son URLs firmadas en vez
  de públicas y toca **también `characters` (avatares) y `maps` (fondos)**, con riesgo de que dejen de verse
  imágenes ya subidas. El dueño lo aparcó el 2026-08-20 para no retrasar el merge del Bestiario: **decisión
  suya, consciente**, no un olvido.
- **El diseño del listado enseña «Solitario» y «Chatarrero»**, que se quitaron del catálogo por no ser bloques del
  manual (RULES.md §8). Es texto de ejemplo del `.pen`, no código, pero conviene refrescarlo.
- ~~El pie decía «SUBIR TOKEN PNG»~~ → **corregido a «SUBIR IMAGEN (WEBP)»** (el dueño confirmó que el PNG era viejo).
- **La barra superior sale «partially clipped»** en el catálogo nuevo — pero ya venía así en `qLGcY` y en otros
  frames: es del componente compartido `njHz3`, no de lo añadido. No tocado.
- `cannibalCook` es **Will** y `scavenger` es **Kharla**: nombres engañosos, valores correctos. Renombrar es
  cosmético y arrastra los tokens ya colocados, así que va aparte.

### 🖥 Entorno
Supabase local levantado (Docker). Migración del bestiario aplicada con `supabase migration up --local`, **no**
con `db:reset`, para no borrar los datos de prueba del dueño.

---

## 🟢 PUNTO EXACTO — 2026-08-20, handoff a chat nuevo

`main` está al día y **producción también** (verificada contra el bundle, no de memoria). No hay ninguna rama
abierta. Lo que sigue vivo es **un diseño en el `.pen` sin guardar** y **un spec escrito pero sin construir**.

### Prompt de resume, de una línea
> Retomo Rolvium: lee el bloque 🟢 de WORK_STATE.md y arrancamos el **Bestiario (H5)**, que es la prioridad; de
> paso, guardo `rolvium.pen` (Cmd+S) para poder ver el diseño de tiradas que quedó montado.

---

### ⚠️ LO PRIMERO: el `.pen` está SIN GUARDAR y el diseño NUNCA se ha visto
El diseño de las tiradas está montado en el frame **`Mesa/Tiradas · rediseño — quién ve qué`** (id `v3vfV`), pero
**el dueño no ha pulsado Cmd+S**, así que:
- **no está en disco** y el commit no lo tiene;
- **las capturas del MCP salen en blanco** — el renderizador lee el fichero guardado, no la caché;
- **las medidas (`ctx.bounds`) que devuelve el MCP están viejas**, así que los avisos de «clipped» no son fiables.
  Se perdió media sesión ajustando a ciegas por no saber esto. **Que el dueño guarde ANTES de tocar nada más.**

Seis columnas, cada una con su etiqueta de quién la ve:
| # | Frame | Quién lo ve |
|---|---|---|
| 1 | `Popover/Tirar` (`UnY4s`) | jugador — cuántos dados (−/+) y cuántos de la reserva. Nada más |
| 2 | `Popover/Disparar` (`X8No2`) | jugador — lo mismo, más el alcance |
| 3 | `Panel/Registro` (`OOWZv`) + `Tooltip/Desglose` (`y0WfVO`) | los dos — nombre de quién tiró y el desglose en tooltip |
| 4 | `Panel/Director` (`QWHSS`) | sólo el director |
| 5 | `Aviso/Te atacan` (`dcTPM`) | el jugador atacado |
| 6 | `Modal/Atacar con el token` (`A4VWk`) | sólo el director |

**Todo lo que el dueño corrigió está ya aplicado en el `.pen` y escrito en `specs/modules/dice/SPEC.md`**
(mantener pulsada la característica, varios destinatarios, la lista de encuentros con añadir/editar/desplegar, el
ataque desde el token, fuera las leyendas del modal del jugador, fuera elegir especialidad en el lado del jugador,
las tiradas «para mí» al lanzador que ya existe, botones a ancho igual 3+3+1). **Lo único que falta es MIRARLO.**

### ⏳ Lo siguiente, en orden — **el BESTIARIO manda** (dueño, 2026-08-20: «tenemos que construir el bestiario asap»)
1. 🔥 **Bestiario (H5)**, spec en `specs/modules/bestiary/SPEC.md`. Lo que hay hecho es sólo la **semilla**: el
   bestiario del sistema con los 37 bloques del manual. Falta el hexágono entero:
   - **DBA primero**: tabla `bestiary_entries` (campaña, origen manual|propio|PNJ, datos jsonb, imagen, notas) con
     su RLS **sólo director**, y el enlace desde `maps_tokens`. El campo `bestiary_ref` ya existe en tokens.
   - **Encuentros propios del director**: crear, editar, duplicar («otro mutante»), borrar.
   - **Las especialidades de cada criatura, como DATO** — respondida aquí la pregunta que quedó abierta: entran
     **con el Bestiario**, no antes. El ogro tiene «Garrote» en Combate y el hambriento «Mordisco»; hoy están sólo
     en su texto y por eso el motor no puede doblarles los triunfos. Son ~200 nombres que **no** están en la lista
     de especialidades de jugador, así que necesitan claves i18n propias (es y en).
   - **Imagen por entrada**, con el compresor a WebP de `specs/core/images` (tampoco existe: hoy los fondos suben
     sin comprimir y el avatar dice «pronto»). El bucket `tokens` ya está creado y vacío.
   - Listado con buscador y filtros, y colocar en escena creando **instancia** con su propia Resistencia.
2. **Guardar el `.pen`** y sacar capturas de las seis columnas del diseño de tiradas (ver arriba), para no perder
   lo ya diseñado mientras se construye el bestiario.
3. **Modelo de datos de las tiradas agrupadas** (DBA): una tirada del director **enfocada** contra uno o varios
   jugadores, y la respuesta del jugador **enlazada** para que salgan como una sola entrada. Ya existe
   `dice_rolls.corrects_id` como precedente. Si el jugador no contesta, **la tirada espera indefinidamente**
   (decisión del dueño): hace falta un estado «pendiente».
4. **Construir las tiradas**: ficha (fuera el bloque «Tirada»), panel del director, aviso de defensa, registro con
   autor y tooltip de desglose. **El bestiario va antes porque el panel del director lo necesita**: sin encuentros
   con características no hay con qué atacar.
5. **La niebla degradada** y el resto del backlog de la escena (los siete puntos, más abajo).

### 🧾 Lo que se cerró hoy (2026-08-20)
- **`fix/ficha-listas` mergeada** (`026ee6d`): el sexto nivel de salud (Inconsciente, p.101), la Resistencia máxima
  que la baja el estado, la Fortuna capada al Destino, la maquetación, las especialidades como texto con `+`, y
  «Mejorar» fuera de las pestañas. Review + QA pasados, previews en verde, producción verificada.
- **El bestiario entero** (`393f06d`): los **37 bloques del manual** con sus siete características, Aguante,
  Destino, protección y página. Antes eran cuatro plantillas sin características, dos de ellas inventadas.
- **Specs y ARCHITECTURE al día** (`d94b0ab`): el contrato del puerto de sistemas estaba viejo y es el que se usará
  para escribir el próximo sistema de juego.
- **`specs/core/images`** nuevo (`9964a73`): un solo camino para subir imágenes, comprimidas a **WebP en el
  navegador** (sin coste de servidor), con tamaños y topes por destino.
- **Los números descuadrados** (`c37a28a`): no era el CSS, era la letra — Cormorant Garamond trae cifras de estilo
  antiguo. `lining-nums` en la mesa entera. Y los grises de texto, un escalón más oscuros.

### 🔎 Deuda conocida, escrita para que no se pierda
- ~~Las especialidades de las criaturas no son dato~~ → **decidido**: entran **con el Bestiario** (punto 1 de
  arriba), no en una tanda aparte.
- 🚨 **DOS organizaciones en Supabase — «Worksuite» NO SE TOCA.** Orden del dueño, 2026-08-20: «no la vayas a
  cagar tocando worksuite!». `list_projects` sólo devuelve `ignaciozitare's Org` (`anewnkzmtgjrnqekoaie`), que
  contiene **Worksuite** (`enclhswdbwbgxbjykdtj`) y **NO es de este proyecto**: ni escrituras, ni migraciones, ni
  `execute_sql`. Rolvium está en la OTRA org (`iuxzfnveabephkcixsaa`) y hay que pedirlo por su ref exacta.
- ~~Los advisors de Supabase no se pueden correr~~ → **RESUELTO (2026-08-20). El aviso era falso.** El proyecto
  **«Rolvium» existe y está sano**: ref `scfspsiemikfcnqteonq`, org `iuxzfnveabephkcixsaa`, eu-central-1, creado el
  18/08. La ref estaba escrita en este mismo fichero (línea del bloque de Vercel). No sale en `list_projects` porque
  el conector sólo ve la OTRA organización del dueño (la de «Worksuite»), pero **responde si se le pasa la ref
  exacta**. No hace falta `supabase link` para los advisors.
  **Foto de partida antes del Bestiario: 0 críticos, 21 WARN** — 20 son funciones `SECURITY DEFINER` llamables por
  usuarios registrados (`is_admin`, `has_permission`, `join_campaign_by_code`…, intencionadas y preexistentes) y 1 es
  «Leaked password protection disabled», que se activa con un clic en el panel y **está pendiente del dueño**.
  Tras la migración del Bestiario hay que repetirlo y comparar contra estos 21.
- Cinco avisos del QA sin tocar: `playwright` está en `apps/web` mientras `scripts/shot.mjs` vive en la raíz y nadie
  documentó que hace falta `npx playwright install`.
- Un PJ **muerto** sale con «Resistencia máxima 0» y sin casillas. Es coherente (un muerto no recupera) pero la
  p.101 no dice nada de los muertos: ese 0 es codificación nuestra. Mirado en pantalla y dejado así a propósito.

### 🖥 El entorno quedó levantado
Docker + Supabase local + `dev:api` en **:3001** + `dev:web` en **:5173**. Capturas en `/tmp/sec-*.png` y
`/tmp/theme-{dark,light}-*.png`. Campaña `8f506705-e348-415c-82a9-5a37e2c0ce51`, Karen
`3af4f238-25ad-4cf1-a264-09d7586019d8`, `admin@rolvium.local` / `rolvium123`.
Para VER el aviso de Inconsciente o una ficha de muerto se tocó a mano la base local; **Karen quedó como estaba**
(herida, 3 de 12, consciente), comprobado con un `select` después de cada uno.

---

## ✅ REVISIÓN DE «ESTADO» CONTRA EL PDF — HECHA (2026-08-19 noche)
Los dos bloques que quedaban (Estado contra el PDF + maquetación) están **ejecutados enteros**, con
`RULES.md` corregido ANTES del código y cada pantalla mirada con `node scripts/shot.mjs`.
**Sin commitear todavía si esto lo lees a medias; sin Review cerrado; sin QA; sin mergear.**

### El sexto nivel de salud: Inconsciente (p.101) — RULES.md corregido primero
Confirmado en el PDF: la lista de p.99 no termina ahí, **p.100 es ilustración** y el sexto punto está en
p.101. `RULES.md §6.2` se reescribió con la cita literal, con la aclaración de que **no es una fase de
luna** (se puede estar Herido E Inconsciente) y con la **contradicción del libro anotada sin resolver**:
p.98 dice que a 0 sigues consciente y caes al perder un punto más; p.101 dice que a 0 ya estás
inconsciente. **El motor sigue la de p.98** y por eso el estado se GUARDA en vez de deducirse de
`resistance === 0`.

### Lo que cambió en el código, y por qué
- **`unconscious` deja de ser un desplegable.** Es una consecuencia que calcula `applyDamage`, no una
  decisión del jugador — el mismo fallo que el cargador editable a mano. Ahora sale como **aviso rojo
  bajo las lunas**: «Inconsciente · sin Resistencia, indefenso en el suelo (p.101)». Visto en pantalla.
  ⚠ **No se borró del esquema**: `validateSheet` rechaza como `unknown` toda clave que el esquema no
  declare, así que sin declararlo el patch de `applyDamage` habría tumbado el guardado entero al
  recibir daño. Se queda con `hidden: true` (miembro nuevo de `FieldDef`).
- **La Resistencia máxima ya no miente.** `resistanceMax` pasa a ser `Aguante × factor del estado`
  (×3 sano/magullado, ×2 herido, ×1 malherido, p.101) y **`recoveryMax` desaparece**: eran el mismo
  número con dos nombres. Karen, herida, ya no sale con «máxima 18 / recuperable 12», sale con
  **máxima 12**, y las casillas dicen «3 de 12».
- **La Fortuna se capa contra el Destino** (p.90, tope duro literal). El `counter` lee su techo de
  `derived['<id>Max']` cuando existe — la misma convención que ya usaban las `boxes` con
  `resistanceMax`, sin API nueva. Se capa la SUBIDA, nunca la bajada: con Fortuna 5 y máxima 4 el `+`
  sale apagado y el `−` sigue vivo. Comprobado en la app.
- **Miembros nuevos de `FieldDef`** (`packages/core`): `note?: (sheet) => I18nKey | null` (sólo campos
  `health`) y `hidden?: boolean`. Los dos documentados en el puerto con el porqué.

### Maquetación — los cinco puntos, hechos
1. La página («p.98») va en **su propia línea** dentro de la tarjeta: ya no se sale.
2. **Filete corto** entre el rótulo y el número, dentro de cada tarjeta.
3. **Destino · Fortuna · Experiencia en una sola fila** — sale de quitar el desplegable de la rejilla.
4. Los `+`/`−` de **Munición alineados**: el número lleva `min-width:3ch` y la regla
   `.rv-sheet-item-counter` (margen automático + 96 px) se **acotó a la lista**, que se estaba colando
   en la tabla de Armas.
5. **Repaso sección por sección** con capturas. Apareció un desborde más, del mismo tipo que el 4:
   `.rv-sheet-item > span` pesa más que `.rv-sheet-item-name`, así que el nombre quedaba en
   `flex:0 0 auto` y en **Dones** la cola entera de la fila (contador, coste, botón, ×) se corría a la
   derecha en las filas de nombre largo. Acotada la regla del nombre; ahora caen en columna. El nombre
   largo se corta con puntos suspensivos y lleva `title` para poder leerlo entero.
   Identidad, Equipo, Armadura, Características e Historia: sin desbordes.

### Dos peticiones del dueño llegadas a mitad de tarea — hechas
- **Especialidades en Características**: lo ya elegido es **texto** con su `×`, y el desplegable sólo
  aparece al pulsar un **`+` que sólo se pinta si de verdad cabe alguna**. Se acabaron los dos
  desplegables de 150 px por fila en las siete características. **En el generador no cambia nada**
  (`rowPicker`): ese paso ES elegir especialidades, y ahí un control apagado al llegar al cupo dice
  «ya no te quedan», que es lo que hace falta saber mientras repartes.
- **«Mejorar» baja a la barra de la ficha**, al lado de «Abrir ficha aparte», y abre el panel sobre la
  ficha. Deja de ser pestaña (`tabsFor`, `TableTab`, `TablePage`); `ImproveTab.tsx` borrado — SheetTab
  ya tiene el `state` que necesitaba.

### Ficheros
`packages/system-plenilunio/{RULES.md, src/{engine,schema,locales}.ts}` ·
`packages/core/src/gameSystem.ts` · `packages/ui/src/components/{Sheet.tsx,sheet.css}` ·
`apps/web/src/modules/table/{domain/entities/Table.ts, domain/useCases/tableRules.ts,
ui/TablePage.tsx, ui/tabs/SheetTab.tsx}` · borrado `ui/tabs/ImproveTab.tsx` ·
tests: `apps/web/tests/regression/sheet-state-tiles.test.tsx` (+5 casos),
`apps/web/tests/functional/{sheet-component,table}.test.tsx`,
`apps/web/src/modules/table/ui/tabs/tabs.test.tsx`,
`packages/system-plenilunio/src/{engine,schema}.test.ts` · `scripts/shot.mjs` (captura también
Identidad y Características).

Verde: `npm test` **514/514** · `typecheck` · `build:web` + `build:api` · `audit` 0 hard / 9 warn
(los 9 preexistentes: maps, dice, UserMenu).

### ⚠ Lo que hay que saber de estos cambios
- **Un personaje MUERTO sale con «Resistencia máxima 0»** (`RECOVERY.dead.restFactor` es 0). Es
  coherente con el libro —un muerto no recupera— pero si molesta en pantalla, se decide aparte.
- El test que faltaba del **tooltip del alcance** (`sheet-range-hint.test.tsx`) **sigue sin escribirse**.
- La referencia `recovery` (p.101) se queda en `references.ts` sin campo que la use: el resumen de
  `ref.resistance` ya cuenta la regla del estado, y el día que se construya «Descansar» la necesita.

---

## 🎲 LO SIGUIENTE, PEDIDO POR EL DUEÑO (2026-08-19, cierre) — el bloque «Tirada» está mal colocado
Sin empezar. **Necesita spec y `.pen` antes de código.** Pedido literal: «en los botones de tiradas
debería cada uno tener su desplegable con la dificultad. El tema de la armadura lo sabemos si tenemos
una armadura seleccionada, la especialidad ya la conocemos, no hace falta seleccionarla ahí».

Lo que dice el manual, para no diseñarlo a ciegas:
- **Dificultad**: es de la ACCIÓN, no de la ficha (p.84). Hoy es un desplegable global y pegajoso —
  lo dejas en «Difícil» y todas las tiradas siguientes salen así sin avisar. Darle su selector a cada
  botón es correcto y además arregla ese fallo silencioso.
- **Armadura**: la penalización **no se aplica siempre**, sólo «cada vez que el personaje realiza una
  acción física que requiere coordinación, agilidad o rapidez» (p.98). O sea que no basta con saber
  que llevas armadura: hay que saber si ESA acción es física. Se puede **derivar por defecto** (atacar
  sí; Cultura no) en vez de preguntarlo, pero no se puede quitar sin decidir la regla.
- **Especialidad**: sólo cuenta si encaja con lo que intentas (p.83). Karen tiene «Armas improvisadas»
  en Combate: disparando un magnum **no** aplica. Así que no es «ya la conocemos» — es «cuál de ellas,
  o ninguna», y esa elección es del momento de tirar, no de un Sí/No global.

**Decisión pendiente del dueño** antes de tocar nada: ¿se derivan armadura y especialidad con una
regla por defecto (y un modo de anularla al tirar), o cada botón abre un pequeño panel con las tres
cosas? La sección «Tirada» entera desaparece en las dos.

### 🧾 El «vs» del registro de tiradas, explicado (pregunta del dueño)
No es un invento nuestro: es el reto del manual. A la izquierda **tus dados** (los tuyos + los de la
reserva de Destino si cogiste); a la derecha los de la **oposición** — en un reto, tantos dados como
la dificultad (p.84: 1/2/3/5/6); en un conflicto, la reserva del rival. Cada dado se lee igual (p.82):
**1 fracaso · 2–3 fallo · 4–5 éxito · 6 triunfo**; los resaltados son los que puntúan. El «1—2» de la
cabecera es **tus impactos — los suyos**, y la diferencia da el grado (p.85): de ahí «no lo consigue
por muy poco». En el ejemplo `5 2 vs 6 6 3`: tú sacas un éxito y un fallo (1 impacto), la dificultad
saca dos triunfos y un fallo (2), 1−2 = −1.
⚠ Deuda de pantalla que esto destapa: falta la **leyenda por dado** (punto 3 del QA del dueño, p.82),
que es lo que haría el «vs» legible sin explicación.

---

## 🟢 PUNTO EXACTO — 2026-08-19, cierre por handoff de contexto

**Rama `fix/ficha-listas`, 8 commits sobre `main`. Sigue SIN Review, SIN QA y SIN mergear.**
Último commit: `2182f38` — los cuatro puntos de pantalla que quedaban del dueño.

### Lo que se hizo en esta sesión
Los **cuatro puntos de pantalla** (punto 2 del plan del dueño), todos verificados con
`node scripts/shot.mjs` antes y después:
- **Aguante y Resistencia máxima** en tarjetas cuadradas centradas, rótulo y número centrados.
- **Penalización por heridas y Resistencia recuperable**, una al lado de la otra, en tarjetas iguales.
  «Inconsciente» baja por debajo de la pareja en vez de partirla (reorden en `schema.ts`).
- **Casillas de Resistencia y lunas de Salud, centradas** en la tarjeta.
- **Alcance con tooltip**: la celda dice «Medio», el tooltip «Hasta 50 m · dificultad 3» (p.95–96).
  Antes ocupaba media tabla de Armas.

Cómo, para no re-descubrirlo:
- `<Sheet>` agrupa las **tandas seguidas** de números calculados de una sección `grid` en una fila
  propia (`groupTiles` → `.rv-sheet-tiles`) y las centra. Centrar cada campo en SU celda de la rejilla
  no vale: quedan repartidos por el ancho, no centrados en la tarjeta grande.
- En `stack` **no se toca nada**: Armadura conserva su lectura en columna con el filete corto.
- `FieldDef.options` acepta un **`hint` opcional** (clave i18n). La ficha lo saca en `Tooltip` de
  `@rolvium/ui` sobre un `<abbr tabIndex={0}>`, no en la celda. Locales: `sheet.range.*` es el nombre
  a secas y `sheet.rangeHint.*` los metros y la dificultad.

Ficheros: `packages/core/src/gameSystem.ts` · `packages/system-plenilunio/src/{schema,locales}.ts` ·
`packages/ui/src/components/{Sheet.tsx,sheet.css}` · test nuevo
`apps/web/tests/regression/sheet-state-tiles.test.tsx` (6 casos).

Verde: `npm test` 509/509 · `npm run typecheck` · `npm run build:web` y `build:api` · `npm run audit`
0 hard / 9 warn, **todos los warns preexistentes** (maps, dice, UserMenu — ninguno de esta tanda).

### ⏳ Próximo paso, en este orden
⚠ Lista de la sesión ANTERIOR: los puntos 1 y 2 siguen en pie; lo demás lo cierra el bloque de arriba.
1. **El test que falta** (obligatorio antes de Review): el **tooltip del alcance** no tiene test. El
   hook de context-handoff cerró la sesión justo al escribirlo. El fichero iba a ser
   `apps/web/tests/regression/sheet-range-hint.test.tsx` y tiene que fijar tres cosas: que la celda
   diga sólo «Medio» (nada de «Medio · hasta 50 m»), que el tooltip lleve la pista y el `<abbr>` sea
   `tabIndex=0` (sin eso el dato sólo existe con ratón), y que una opción SIN `hint` salga como texto
   pelado. Patrón: copiar `sheet-state-tiles.test.tsx`.
2. **La lógica de daño → Resistencia → Salud** (sección «LA REGLA QUE SE NOS ESTABA ESCAPANDO»). Nada
   empezado. **Leer el PDF, no RULES.md.**
3. **Review + QA a `fix/ficha-listas` y mergear.** Ninguno de los dos se ha pasado.
4. Backlog: Estado compuesto, armadura + escudo (16), tokens de contraste, Aventuras (H12).

### 🔎 Deuda encontrada y NO tocada (decidir aparte)
- **El «Cargador» del rifle de asalto sale «—» teniendo 12 de munición** (visto en la captura). La
  columna `ammo` es `derived`, y en `TableField` el `derived` gana al `appliesToRow`, así que
  `derivedCell` busca el valor en la fila, no lo encuentra (`null`) y no hay `ammo` en el catálogo →
  pinta «—» en vez de `0`. El magnum sale bien porque tiene `ammo: 6` guardado. El botón de recargar
  sí está activo, así que la fila se contradice a sí misma. **No lo he tocado: está fuera de los
  cuatro puntos.**
- ~~La rejilla de Estado tiene 3 columnas y quedan 4 campos no-tarjeta~~ — **RESUELTO** al sacar
  «Inconsciente» de la rejilla: quedan Destino · Fortuna · Experiencia y llenan la fila justa.
- **El `.pen` no se ha tocado**: estos cuatro puntos son correcciones dictadas por el dueño sobre la
  pantalla, no un diseño nuevo, y el `.pen` sólo lo puede guardar él. Si la lectura en tarjetas se
  queda, hay que bajarla al master.

### 🖥 El entorno local quedó levantado
Docker + `npm run db:start` + `npm run dev:web` (:5173) están **corriendo**. El `dev:api` que ya
estaba de antes sigue en **:3001** (no :3000): si `npm run dev:api` da `EADDRINUSE 3001`, es que ya
hay uno vivo y está sano — comprobá `curl localhost:3001/health` antes de matar nada.

---

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

## 🩸 LA REGLA QUE SE NOS ESTABA ESCAPANDO — daño, Resistencia y Salud (p.98–99)
Salió de que el dueño insistiera en que «no tiene relación» y en que **mirara el PDF, no el RULES.md**.
Tenía razón: `RULES.md` NO tiene esta tabla, que es justo la que explica la relación.

| Daño recibido | Casillas a tachar |
|---|---|
| Aguante | 1 casilla (herida leve) |
| Dos veces el Aguante | 2 casillas (herida grave) |
| Tres veces el Aguante | 3 casillas (herida crítica) |
| Cuatro veces el Aguante | Muerto (herida mortal) |

**La clave está en «casillas a tachar»**: las lunas de salud SON casillas que se tachan, y **se acumulan
entre golpes** — «si un personaje pierde todos sus niveles de salud, bien porque haya sufrido una herida
mortal o **por haber acumulado cualquier combinación** de suficientes heridas de distinta severidad,
entonces está muerto».

Son **dos marcadores con dos finales distintos, unidos por el Aguante**:

| | Resistencia | Salud (lunas) |
|---|---|---|
| qué la baja | el daño, siempre, punto a punto | sólo si **UN** golpe llega al Aguante |
| cuánto | el daño neto | 1 luna por cada Aguante completo de **ese** golpe |
| al fondo | 0 → un punto más y cae **inconsciente** | todas tachadas → **muerto** |

Con Aguante 6: un golpe de 5 quita 5 de Resistencia y **ninguna** luna · uno de 6 quita 6 y **una** luna ·
uno de 13 quita 13 y **dos** lunas. Por eso parecía roto: los golpes pequeños vacían la Resistencia sin
tocar las lunas, y eso es correcto.

Verificado además contra el PDF: **Magullado NO penaliza** («puede realizar todo tipo de acciones sin
penalización alguna»); Herido −1 dado; Malherido −2. Coincide con `HEALTH_LEVELS`.
⚠ Rareza del libro, anotada sin resolver: dice «**seis** niveles básicos de salud» y luego lista **cinco**.

### Qué hay que hacer con esto (pedido del dueño, sin empezar)
**«Que esta lógica funcione por detrás y cuando coma daño lo vaya poniendo. Esto tiene que facilitarle la
vida a los jugadores.»** Hoy el motor calcula bien pero la ficha no lo cuenta ni lo automatiza:
1. **Meter la tabla de p.99 en `RULES.md`** — es la deuda que causó todo esto.
2. Al recibir daño, **enseñar las dos consecuencias por separado** («−13 de Resistencia · 2 heridas → Herido»)
   en vez de dejar que el jugador deduzca. Hoy sólo se dice la resta de la protección.
3. **Reducir la severidad con Fortuna** (p.99, «un punto por cada nivel de severidad que se quiera
   reducir»): no existe. `applyDamage` ya acepta un parámetro `fortune` que nadie le pasa.
4. Comprobar el aviso de **inconsciente** en pantalla: la regla SÍ está implementada
   (`applyDamage`: Resistencia a 0 y un punto más → `unconscious`), pero no se avisa de nada.

## 🧾 Sesión del 2026-08-19 (noche) — rama `fix/ficha-listas`, SIN Review, SIN QA, SIN mergear
Seis commits sobre `main`. **Nada de esto está en producción.** La rama arregla lo que el dueño vio en
local y va acompañada de capturas hechas con la app corriendo.

- **La ficha se monta como el `.pen`**: rejilla de SEIS columnas con `SectionDef.span` en sextos, no
  `auto-fit`. Medido sobre `qjLDu` (1601): Identidad/Dificultad/Armas/Historia fila entera ·
  Características y Estado a la MITAD (793) · Dones/Equipo/Armadura a un TERCIO (523). Antes salían
  cuatro columnas estrechas con media pantalla vacía.
- **Las listas a UNA línea**, sin `flex-wrap`; la luna sólo en listas con acción (Dones sí, Equipo no); el
  contador sin rótulo repetido y pegado a la derecha. Las filas son **texto**, no desplegables
  (`rowPicker` los deja sólo en el generador, que es donde se elige).
- **Revertido el `span: 2` de Estado**: dejaba un vacío enorme. El hueco se arregla componiendo, no
  ensanchando.
- **Cargador y Munición como columnas separadas**, con botón de recargar. `reload()` llenaba el cargador
  **de la nada**; ahora saca de `reserve`. El cargador es **sólo lectura**: lo mueven disparar y recargar.
- **La munición se gasta al disparar.** ⚠ Me equivoqué al decir que «1 disparo = 1 bala» era lectura
  nuestra: lo fija la tabla de armas (p.97), donde arco, ballesta y tirachinas ponen **Cargador 1** — eso
  sólo tiene sentido si la unidad es un disparo. `ActionDef.spend` nuevo (null = no se puede pagar → botón
  apagado) y `ActionDef.toRoll` pasa a opcional (recargar no tira dados).
- **Cada arma ofrece SÓLO su acción** (`ActionDef.appliesToRow`) y el cargador no sale en las de cuerpo a
  cuerpo (`FieldDef.appliesToRow`): el libro les pone «-» en las nueve (p.97).
- **El alcance ya sale traducido y con los metros**: «Medio · hasta 50 m · dif. 3» (p.95–96). Antes salía
  literalmente «medium».
- Fuera el **registro de tiradas duplicado** de la ficha; queda sólo el aviso de fallo.
- Las casillas de Resistencia más grandes (20 px) y en UNA fila a lo ancho; botón de daño en **color
  sangre**; números calculados centrados con filete corto entre dos (Armadura); Estado reordenado.
- **El botón de recibir daño NO estaba roto**: con protección 6 un daño de 5 da 0 y no pasaba nada, sin
  decir nada. Ahora la línea de abajo dice la cuenta: «5 − 6 de protección = 0 · la armadura lo para
  entero».

### ✅ Los cuatro puntos de pantalla — HECHOS (2026-08-19 noche, commit `2182f38`)
Los cuatro se hicieron mirando la app corriendo (`scripts/shot.mjs`), antes y después:
1. ~~Aguante y Resistencia máxima en tarjetas cuadradas centradas~~ ✅
2. ~~Penalización por heridas y Resistencia recuperable, una al lado de la otra~~ ✅
3. ~~Casillas de Resistencia y lunas centradas~~ ✅
4. ~~Tooltip en el alcance~~ ✅ — la celda dice «Medio» y el tooltip «Hasta 50 m · dificultad 3».
5. **Sigue SIN empezar**: todo lo de la sección «LA REGLA QUE SE NOS ESTABA ESCAPANDO».

### 🔬 Ahora se puede VER lo que se escribe: `scripts/shot.mjs`
Playwright entra como dependencia de desarrollo. El script levanta sesión, entra en la mesa y captura la
ficha entera y cada sección por separado (`/tmp/full.png`, `/tmp/sec-<sección>.png`). **Existe porque se
subió a producción una tanda entera validada sólo con tests unitarios y medidas de contraste, y se veía
mal.** Orden del dueño: no volver a trabajar a ciegas en pantallas. `TABLE=<uuid> node scripts/shot.mjs`.

Datos de prueba en local: campaña `8f506705-e348-415c-82a9-5a37e2c0ce51`, personaje **Karen Sinclair**
(`3af4f238-25ad-4cf1-a264-09d7586019d8`) con dones, equipo, chaleco antibalas, nudilleras y un magnum.
`admin@rolvium.local` / `rolvium123`.

## 🗒️ Backlog (decisiones del dueño y deuda conocida)

### 🗺️ La escena — siete peticiones del dueño (2026-08-20). Nada empezado
El **orden que él fijó**: primero las tiradas y el bestiario; el punto 7 (niebla degradada) va **después** de esas
dos. Los demás no llevan orden.

1. **Probar la niebla desde el mapa.** Un botón en la escena que deje **ver el mapa como lo ve un jugador**, con
   los tokens de los personajes puestos, para comprobar la niebla antes de la partida. Hoy el director sólo ve su
   propia vista y no hay forma de comprobarlo sin otra sesión abierta.
2. **Luces dinámicas.** Poder colocar luces con **forma** —cono, radio o cuadrado— y **tipo**: antorcha, bombilla,
   fuego. (Y lo que aporte el diseño: farol, linterna, luz de luna, resplandor mágico; cada tipo con su color, su
   alcance y su parpadeo — una antorcha tiembla, una bombilla no.)
3. **Capas en el mapa, con solapamiento.** Se dibuja/coloca **en la capa activa**, y con el botón derecho sobre un
   objeto un desplegable deja **mandarlo a otra capa**. (Falta decidir qué capas por defecto: fondo · terreno ·
   objetos · criaturas · efectos · notas del director.)
4. 🐛 **El modal de «subir imagen de fondo» aparece en la otra punta de la pantalla.** Sale lejos del botón que lo
   abre. Es un bug de colocación, no un rediseño.
5. **Tirar imágenes sueltas en la escena**, además del fondo: la cara de un PNJ, un objeto, una pista… y **poder
   moverlas** por encima del mapa. Va con el punto 3 (¿en qué capa cae?) y con el compresor de imágenes
   (`specs/core/images`).
6. **Fondos animados**: poder elegir de fondo un **GIF** o un **vídeo**. El vídeo **por enlace** (YouTube o
   similar), **NO subiendo el fichero** — decisión explícita del dueño, y además evita pagar almacenamiento.
7. **La niebla no se corta de golpe** (⚠ **después** de tiradas y bestiario): los personajes ven a cierta distancia
   de noche o a oscuras, y hoy la visión termina en un borde duro. Tiene que **degradarse hasta el negro**, no
   cortarse. Es lo que ya hace `vision_radius` en los tokens, pero pintado con un degradado en vez de un círculo.


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
> Retomo Rolvium: lee WORK_STATE.md **empezando por los bloques 🔴 REVISIÓN DE «ESTADO» CONTRA EL PDF y
> 🧱 MAQUETACIÓN**, y luego ARCHITECTURE.md. Estoy en la rama `fix/ficha-listas` con ocho commits que NO
> están en `main` — comprueba `git status` y `git log main..HEAD`. Ejecuta esos dos bloques enteros: el
> desplegable de Inconsciente pasa a calculado, el techo de Fortuna es Destino, decidir conmigo lo de
> «Resistencia máxima» cuando estás herido, y los cuatro arreglos de maquetación. Corrige `RULES.md`
> ANTES del código (el sexto nivel de salud es Inconsciente, p.101). Y no toques una pantalla sin verla:
> `node scripts/shot.mjs`.
>
> **Regla número uno de esta fase: no se toca una pantalla sin verla.** `node scripts/shot.mjs` levanta
> sesión y captura la ficha (necesita `npm run db:start`, `npm run dev:api` y `npm run dev:web`). Se subió
> una tanda entera validada sólo con tests y se veía mal; el dueño lo dejó claro.
>
> Sigue por, en este orden:
> 1. **La lógica de daño → Resistencia → Salud** (sección «LA REGLA QUE SE NOS ESTABA ESCAPANDO»). Meter la
>    tabla de p.99 en `RULES.md`, enseñar las dos consecuencias al recibir daño, avisar del inconsciente, y
>    la reducción de severidad con Fortuna (p.99), que no existe. Objetivo del dueño: **que le facilite la
>    vida al jugador**, no que tenga que deducirlo.
> 2. ~~Los cuatro puntos de pantalla~~ **HECHOS** (commit `2182f38`), pero al tooltip del alcance le
>    falta el test — escríbelo antes de nada.
> 3. **Review + QA a `fix/ficha-listas` y mergear.** No se ha pasado ninguno de los dos.
> 4. Lo que siga del backlog: Estado compuesto como el `.pen`, armadura + escudo (backlog 16), los tokens
>    de contraste que faltan, y Aventuras (H12), cuyo spec está cerrado y sin construir.
>
> El manual manda: PDF en `~/Documents/Developer/Rolvium context/PlenilunioEbook.pdf`, **con 2 de desfase**
> sobre las páginas del libro. Y **léelo del PDF, no de RULES.md**: la tabla de heridas de p.99 no estaba en
> RULES.md y por eso se nos escapó una regla entera.
> Diseño en `.pen` ANTES de cualquier código de UI. Flujo: dev → review → qa.
> Local: campaña `8f506705-e348-415c-82a9-5a37e2c0ce51`, personaje Karen Sinclair, `admin@rolvium.local` /
> `rolvium123`.

### Lección de esta sesión, que se repitió cuatro veces
**Un guardia que mide sólo el estado RESULTANTE convierte cualquier borrador ya fuera de norma en un callejón
sin salida**, porque veta también los controles que lo repararían. Se capa la subida, nunca la bajada. Salió en
el canje de dones, en el cupo de especialidades, en el techo del Destino y en el canje contra el valor recortado.
Y su gemela: **un control vetado tiene que VERSE vetado**; si no, el usuario elige y no pasa nada.

**Y la de fondo**: producción llevaba dos días congelada porque la rama nunca se pusheó, y media mañana se fue
en diagnosticar «bugs» que ya estaban arreglados. **Comprueba `git log origin/main` antes de creerte cualquier
«esto está roto en producción».**

## 🚫 Bloqueos / notas
### ⚠️ La sección de Vercel de abajo está VIEJA — el dueño lo desmintió (2026-08-19 noche)
Palabras suyas: «lo del bloqueo vivo tiene que ser viejo porque está todo subido y lo veo funcionando».
O sea: las variables de entorno y el proyecto web ya están puestos, y `rolvium.vercel.app` ya no da 404.
**No lo he verificado yo** (no toco producción sin que se pida), así que lo dejo escrito tal cual y sin
borrar el histórico. Lo que siga sin comprobar de esa lista, se comprueba en el chat nuevo antes de
creérselo en ninguna dirección.

### Vercel — el API existe y despliega solo, pero le faltan las variables (2026-08-19) [DESMENTIDO ARRIBA]
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
