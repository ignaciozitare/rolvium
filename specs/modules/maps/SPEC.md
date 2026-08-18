# Maps (H7) — SPEC

## Purpose
La escena: un plano de fondo, muros invisibles, niebla por línea de visión, tokens, dibujos compartidos y pin de
enfoque. El director prepara; el grupo juega encima. Who: todos; muchas herramientas son solo del director.

## Estado por rebanadas
- **Rebanada 1 — HECHA** (2026-08-18): escenas, fondo + biblioteca de imágenes, muros rectos, tokens (PJ y bestiario),
  dibujos, medir, pin, zoom/pan, «ver como jugador». Sin niebla: las herramientas Revelar/Ocultar salen deshabilitadas.
- **Rebanada 2 — HECHA** (2026-08-18): niebla y visión calculadas en servidor, luz de la escena (día/noche), pincel
  revelar/ocultar, y **puertas y ventanas**: el director las **crea** eligiendo el tipo en la barra «Muro», y las abre y
  cierra con clic (el selector se diseñó antes en `rolvium.pen` `h3Q3NN`).
- **Rebanada 3 — pendiente**: movimiento máximo por turno, configurable **por sistema** (toca el puerto `GameSystem`).
- **Rebanada 4 — pendiente**: galería de componentes (muebles, árboles…) para construir mapas dentro de la app.

## What the user can do
- **Escenas** (solo DJ): crear, nombrar, activar (**el director decide qué escena ven los jugadores**), subir fondo.
- **Fondo del mapa** (popover, solo DJ): **color de base** (muestras + hex + cuentagotas; se ve donde no llega la
  imagen) y **biblioteca de imágenes** de la campaña (subir, elegir, ninguna) con ajuste Cubrir / Encajar /
  Reposicionar.
- **Barra vertical de herramientas** (izquierda del lienzo): Mover · Medir · Pin | Lápiz · Línea · Caja · Círculo ·
  Borrar; director además (separador oro): Muro · Revelar · Ocultar · **Encuentro** (abre desplegable con buscador y
  todas las entradas del bestiario; clic en el mapa coloca una instancia).
  - **Cada botón muestra un tooltip propio al pasar el ratón** con el nombre de la herramienta (componente
    `PL/Tooltip herramienta`). Los iconos solos no se entienden — el dueño no supo identificar el de Muro (`fence`) —
    y el `title` nativo del navegador tarda casi un segundo, se coloca donde quiere y no sigue el aspecto del sistema.
    El `aria-label` que ya existe se queda: el tooltip es visual, no sustituye a la accesibilidad.
- **Barra de Trazo** (idéntica para todos): grosor, colores, "lo que dibujas lo ve toda la mesa", limpiar mis trazos.
- **Controles del lienzo** (esquina inferior derecha): acercar, alejar, centrar; DJ además ver/ocultar paredes y
  "ver como jugador".
- **Lienzo** ocupa todo el ancho disponible; grilla fina (27 px base, ajustable) para casar con el plano.
- Capas: fondo → muros → dibujos/textos → tokens → niebla → interfaz (medida, pin, selección).
- Vista de jugador: solo su polígono de visión + lo explorado; **los muros no se dibujan** salvo los marcados `visible_players`
  (excepción explícita del modelo de datos: sirve para mostrar una verja o una barandilla) (la niebla se corta contra
  las paredes del plano); tokens ocultos no existen para él. Vista de director: etiqueta "VISTA DE DIRECTOR", muros
  en oro, velo azulado sobre lo no explorado, tokens ocultos con borde oro.
- Todos: mover tokens propios, medir, pin de enfoque (centra la vista de quien lo acepte), dibujar/escribir, borrar lo
  propio (el DJ, cualquiera). DJ: pincel revelar/ocultar con tamaño, revelar/ocultar todo, niebla automática por visión
  o manual, muros (con `visible_players` por si conviene mostrarlo), mostrar/ocultar tokens.

## Rebanada 2 — niebla, visión, luz y aberturas

### Quién ve qué
- **Cada jugador ve lo que ve su token.** Su visión es la de los tokens que controla (hoy, el de su PJ). Un jugador sin
  token en la escena no ve nada más que lo que ya tenga explorado.
- **Mover:** cada jugador mueve **sólo sus** tokens; el director mueve cualquiera. (Ya vigente desde la rebanada 1.)
- **Explorado** es por jugador y escena, y persiste entre sesiones. El **director ve la unión** de lo explorado por
  todos; no hay selector por jugador en esta rebanada.

### Luz de la escena (ajuste de la escena, no del token)
- Cada escena tiene una **luz**: **Día** (se ve todo lo que la geometría permita) o **Noche** (se ve hasta el
  equivalente a **10 metros**). Por defecto: **Día**.
