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
- **Rebanada 3 — ESTE SPEC** (§ «Rebanada 3»): la escena deja de ser una pestaña con cabecera y pasa a ocupar la
  pantalla. Rail de escenas plegable, una sola barra de herramientas con Dados dentro, **herramienta Seleccionar**
  (mover y editar muros y vértices), puertas que **parten** el muro donde se dibujan, y dados 3D al tirar.
- **Rebanada 4 — pendiente**: movimiento máximo por turno, configurable **por sistema** (toca el puerto `GameSystem`).
- **Rebanada 5 — pendiente**: galería de componentes (muebles, árboles…) para construir mapas dentro de la app.

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

## Rebanada 3 — la escena a pantalla completa, seleccionar y editar

Diseño aprobado en `rolvium.pen`, frame **`sFipl`** («Mesa/Plenilunio · Escena · Rediseño»). Todo lo de abajo sale de
la prueba del dueño sobre la rebanada 2 ya construida: son correcciones de uso, no ideas nuevas.

### La pantalla: sin cabecera y sin scroll
- **Se elimina la banda «ESCENA · <nombre>»** que había sobre el lienzo. El dueño la señaló como espacio muerto: el
  nombre de la escena ya lo dice el rail, y la etiqueta de dentro del lienzo ya dice en qué vista estás. La nota del
  jugador («la directora decide la luz») se va al pie, donde ya hay una.
- **El lienzo ocupa todo el alto disponible y la vista de escena NO scrollea.** Hoy no lo hace porque `.mp-stage`
  lleva `height: min(70vh, 640px)` fijo y la fila del cuerpo de la mesa usa `align-items: flex-start`, así que ni el
  lienzo ni el panel lateral se estiran. El lienzo y la barra de dados quedan **a la misma altura por construcción**
  (misma fila estirada), no cuadrando un número a mano — un número se desajusta con cualquier cambio de contenido.

### Rail de escenas (sustituye al desplegable)
- Barra lateral **izquierda, plegable**, con una fila por escena: **miniatura + nombre**, punto oro en la activa.
  Abajo, «+ Escena». Se pliega a una tira estrecha para recuperar ancho de mapa.
- Sustituye al desplegable de escenas de la cabecera: elegir escena pasa de dos clics a uno, y se ve de un vistazo
  cuál estás mirando y cuál ven los jugadores.

### Una sola barra de herramientas, en tres bloques
Deja de ser «herramientas del lienzo» y pasa a llevarlo todo, **rotulada por bloques** para que no se mezcle lo que
cambia el cursor con lo que abre un panel:
| Bloque | Herramientas |
|---|---|
| **JUEGO** | **Dados** (primera de todas) · Seleccionar · Medir · Pin |
| **LIENZO** | Lápiz · Línea · Caja · Círculo · Borrar |
| **DIRECTOR** (separador oro) | Muro · Revelar · Ocultar ‖ Encuentro · Colocar PJ · Fondo del mapa |
- Las tres últimas del bloque de director abren panel en vez de cambiar el cursor, y van tras un separador propio.
- «Fondo del mapa» y «Colocar PJ» **dejan la cabecera** (que desaparece) y viven aquí.

### Seleccionar: una herramienta, y el paneo como modificador
- **Seleccionar** (`arrow_selector_tool`) reemplaza a «Mover» en la barra. Con ella se elige y se edita: tokens,
  trazos y **muros**.
- **El paneo deja de ser una herramienta**: se panea con **la barra espaciadora mantenida** o con el **botón central**
  del ratón, desde cualquier herramienta, y al soltar vuelves a lo que estabas. (El botón central ya lo hace hoy;
  falta la barra espaciadora.) Se descartó fusionar Seleccionar y Mover en una sola herramienta: dos formas de
  «clic sobre una cosa» conviviendo es justo lo que confunde.
- **Muro seleccionado**: se resalta en oro y saca **un tirador cuadrado en cada vértice**. Arrastrando el segmento se
  mueve entero; arrastrando un vértice se estira. Es lo que hoy no se puede hacer: un muro mal puesto sólo se puede
  borrar y volver a trazar.
- Con el muro seleccionado aparece la **barra de segmento** (misma familia que la barra de token): tipo
  `MURO · PUERTA · VENTANA`, «visible para jugadores» y papelera. **Ahí se cambia el tipo de un segmento ya puesto.**
- **Abrir y cerrar una puerta** deja de depender de la herramienta Muro: al pasar el ratón sobre una puerta o ventana
  sale un **disco oro con icono de puerta** sobre el vano; un clic la abre o la cierra. Esto arregla además el choque
  que tenía la rebanada 2 (empezar un muro cerca de una puerta la abría en vez de dibujar), porque **Muro pasa a ser
  sólo de construcción**. Cuando en una rebanada posterior un jugador pueda abrir la puerta que su token alcance, el
  gesto ya es el mismo.

### Una puerta dibujada sobre un muro lo parte
- Hoy los segmentos se superponen: dibujar una puerta encima de un muro deja los dos, el muro sigue cortando la vista
  y **la puerta no hace nada**. Es el agujero más grave que dejó la rebanada 2.
- A partir de ahora, dibujar una puerta o una ventana **sobre** un muro **parte el muro**: el tramo solapado se
  convierte en la abertura y el muro queda en los dos trozos que sobran (los de longitud cero no se guardan).
- La abertura **se pega al muro** que tiene debajo (se proyecta sobre su recta) para que nunca quede un pelo torcida
  y siga cortando por los lados. Si no hay ningún muro debajo, se crea suelta, como hoy.
- El recorte es geometría pura y va en `mapRules`, con test: es la clase de cosa que se rompe en silencio.

### Dados 3D
Es del hexágono `dice` (H6) — ver `specs/modules/dice/SPEC.md` § «Dados 3D». Aquí sólo consta que el lanzador se abre
desde la primera herramienta de esta barra.

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