- El alcance se guarda en **metros** porque es lo que el dueño razona en la mesa; la conversión a casillas usa los
  metros por casilla del sistema. ⚠ Hoy `METRES_PER_CELL = 1.5` está fijo en `mapRules` de la plataforma: es una regla
  de Plenilunio viviendo en el sitio equivocado. Se deja como está en esta rebanada y se anota como deuda.
- La luz la cambia sólo el director, y afecta a todos los jugadores de esa escena a la vez.

### Niebla
- Interruptor **«Niebla automática por visión»** (barra de Opciones DJ): alterna **`vision`** (la calcula el servidor a
  partir de los tokens y los muros) y **`manual`** (sólo se revela con el pincel). El tercer estado `off` existe en la
  base de datos pero **no tiene interfaz** todavía.
- **Pincel Revelar / Ocultar** (sólo director), con tamaño. Pinta sobre lo explorado de **todos** los jugadores de la
  escena. Las dos herramientas que la rebanada 1 dejaba deshabilitadas ya están activas (`TOOLS_NOT_YET` quedó vacío).
- Botones **Revelar todo** y **Ocultar todo** de la escena.
- El tamaño del pincel y los botones «Revelar todo» / «Ocultar todo» viven en la barra de Trazo, que cambia a modo
  «Pincel» mientras la herramienta activa sea Revelar u Ocultar (diseñado en `rolvium.pen` `uXK3T` antes de la UI).

### Puertas y ventanas
- Un muro deja de ser sólo un segmento: tiene un **tipo** y, si procede, un estado **abierto/cerrado**.
  | Tipo | Corta la vista | Corta el paso | Se abre |
  |---|---|---|---|
  | **Muro** | sí | sí | no |
  | **Puerta** | sólo cerrada | sólo cerrada | sí |
  | **Ventana** | nunca (para eso es) | sólo cerrada | sí (para el paso, no para la vista) |
- «Corta el paso» **no tiene efecto todavía**: no hay reglas de movimiento hasta la rebanada 3. Se guarda ahora para no
  volver a migrar la tabla.
- **Crear** una abertura: con la herramienta Muro activa la barra de Trazo pasa a modo «Muro» y ofrece el **tipo** del
  siguiente segmento (Muro · Puerta · Ventana, diseñado en `rolvium.pen` `h3Q3NN`). El tipo **fija los flags**: un
  segmento nuevo se construye siempre con `newWallOf(kind)`, así que una ventana no puede nacer cortando la vista.
  Sólo el director: la herramienta es suya y la RLS de `maps_walls` sólo deja escribir al DJ.
- Abrir y cerrar **lo hace el director** en esta rebanada. Que un jugador abra una puerta que su token alcanza queda
  fuera de alcance (necesita adyacencia, y eso es materia de la rebanada 3).
- Abrir o cerrar una puerta **recalcula la visión de todos** en el acto.

### Qué se dibuja
- **Jugador:** fuera de su visión y de lo explorado, **el mapa no está** — negro, no un velo. Dentro de lo explorado
  pero fuera de la visión actual, el fondo se ve apagado. Los muros **no se dibujan** salvo los `visible_players`.
  Etiqueta «<ESCENA> · TU VISIÓN».
- **Director:** ve el mapa entero con un **velo azulado** sobre lo no explorado y los muros en oro; las puertas se
  distinguen del muro y se ve si están abiertas. Etiqueta «VISTA DE DIRECTOR · MUROS Y TOKENS OCULTOS VISIBLES».
  «Ver como jugador» sigue mostrando la escena tal y como la ve el grupo.

## Rules & limits
- El **cálculo de visión ocurre en el servidor** con todos los muros; al jugador le llega el polígono resuelto. Los
  muros con `visible_players=false` no viajan al cliente del jugador (RLS). **Esta es la frontera de seguridad**: si la
  visión se calculase en el cliente, habría que mandarle la planta entera y cualquiera la leería en el navegador.
- La API expone dos operaciones (prefijo `/scenes`, ambas autenticadas): `POST /scenes/:id/vision` recalcula y devuelve
  **lo que ve quien llama** (jugador: sus tokens; director: la unión de lo explorado por todos) y persiste lo explorado;
  `POST /scenes/:id/fog` es el pincel del director (`reveal`/`hide`, por casillas o «todo») y escribe sobre lo explorado
  de **todos** los jugadores de la campaña. El servidor usa service role: lee todos los muros, decide, y devuelve
  polígonos y casillas — nunca la geometría oculta.
- **Lo explorado se guarda como casillas** (`maps_fog.explored` = `[[x,y], …]` en coordenadas de celda), no como
  polígonos libres: la unión entre sesiones es entonces una operación de conjuntos, está acotada por el tamaño de la
  escena y es exactamente lo que el pincel pinta. La **visión actual** sí viaja como polígono, porque se dibuja nítida.
- La visión se recalcula cuando: se mueve un token, se abre o cierra una puerta, cambia la luz o los muros de la
  escena, o el jugador entra en la escena.
- Niebla explorada por jugador y escena; persiste entre sesiones. Lo explorado **no se olvida** al alejarse.
- Trazos con autor; pins efímeros (broadcast). Arrastre en broadcast, posición final persistida.
- Máximos orientativos: 20 escenas, 60 tokens/escena, 200 trazos/escena.

## Connections
`bestiary` (encuentros, instancias), `characters` (token del PJ), `realtime`, `table`. Storage bucket `backgrounds`
(biblioteca por campaña).

## Modelo de datos
- **`maps_scenes`**: escenas de una campaña (nombre, tamaño, color de base, imagen de fondo + ajuste, grilla, modo de niebla
  `vision`|`manual`|`off`, orden, `visible_players`). Los jugadores ven una escena si está marcada visible **o es la activa**
  (`campaigns.active_scene_id`, ahora con FK real). El director hace todo.
- **`maps_walls`**: segmentos por escena; a los jugadores sólo les llegan los marcados `visible_players` (RLS). La visión se
  calcula en la API con todos los muros.
- **`maps_tokens`**: PJ o instancia de bestiario, posición/tamaño en celdas, imagen, color, `visible` (oculto = no existe para el
  jugador por RLS), `controlled_by` (jugador que puede moverlo), radio de visión, `state` (p.ej. PV de la copia). Un jugador sólo
  puede cambiar `x`/`y` de sus tokens (trigger); el director cualquier cosa.
- **`maps_drawings`**: trazos/líneas/cajas/círculos/textos con autor; leen los miembros de escenas visibles, inserta el autor,
  borra el autor o el director.
- **`maps_fog`**: polígonos explorados por (escena, usuario); cada jugador lee lo suyo, el director todo y puede escribir
  (revelar/ocultar manual); la API escribe con service role tras calcular la visión.
- **`maps_images`**: biblioteca de fondos de la campaña (bucket público `backgrounds/{campaignId}/…`, 10 MB, sólo el director sube).
- Realtime: `maps_scenes/walls/tokens/drawings/fog` en la publicación; el arrastre va por broadcast y la posición final se persiste.
- Migración: `supabase/migrations/20260818130000_maps.sql`.

### Rebanada 2 — luz y aberturas
Migración `supabase/migrations/20260818140000_maps_vision.sql`. **Puramente aditiva**: no crea tablas ni políticas
nuevas, sólo columnas con valor por defecto sobre dos tablas que ya existían. Los muros ya dibujados se quedan como
muros cerrados que cortan vista y paso, que es justo lo que hacen hoy, así que no hubo que rellenar nada a mano.

- **`maps_scenes`** gana la **luz de la escena**: `lighting` (`day` o `night`, por defecto `day`) y `night_radius_m`
  (hasta dónde se ve de noche, **en metros**, por defecto 10, entre 0 y 500). Se guarda en metros y no en casillas
  porque es la unidad en la que se razona en la mesa; la conversión la hace quien dibuja, con los metros por casilla
  del sistema. Lo cambia sólo el director (política `maps_scenes_dm_write` que ya existía).
- **`maps_walls`** gana **qué es cada segmento**: `kind` (`wall`, `door` o `window`), `blocks_sight`, `blocks_move` y
  `is_open`. La semántica es deliberadamente uniforme, para que el cálculo de visión sea una condición y no un `switch`
  por tipo: **corta la vista ⇔ `blocks_sight` y no está abierto**; **corta el paso ⇔ `blocks_move` y no está abierto**.
  De ahí salen los tres tipos de la tabla de arriba. Una restricción impide abrir un `wall`; otra rechaza tipos y luces
  que no existan. `blocks_move` todavía no hace nada — no hay reglas de movimiento hasta la rebanada 3 — pero se guarda
  ya para no volver a migrar. Abrir y cerrar es un UPDATE del director, que la política `maps_walls_dm_write FOR ALL`
  ya cubría; no hizo falta política nueva.
  - La columna es `is_open` y no `open` porque `OPEN` es palabra reservada de PL/pgSQL.
- **`maps_fog`** no cambia: la rebanada 1 ya la dejó con la forma que la visión necesita (`explored` por escena y
  jugador). La escribe el servidor tras calcular la visión, y el director a mano con el pincel.
- Realtime: `maps_scenes` y `maps_walls` ya estaban en la publicación, **pero `postgres_changes` aplica la RLS de cada
  suscriptor**: al jugador NO le llega el evento de una puerta que no puede ver (`visible_players = false`), que es el
  caso normal. Por eso abrir una puerta no puede llegar «sola» por la tabla. Lo que viaja es un **`broadcast`**
  (`fog.updated` en el canal `scene:{id}`, sin RLS) que dice «vuelve a pedir tu visión»; cada cliente llama entonces al
  servidor y recibe su polígono recalculado. Al director sí le llegan los dos caminos porque él ve todas las filas.
