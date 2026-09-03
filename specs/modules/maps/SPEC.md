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
- **Rebanada 4 — ESTE SPEC** (§ «Rebanada 4»): **paredes sólidas** — los tokens dejan de atravesar los muros,
  con un interruptor por escena. Confirmada por el dueño el 2026-08-22.
- **Rebanada 5 — pendiente**: movimiento máximo por turno, configurable **por sistema** (toca el puerto `GameSystem`).
  Las dos deudas que la rebanada 3 se dejó (la puerta que parte el muro y el disco de abrir al pasar el ratón) se
  construyeron el 2026-08-19, antes de empezarla.
- **Rebanada 6 — A MEDIAS, SIN PANTALLA** (§ «Rebanada 6»): **galería de piezas** (muebles, árboles…) para
  construir mapas dentro de la app. Confirmada por el dueño el 2026-08-31, **después** de la 7 y **antes** de la
  5: sin capas no había dónde meter las piezas, y ahora que existen es lo que falta para montar un mapa sin
  salir de Rolvium.
  > ⚠ **Está construida de abajo arriba y le falta TODA la interfaz.** Ya existen y están en producción: el
  > esquema (`maps_props`, `maps_scene_props`), `propRules.ts` con sus tests, los 8 métodos del puerto
  > `MapsPort` y su implementación entera en `SupabaseMapsRepo` con realtime. **No existe ni la galería, ni el
  > botón que la abre, ni forma de plantar una pieza.** Es inerte y no molesta —las tablas están vacías y nada
  > puede llegar a ellas—, pero que nadie dé la rebanada por hecha. El botón `Piezas` está dibujado en
  > `rolvium.pen` y **deliberadamente NO está en el código**: un botón que no abre nada es peor que ninguno.
  > ✅ **FECHA PUESTA (decisión del dueño, 2026-09-01)**: el andamio **se queda** y la galería **se construye
  > justo después de la sonda de prueba (§ 7.3) y del arreglo de la puerta**. No se borra nada — ni las 12
  > funciones de `propRules.ts`, ni los métodos del puerto, ni las dos tablas vacías de producción. Queda así
  > cerrado el «no vale dejarlo sin fecha» que señalaron QA y la limpieza del 2026-09-01.
- **Rebanada 7 — A MEDIAS** (§ «Rebanada 7»). Confirmada por el dueño el 2026-08-31, y va **ANTES que la 5 y
  la 6** (decisión suya del mismo día): es donde pasa la partida y es lo que menos se ha tocado desde que lo
  pidió (2026-08-20).
  - ✅ **HECHO** (2026-08-31): el modelo de datos entero · el **panel de capas** (ojo, candado, orden, borrar,
    aviso de peso) · las **capas de terreno apiladas con su máscara** pintándose en el lienzo · las **luces de
    ambiente** de punta a punta, con su herramienta, su editor y el **parpadeo animado** por tipo.
  - ✅ **HECHO también** (2026-08-31, noche): el **pincel de transparencia** con sus dos sentidos · **mandar
    elementos a otra capa** con el botón derecho.
  - 🔄 **REESCRITA § 7.3** (2026-09-01): la lente «ver con los ojos de ‹personaje›» se construyó la noche del
    31-ago, llegó a producción y **dejaba el mapa en negro**. El dueño mandó **borrarla entera** y la sustituye
    la **sonda de prueba** (§ 7.3). El código de la lente se retira; la sonda está sin construir.
  - 🛑 **BLOQUEADA la penumbra**: su premisa de privacidad no se sostiene hoy — ver el aviso en § 7.4. El
    dueño lo dio por bueno y decidió **dejar las fichas como están** (2026-08-31): no se toca cómo llegan.
  - ✅ **HECHO** (2026-08-31, cierre): las luces **ya no atraviesan los muros** y entran en la visión con las
    reglas del § 7.2 «Las luces iluminan de verdad», calculadas en el servidor y para todos.

## What the user can do
- **Escenas** (solo DJ): crear, nombrar, activar (**el director decide qué escena ven los jugadores**), subir fondo.
- **Fondo del mapa** (popover, solo DJ): **color de base** (muestras + hex + cuentagotas; se ve donde no llega la
  imagen) y **biblioteca de imágenes** de la campaña (subir, elegir, ninguna) con ajuste Cubrir / Encajar /
  Reposicionar.
- **Barra vertical de herramientas** (izquierda del lienzo), en tres bloques separados por reglas: **Dados** ·
  Seleccionar · Medir · Pin | Lápiz · Línea · Caja · Círculo · Texto · Borrar; director además (separador oro):
  Muro · Revelar · Ocultar ‖ **Encuentro** · Colocar PJ · Fondo del mapa (estas tres abren panel).
  **Panear no es herramienta**: barra espaciadora o botón central, desde cualquiera.
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
  Desde la rebanada 3 la barra del pincel **flota sobre el lienzo**, no ocupa una franja a lo ancho.
- Botones **Revelar todo** y **Ocultar todo** de la escena.
- El tamaño del pincel y los botones «Revelar todo» / «Ocultar todo» viven en la barra de Trazo, que cambia a modo
  «Pincel» mientras la herramienta activa sea Revelar u Ocultar (diseñado en `rolvium.pen` antes de la UI). Desde la
  rebanada 3 el **tipo de segmento** ya no vive ahí: tiene su propia barra «Segmento» flotando sobre el mapa.

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
- **Abrir y cerrar una puerta ya no depende de la herramienta Muro**: al pasar el ratón sobre una puerta o una
  ventana sale un **disco oro con icono de puerta** sobre el centro del vano, y ese disco la abre o la cierra. Con
  eso **Muro pasa a ser sólo de construcción** y muere el choque de la rebanada 2 (empezar un muro cerca de una
  puerta la abría en vez de dibujar). El botón Abrir/Cerrar de la barra «Segmento» sigue estando: es el camino con
  teclado, porque un disco al pasar el ratón no lo es.
  - El disco es **del director**, mide **lo mismo en pantalla a cualquier zoom** (es un control, no un dibujo del
    mapa) y no sale sobre un muro que el director tenga oculto: no se abre lo que no se ve.
  - **El disco nunca se traga la pulsación**: un *clic* abre o cierra, pero *arrastrar* desde él es lo que haga la
    herramienta. Sin eso, una puerta de una casilla quedaría debajo del disco y no se podría ni elegir ni mover ni
    borrar — el disco taparía justo el cuerpo por el que se agarra un segmento.
  - Por eso mismo **sólo aparece con las herramientas cuya pulsación empieza un gesto**: Seleccionar, Medir y las de
    dibujo. Con las que actúan en la propia pulsación (Muro, Pin, Texto, Borrar y los pinceles) tendría que robarla,
    y robar pulsaciones es justo como funcionaba el choque de la rebanada 2. Tampoco con algo a medias: un muro
    empezado, un arrastre en curso o algo pendiente de colocar.

### Una puerta dibujada sobre un muro lo parte
- Antes los segmentos se superponían: dibujar una puerta encima de un muro dejaba los dos, el muro seguía cortando la
  vista y **la puerta no hacía nada**. Era el agujero más grave que dejó la rebanada 2.
- Dibujar una puerta o una ventana **sobre** un muro **parte el muro**: el tramo solapado se convierte en la abertura
  y el muro queda en los dos trozos que sobran (los de longitud cero no se guardan; ese cabo se lo queda la
  abertura, para que tirar el trozo no deje una rendija de nada justo en el extremo del muro).
- La abertura **se pega al muro** que tiene debajo (se proyecta sobre su recta) para que nunca quede un pelo torcida
  y siga cortando por los lados. Si no hay ningún muro debajo, se crea suelta, como antes.
- Un muro **no** parte a otro (estás construyendo, no abriendo) y una abertura **no** parte a otra abertura: lo que
  se agujerea es la mampostería. Con varios muros debajo se parte aquel sobre el que la abertura más se apoya.
  - ⚠ **Límite conocido**: una abertura dibujada a caballo entre **dos muros alineados** parte sólo uno, así que sale
    más corta de lo dibujada y el otro muro sigue cortando la vista por su mitad. Sale del mismo «se parte uno solo».
    Pendiente de decidir en la rebanada 4: o se parten todos los muros que solapa, o se avisa al dibujarla.
- La abertura **hereda «visible para jugadores» del muro que parte**: si no, al partir un muro que los jugadores
  veían dibujado les aparecería un hueco justo donde está el vano.
- El recorte es geometría pura y vive en `mapRules.planOpening`, con test: es la clase de cosa que se rompe en
  silencio. El guardado (los trozos primero, el muro original después) va en `useScene.addWall`, para que un fallo a
  medias deje el muro **entero** y superpuesto, nunca un agujero que nadie pidió.

### Dados 3D
Es del hexágono `dice` (H6) — ver `specs/modules/dice/SPEC.md` § «Dados 3D». Aquí sólo consta que el lanzador se abre
desde la primera herramienta de esta barra.

## Rebanada 4 — paredes sólidas

**Para qué.** Hoy los tokens atraviesan los muros como fantasmas. Con esto una pared es una pared, y el mapa deja
de ser un dibujo para empezar a ser un sitio (dueño, 2026-08-22: «que los tokens no puedan traspasar las paredes»).

### El interruptor
- **Uno por ESCENA**, junto a los de día/noche y niebla, y se guarda con ella. Lo pone el director.
  Elegido frente a uno por campaña porque una mazmorra y un descampado no piden lo mismo, y frente a uno
  volátil porque «se te olvida encendido o apagado».
- **Apagado deja todo exactamente como hoy.** Es la posición de partida de las escenas que ya existen: nada se
  vuelve sólido de un día para otro sin que el director lo pida.

### Cómo se siente
- Arrastras, el token llega a la pared y **resbala pegado a ella** mientras sigues moviendo el dedo — no se
  clava en el punto del choque ni pega un salto de vuelta al soltar.
- El movimiento sigue siendo **libre**, sin rejilla (rebanada 3 bis, 2026-08-22).

### Quién choca
- **Sólo los jugadores. El director pasa siempre**, esté el interruptor como esté (decisión del dueño).
- ⚠ Consecuencia aceptada: el director **no puede probar en su pantalla lo que siente un jugador**. Se mira
  entrando con una cuenta de jugador.

### El tamaño cuenta
- Choca **todo el cuerpo** del token, no su punto central: un gato (0,5 casillas) pasa por un hueco por el que
  un ogro (3,5) no cabe. Es la razón de que los tamaños de la p.25 existan.

### Qué bloquea y qué no
- Bloquea lo que ya lleva marcado `blocksMove`: **muros, ventanas y puertas cerradas**. Una **puerta abierta
  deja pasar** — `blocksMoveNow(w)` = `blocksMove && !isOpen`, el gemelo exacto de `blocksSightNow`, escrito en
  la rebanada 2 y esperando desde entonces («No movement rules until slice 3»).

### Rules & limits de esta rebanada
- **El servidor es quien SABE, no quien MANDA.** Corregido el 2026-08-22 tras el review: la primera redacción
  de esta spec decía «quien manda es el servidor» tomando prestada la autoridad de la visión, donde sí es
  cierta, y aquí **no se sostiene**. Lo que de verdad pasa:
  - El servidor es el único que tiene TODOS los muros —a un jugador sólo le llegan los que puede ver, y en una
    escena normal no le llega ninguno— así que es el único que puede decir dónde hay que parar. **Eso sí es
    real y es la razón de que el cálculo viva ahí.**
  - Pero el jugador escribe `x`/`y` **directamente en `maps_tokens`**; no hay endpoint de movimiento. El
    trigger `maps_tokens_guard_update` controla QUÉ token y QUÉ columnas, nunca **a dónde**.
  - O sea: la corrección del servidor es **un consejo que el navegador obedece**, no un límite. Un cliente
    honesto respeta la física; uno manipulado, no. Es un mecanismo de SECRETO y de COMODIDAD, no una barrera
    contra tramposos — y en la mesa de uno mismo, esa distinción importa poco.
- **Cerrarlo del todo** pide mover el movimiento del token a la API: `POST /scenes/:id/tokens/:id/move`
  calcado del de visión, que corre `slideCircle` con service role y hace él el UPDATE, más una migración que
  le quite a los jugadores la escritura de `x`/`y`. Cierra también el agujero del **manotazo rápido** (un
  arrastre más corto que el acelerador de ~140 ms no llega a preguntar nunca). Tiene un coste real: soltar el
  token deja de ser instantáneo y pasa a ser una ida y vuelta a la red. **Es su propia tarea, no un parche.**
- Para que el arrastre no vaya a tirones, la pantalla frena **provisionalmente** con los muros que conoce y el
  servidor corrige a ~7 Hz. Un jugador puede notar el tirón cuando el muro era secreto: es el precio.
- ⚠ **Los muros secretos se pueden descubrir a base de topar.** Si un jugador choca con algo que no ve, deduce
  que hay una pared. Es inevitable si la física funciona de verdad y pasa en todos los VTT. Aceptado por el
  dueño el 2026-08-22.

### Fuera de esta rebanada, a propósito
Distancia máxima de movimiento por turno · empujar a otro token · terreno difícil · diagonales ·
**colisión entre tokens** (que un token choque con otro token, no con un muro).

## Rebanada 7 — capas, luces de ambiente, sonda de prueba y niebla degradada

Cuatro de las siete peticiones de la escena que el dueño dejó escritas el 2026-08-20. Las otras tres
—el modal de fondo descolocado, las imágenes sueltas y los fondos animados— **no entran**: las dos últimas
dependen de las capas y se replantean cuando existan.

**El orden lo fijó el dueño (2026-08-31): las CAPAS primero.** Una luz vive en una capa y una imagen suelta
también; montarlas antes evita rehacerlas después.

### 7.1 · Capas del mapa

Hasta hoy «capas» en este spec era el ORDEN EN QUE SE PINTA (fondo → muros → dibujos → tokens → niebla),
que no se toca: es el motor. Lo nuevo son **capas de contenido que el director maneja**.

- **Cuatro tipos**, elegidos por el dueño: **Terreno** · **Objetos** · **Criaturas y personajes** ·
  **Notas del director**.
- **Se dibuja y se coloca en la capa ACTIVA.** Con el **botón derecho sobre cualquier cosa**, un desplegable
  la manda a otra capa (petición literal del dueño).
- Cada capa se puede **ver/ocultar** y **bloquear** (bloqueada = se ve pero no se selecciona ni se mueve;
  es lo que evita arrastrar el terreno sin querer al mover una ficha).
- 🔑 **El ojo es el de Photoshop, no un interruptor de privacidad** (aclaración del dueño, 2026-08-31:
  *«las capas son para cada escena, es un recurso para lograr cosas gráficas. como en photoshop o cualquier
  otra herramienta de edicion, incluso tengo que poder enviar elementos a distintas capas»*). Una capa
  apagada **no se pinta para nadie**, tampoco para el director: es composición, no permisos. El **candado**
  en cambio sólo le afecta a él, que es el único que selecciona cosas.
- **Notas del director es SIEMPRE privada.** No es una capa que se pueda enseñar: al jugador esa capa no le
  existe, ni sus objetos viajan a su navegador. Es la única con esa regla, y por eso es un tipo aparte y no
  un interruptor de visibilidad — un interruptor se pulsa por error.
- **Criaturas y personajes conserva lo que ya hay**: se pinta por encima del resto y sigue mandando la
  visibilidad por token (`visible`), que es de reglas y no de capas.

#### El terreno lleva VARIAS capas, y un pincel de transparencia (dueño, 2026-08-31)
Idea suya, y es la pieza con más jugo de la rebanada: *«que pueda poner dos fotos de fondo y con un pincel
jugar con pintar transparencias o cosas para lograr efectos chulos»*.

- **Sin límite de capas de terreno.** Se añaden, se quitan y se reordenan desde una lista.
- **Pincel con FUERZA regulable**, no un borrador: a fuerza máxima borra del todo la capa de arriba y asoma
  la de abajo; a media la deja translúcida, para mezclas suaves entre las dos fotos.
- Es una **máscara por capa**, no un recorte de la imagen: la foto original nunca se toca, así que siempre se
  puede volver atrás subiendo la fuerza del pincel en sentido contrario.
- ⚠ **Aviso, no bloqueo**: el dueño eligió «sin límite» a sabiendas. Muchas capas con máscara pesan; la app
  avisa cuando la escena se vuelva pesada en vez de impedirlo.

### 7.2 · Luces — de ambiente AHORA, que iluminen DESPUÉS

**Decisión del dueño (2026-08-31)**: se construye el aspecto y la colocación, y **el dato se guarda ya
preparado** para el día que iluminen de verdad. Ese día llegó el mismo 31 de agosto: ver «CÓMO QUEDÓ
CONSTRUIDO» al final de este apartado.

- **Forma**: cono · radio · cuadrado. **Tipo**: antorcha · bombilla · fuego (y lo que aporte el diseño:
  farol, linterna, luz de luna, resplandor mágico).
- Cada tipo trae su **color**, su **alcance** y su **parpadeo** — una antorcha tiembla, una bombilla no.
- 🔥 **El parpadeo SE ANIMA de verdad** (petición del dueño al aprobar el diseño, 2026-08-31: *«quiero que en
  algún momento tengan cierta animación, como si fuera por ejemplo de una hoguera o una antorcha, o una luz
  que parpadea»*). **Entra en esta rebanada**: animar es PINTAR, y pintar es exactamente lo único que las
  luces hacen hoy — no revela niebla, no cambia lo que ve nadie y no toca el cálculo de visión, así que no
  cruza ninguna de las rayas de arriba.
  - **El ritmo lo manda el TIPO, no un control nuevo**: la antorcha tiembla rápido y poco, la hoguera respira
    lento y amplio, la bombilla parpadea a golpes secos. El director sólo enciende o apaga el interruptor
    «Parpadea»; no se le pide que ajuste velocidades.
  - **No hace falta guardar nada más**: `kind` y `flicker` ya están en la tabla desde el primer día, así que
    el ritmo se deriva y no hay que repasar ninguna luz ya colocada. Si algún día se quiere regular la fuerza
    del parpadeo, es una columna suelta y aditiva.
  - Con el movimiento reducido del sistema operativo (`prefers-reduced-motion`), la luz se queda quieta en su
    valor medio: nadie se marea por una decisión decorativa.
- **Una luz es un objeto de la escena**: vive en una capa, se mueve, se gira y se borra como lo demás.
- 🚫 **Lo que NO hacía en la primera versión** (construida el 2026-08-31): no revelaba niebla, no cambiaba lo
  que ve nadie y no entraba en el cálculo de visión. Era pintura, y **atravesaba las paredes**.

#### 🔦 LAS LUCES ILUMINAN DE VERDAD — decisión del dueño, 2026-08-31 (noche)
Al probar la primera versión preguntó: *«las luces no iluminan del otro lado de los muros, ¿correcto?»*. Hoy
sí lo hacen, y **eso está mal**. Se corrige, y de paso entran en la visión con reglas propias.

**1. La luz se corta contra los muros.** El mismo recorte que la visión —el polígono desde un punto contra los
segmentos que cortan la vista— pero desde la LUZ en vez de desde los ojos. `casts_shadow`, que ya se guardaba
sin que nadie lo leyera, es lo que enciende esto por luz.

**2. Se calcula en el SERVIDOR, para todos.** No en el navegador: a un jugador **no le llegan los muros
secretos**, así que una sombra calculada en su pantalla los delataría por dónde corta. Es la misma razón por
la que la visión vive allí, y reaprovecha el mismo motor.

**3. LA LUZ NO ALARGA TU LÍNEA DE VISIÓN** (regla del dueño, literal): *«si un personaje entra en un pasillo y
mira al fondo donde su línea no llega pero hay una luz, sólo ve lo que está iluminado — o la sombra que
provoque al final del pasillo. Lo que hay en medio no se ve, o porque la luz no llega o porque su rango no
llega»*. En una frase:

> **Ves un punto si tienes línea de vista hasta él Y (te queda dentro de tu alcance O lo alcanza una luz).**

Lo de en medio del pasillo —fuera de tu alcance y sin luz encima— **sigue negro**, aunque veas iluminado el
fondo. No es un degradado ni un «se ve un poco»: o llega luz a ese punto, o no llega.

**4. Lo alumbrado se recuerda como todo lo demás.** Cuando el personaje deja de mirar, esa zona pasa a
explorada-y-apagada, igual que cualquier sitio donde estuviste y ya no estás. No hay regla nueva: es lo
explorado de siempre.

**5. Lo que sigue sin hacer**: nada de esto da ni quita dados. Estar iluminado o a oscuras no cambia una
tirada — eso sería una regla del manual y tendría que salir del libro, no de aquí.
- ✅ **Lo que había que dejar listo para después**: alcance en metros (no en píxeles) y si la luz **proyecta
  sombra** contra los muros. Los dos se guardaron desde el primer día aunque no se usaran — añadirlos luego
  habría obligado a repasar todas las luces ya colocadas de todas las escenas. Salió bien: al llegar el día,
  ninguna luz hubo que repasarla.

#### ✅ CÓMO QUEDÓ CONSTRUIDO (2026-08-31, cierre)

**El motor no era nuevo.** `visionPolygon` ya recortaba un polígono desde un punto contra los muros; hacía
falta lo mismo desde la LUZ, más su forma (cono, radio, cuadrado). Eso es `lightPolygon`.

**El corte contra la vista se hace en el servidor, y sin traer ninguna librería.** El polígono de visión es
una ESTRELLA alrededor del ojo —sus vértices salen ordenados por ángulo—, así que los triángulos
(ojo, vértice, siguiente) lo embaldosan enteros; y contra un triángulo, que es convexo, el recorte clásico de
Sutherland–Hodgman es exacto. De ahí salen los trozos que viajan. Un charco puede llegar **partido en varios**
a propósito: la sombra de una columna lo corta en dos, y cerrarlo sería mentir.

**Lo que viaja es sólo el resultado.** A un jugador nunca le llega el polígono entero de una luz: le llega ya
cortado por SU línea de vista. Si le llegase entero, la forma de la sombra le dibujaría un muro secreto sin
necesidad de verlo. Al director, que conoce todos los muros, le llega completo.

**Dos decisiones que hubo que tomar para que esto funcionara:**

1. 🔦 **`casts_shadow` pasa a venir ENCENDIDA**, y se encendieron las luces ya colocadas
   (`20260831190000_maps_lights_cast_shadow_on.sql`). Nació apagada porque nadie la leía; dejarla así habría
   dejado el arreglo sin efecto, y el dueño dio por hecho que una antorcha NO ilumina al otro lado de la
   pared. Lo raro —un resplandor mágico que atraviesa la piedra— es lo que merece un interruptor, y el
   interruptor sigue estando ahí para eso.
2. 🌫 **Con la niebla en «manual» y en «off» la luz se recorta igual contra los muros, pero no revela nada
   por su cuenta.** En «manual» manda el pincel del director y en «off» ya se ve todo; añadir un revelado por
   luz cambiaría lo que esos dos modos significan. La luz sigue llegando en ambos porque **recortarla contra
   la pared es geometría, no niebla**: el director puede apagar la niebla sin querer de paso que la antorcha
   ilumine la habitación de al lado. En «off» va entera —ahí el director quitó el secreto a propósito—; en
   «manual» va cortada por la vista, como en «visión».

**Lo que sigue sin estar** (y no es olvido): el resplandor se recorta con el borde de lo que alumbra, pero **no
proyecta la sombra de una ficha ni de un objeto** — sólo los muros cortan. Y sigue sin dar ni quitar dados.

#### 🚨 LA LUZ QUE GIRA («como una sirena») — pedida el 2026-08-31, construida el 2026-09-01

Una luz de cono puede **girar sola**, dando vueltas como el faro de un coche de policía. El director la
enciende y le pone el periodo (lo que tarda una vuelta entera); a partir de ahí gira sin que nadie la toque y
**todos en la mesa la ven en la misma posición**, porque la fase sale del reloj y no de cuándo entró cada uno.

- **Sólo un cono gira.** Un radio ya alumbra en redondo y un cuadrado girando no significa nada, así que el
  interruptor sólo sale con la forma «cono».
- **El haz barre, y lo que barrió queda explorado.** Una vuelta entera acaba explorando el círculo entero, y
  eso es correcto: lo que la sonda enseña después es el mapa recordado, con el haz brillante encima.
- **Sigue sin alargar la línea de visión** (§ 7.2, regla del dueño): girar no cambia esa regla ni ninguna otra
  del manual.
- **Sigue sin atravesar muros**: el charco se recorta contra la geometría igual que el de una luz quieta.

> 🔑 **Cómo se hace SIN que cueste caro, y esto es una decisión, no un detalle.**
> El plan original era calcular **N rotaciones del cono** en el servidor (24–36) y mandarlas todas. No hace
> falta: el recorte contra los muros es **radial** —cada rayo se corta en la primera pared— así que
> «cono girado a θ, recortado» es exactamente «círculo entero recortado **∩** el sector de θ». Es decir:
>
> - **el servidor manda el CÍRCULO ENTERO recortado, una sola vez** (el mismo coste que una luz quieta), y
> - **el navegador rota encima una ventana con forma de cono**, con la fase sacada del reloj.
>
> Sale más barato que hoy en vez de 24 veces más caro, el barrido es continuo en vez de a saltos, y la
> respuesta no engorda. Importa: el dueño ya se quejó de que «está todo lentísimo».
>
> ⚠ **Lo que esto cambia respecto de lo que él eligió**: pidió que «la niebla siga al haz», y aquí lo que
> sigue al haz es el BRILLO — lo explorado se revela en el círculo desde el primer momento en vez de ir
> apareciendo por sectores. A los pocos segundos el resultado es idéntico (lo explorado no se borra nunca),
> pero **queda dicho en voz alta**: si quiere que la niebla vaya sector a sector, eso sí obliga a las N
> rotaciones en el servidor y a pagar su coste.

**Modelo de datos**: **una sola columna** en `maps_lights`, `spin_ms` (entero, 0 = no gira). Un interruptor y
un periodo en dos columnas serían dos formas de decir lo mismo y una de ellas acabaría mintiendo.

##### 🐞 Y NO GIRABA — arreglado el 2026-09-01 (noche)

Al probarlo dijo: *«no gira, tiene que estar girando todo el tiempo y solo gira un poco mientras muevo el
token y luego para»*. Tenía razón, y el fallo era fino:

La orden de girar estaba **bien puesta** —periodo correcto, vuelta entera, «para siempre»—, pero vivía
**dentro de la máscara** que recorta la luz. Y un navegador **no vuelve a pintar un elemento porque algo se
haya movido dentro de su máscara**: la animación corría, pero nadie repintaba. El haz sólo avanzaba de
refilón cuando otra cosa obligaba al mapa a repintarse —arrastrar una ficha, justo lo que él hacía— y se
congelaba al soltar.

**El arreglo, sin perder el borde suave.** El haz se pinta ahora como un objeto de verdad, en el árbol que se
ve, y es el CHARCO el que hace de máscara — al revés que antes. La cuenta es la misma («círculo recortado ∩
sector de θ» da igual por qué lado se mire), pero lo que se mueve es algo visible y el navegador sí lo
repinta. El borde del haz sigue sin ser una raya: lleva el mismo desenfoque que las demás luces, y ahí
difumina de verdad porque difumina **lo pintado**, no una silueta multiplicada por sí misma.

Dos cosas más que salieron de ahí:
- **La fase se calcula una sola vez por luz.** Cambiar el «empezó hace tanto» en una animación que corre la
  REINICIA, y este lienzo se repinta con cada actualización de visión: el haz habría dado un salto atrás
  varias veces por segundo. Se guarda, y se recalcula sólo si él cambia la velocidad.
- **El charco de una sirena es REDONDO aunque la luz sea un cono**, también cuando se dibuja sin datos del
  servidor (niebla apagada). Es lo que ya hacía el servidor; el navegador no lo hacía, y el haz giraba dentro
  de una rendija con la forma del cono quieto.

⚠ **Sigue pendiente de que lo vea él**: los tests comprueban dónde cuelga la animación, que es lo que estaba
mal. Que el navegador repinte de verdad no lo puede comprobar un test.

##### ⚡ Y AL GIRAR DE VERDAD, SE FUE LA FLUIDEZ — el filo del haz, en capas (2026-09-02)

Arreglado el giro, llegó la queja siguiente: *«la niebla hace saltos raros, no es fluida, igual que el
movimiento del token»*. Causa: estas luces pasaron de **no repintarse nunca** —ése era el fallo— a repintarse
60 veces por segundo, y el filo del haz lo ponía un **desenfoque gaussiano**, que hay que REHACER en cada
fotograma sobre una caja del tamaño de la luz. Su escena tiene **dos conos girando, uno a media vuelta por
segundo**: eso se come el presupuesto del fotograma, y cuando eso pasa se va a saltos **todo** lo que se
pinta — la niebla y las fichas incluidas. Por eso las dos quejas eran una sola cosa.

Quitar el desenfoque devolvió la fluidez y trajo la queja de al lado: *«se ven los conos duros»*. Así que el
filo **se dibuja en vez de emborronarse**: unos pocos conos encajados, del más ancho al más estrecho, cada uno
un poco más opaco. Son rellenos planos —lo más barato que hace un navegador— y la rampa es exacta: dándole a
la capa `i` una opacidad de `1/(N-i)`, lo acumulado sale justo `(i+1)/N`, con el centro opaco del todo.

> 🔒 **Regla que no se puede perder**: nada que GIRE puede llevar un filtro colgando. El difuminado va en algo
> quieto —la máscara del charco, que se calcula una vez— o se dibuja. Hay un test que cae si alguien vuelve a
> colgar un filtro del haz.

#### 🔦 ELEGIR UNA LUZ Y MOVERLA — pedido y construido el 2026-09-01 (noche)

Queja suya, literal: *«no lo puedo arrastrar, me debería mostrar algo que la seleccione a cuál seleccione y
que me deje moverla»*. Eran **tres** cosas, no una:

1. **El aro no se veía.** Elegir una luz con **Seleccionar** funcionaba desde el 2026-08-31, pero el aro que
   dice «ésta» y su disco de clic **sólo se pintaban con la herramienta Luz**. Con Seleccionar la elegías a
   ciegas: se abría su editor y nada en el mapa decía cuál. Ahora el aro sale con las **dos** herramientas
   desde las que se puede elegir una — y con ninguna más, que un aro de algo que no puedes tocar estorba.
2. **El blanco se encogía al alejarse.** La zona a la que hay que acertar se medía en píxeles de ESCENA, así
   que con el mapa alejado quedaba minúscula en pantalla y era imposible acertarle. Ahora el aro y su disco
   mantienen su tamaño **en pantalla**, pase lo que pase con el zoom.
3. **Arrastrar una luz no existía.** Se podían arrastrar fichas y muros; una luz, no. Ahora se agarra y se
   mueve, con el mismo gesto que un muro: **elegirla y moverla son el mismo gesto, no dos**.

- **Libre, sin pegarse a la rejilla**: una luz no ocupa casilla. Se pinta al momento mientras se arrastra
  —resplandor, aro y disco van juntos— y **se guarda al soltar**, no en cada movimiento.
- **Un clic sin arrastre NO guarda nada.** Elegir una luz para abrir su editor es lo más normal del mundo y no
  puede escribir en la base de datos cada vez.
- **Es cosa del director**, como todo lo de este apartado.

#### 🕯 INTENSIDAD POR LUZ — pedida y construida el 2026-09-01 (noche)

Petición suya: *«cada una además del alcance color etc necesita una barra de intensidad»*. Una barra más en
el editor de luz, junto al color.

Separa dos cosas que hasta hoy iban juntas:

| | Qué es | Ya existía |
|---|---|---|
| **Alcance** (`range_m`) | cuánto **ILUMINA** — sí cambia lo que se ve | sí |
| **Intensidad** (`intensity`) | cuánto **CANTA** — sólo cómo se pinta | **nueva** |

Antes, la única forma de que una luz cantase menos era hacerla más pequeña, y no es lo mismo: una vela tenue
sigue alumbrando su rincón entero.

- 🔒 **NO cambia lo que nadie ve.** Decisión suya del 2026-09-01, elegida sobre la alternativa: **una luz al
  10 % revela exactamente el mismo terreno que al 100 %**. Respeta la regla que él mismo fijó en § 7.2 —«o
  llega luz a ese punto, o no llega; no es un degradado»— y por eso **la api ni la pide ni la necesita**: el
  cálculo de visión y de sombras no la mira. Vive sólo en lo que se pinta.
- 🔒 **Ninguna luz ya colocada cambia de aspecto.** Nace a **100 %**, que es exactamente como se pintaban antes
  de que la columna existiera. Misma jugada que salió bien con `range_m` y `casts_shadow`.
- **De 10 % a 200 %**, con **100 % = como se pintaba siempre**. El suelo no es 0 a propósito: una luz invisible
  es una luz que crees haber borrado y no lo está — para eso está la papelera. El techo se subió a 200 el
  2026-09-02, al probarlo: *«la escala de luminosidad queda corta, el máximo tendría que ser más brillante»*.
  El 100 NO se movió — moverlo cambiaría de aspecto todas sus luces ya puestas; lo que se abrió es el margen
  por arriba.
  - Por encima de 100 el centro llega a opaco enseguida (más opaco que opaco no existe), así que lo que sigue
    creciendo es **el ancho del núcleo brillante**, que es lo que de verdad se lee como «más luz».
- **Se lleva bien con el parpadeo**: la intensidad va en el degradado, no en la opacidad del elemento, que es
  justo lo que anima el parpadeo. Una antorcha al 30 % sigue temblando, sólo que suave.
- **Es de cada luz**, no de la capa ni de la escena.
- **En todas las luces**: cono, radio y cuadrado, y en todos los tipos.

#### 🎨 DOCE COLORES, NO SEIS — 2026-09-02

*«Debería poder elegir más colores, no solo esos.»* La paleta pasa de 6 a 12, en tres familias de cuatro:
**cálidos** (fuego, vela, brasa, farol) · **fríos** (luna, hielo, agua profunda, niebla verdosa) ·
**antinaturales** (magia, veneno, sangre, fuego fatuo), para lo que no debería estar ahí.

> 🔒 **Los seis originales siguen en la paleta, todos.** Si uno desapareciera, una luz ya guardada con ese
> color se quedaría con un color que el director ya no podría volver a elegir. Hay un test que lo sujeta.

Se ven en **dos filas de seis**: en una sola no caben en el panel.

**Modelo de datos**: una columna en `maps_lights`, `intensity` (entero 10–200, por defecto 100), con su
`CHECK`. Aditiva; no toca RLS —el reparto de `maps_lights` ya es el que hace falta— y no la lee la api.

> 🚨 **Al desplegar**: como `spin_ms`, esta columna **la pide la web en su `select`**. La migración va PRIMERO
> y el código después. Las dos migraciones nuevas —`spin_ms` e `intensity`— tienen que estar aplicadas en
> producción antes de que suba nada de código.

### 7.3 · La sonda de prueba — «¿qué vería un jugador desde aquí?»

> 🔄 **Reescrito el 2026-09-01. Sustituye ENTERO al «ver con los ojos de ‹personaje›»**, que llegó a
> producción, dejó el mapa en negro y el dueño mandó **borrar, no arreglar**. Sus palabras: «esto no tiene que
> mirar como un personaje en concreto, necesito un token test y poder moverlo y ya uno generico, un icono y ya
> no un desplegable».

⚠ **La mitad ya existe y se queda tal cual**: el interruptor genérico «ver como jugador» (`playerView` en
`CanvasControls`) le quita al director sus privilegios — los muros dorados, el velo azul y las fichas ocultas.
No se toca.

**Lo nuevo**: un botón con icono en la barra del director suelta en el mapa una **sonda** —una ficha genérica,
sin nombre y sin dueño— que el director **arrastra**; mientras la mueve, la pantalla enseña **lo que vería un
jugador desde ese punto**. No hay desplegable y no hay que elegir personaje.

#### Qué es y qué no es
- **No es una ficha.** No se guarda en `maps_tokens`, no la ve ningún jugador, no sale en ninguna lista ni en
  ningún encuentro y no cuenta para ninguna regla. Es mobiliario de la pantalla del director.
- **Se va sola**: al apagar la sonda, al cambiar de escena o al recargar la página. No sobrevive a nada.
- **Es una lente, no un modo**: no mueve la escena activa, no toca la niebla guardada de nadie y no avisa a
  ningún jugador. El cartel de la pantalla lo dice mientras dure.

#### Qué se ve mientras la sonda está puesta
- La pantalla se comporta como la de un jugador: el mapa enmascarado contra **explorado ∪ visión**, con los
  privilegios del director apagados — los mismos que apaga «ver como jugador».
- **Alcance de vista: el de la escena**, como cualquier ficha — de día sin límite, de noche `night_radius_m`.
  No se inventa un número nuevo ni se le pide uno al director.
- Las luces se recortan contra la línea de vista de la sonda, igual que para un jugador (§ 7.2).

#### La memoria la lleva el navegador, y NADA se guarda
> Decisión del dueño, cerrada el 2026-09-01: «que quede en memoria, si es sólo para probar». No volver a
> preguntarla.

- Lo que la sonda ha ido viendo se acumula **en el navegador del director** mientras la sonda esté puesta, y se
  **tira al quitarla**. **No se escribe una sola fila en la base.**
- Por eso el cartel «no cambia nada para nadie» sigue siendo verdad — y por eso **el mapa en negro no puede
  volver**. El fallo que llegó a producción era pedir la memoria del DUEÑO de la ficha
  (`getExplored(escena, controlledBy)`): un director no acumula memoria nunca, así que llegaba vacía y el mapa
  salía todo negro. Una sonda **no tiene dueño**, así que no hay a quién pedirle una memoria que no existe.

#### Cómo se pide la visión
- La petición de visión **deja de necesitar una ficha** (`asTokenId`) y pasa a aceptar **un punto** `{x, y}` en
  píxeles de escena. El servidor contesta la visión desde ese punto y **no guarda nada**.
- **Se sigue calculando en el servidor**, por la razón de siempre: al navegador del director le llegan muros
  que un jugador no conoce, así que si la línea de vista se recalculase allí, lo que ve él y lo que ve el
  jugador podrían discrepar — y comprobar exactamente eso es para lo que sirve la sonda.

#### 🎭 LA PONE ÉL, DONDE PINCHE — corregido el 2026-09-02

Nació soltándose sola en mitad de lo que el director estuviera mirando. Al probarlo: *«déjame poner el token
donde quiera, no lo pongas automáticamente en el centro, si no la prueba es una mierda»*. Tenía razón —el
sitio que importa para probar casi nunca es el centro de la pantalla, y desde ahí tocaba arrastrarla, que con
el mapa alejado es un viaje.

- **Encender «ver como jugador» ya NO la coloca.** Enciende el modo y la pantalla pide: *«pincha en el mapa
  donde quieras probar»*.
- **El primer clic la pone. Cualquier clic posterior en el suelo la muda.** Arrastrarla sigue igual: pinchar
  SOBRE ella la agarra, en vez de mudarla a donde ya está.
- **Al encender el modo, la herramienta pasa a Seleccionar.** Si se entrase con el Lápiz en la mano, el clic
  que tiene que poner la sonda se lo llevaría el lápiz y parecería que el modo no hace nada.

#### Dónde vive: NO es un botón nuevo — cuelga de «Ver como jugador»
> 🔄 Corregido el 2026-09-01 por el dueño, viendo la app en local: «el botón de ver como jugador… me debería
> dejar poner un token donde quiera para probar». Antes se había planeado un botón «Sonda» propio en el bloque
> de director de la barra; **se descarta**. Un botón menos, y la historia queda entera en un solo sitio.

- **«Ver como jugador» (`playerView`, en los controles del lienzo) ES la sonda.** Al encenderlo: se le quitan
  al director sus privilegios —lo que ya hacía— **y además** aparece la sonda en el mapa, que él arrastra.
  Al apagarlo, la sonda desaparece y con ella su memoria.
- **Su icono cambia**: hoy es `layers` y no dice nada («no se entiende el icono, busquemos otro»). El icono
  nuevo se elige en `rolvium.pen` y lo aprueba el dueño antes de tocar código.
- La sonda se arrastra con **«Seleccionar»**, como todo lo demás del mapa: no hace falta ninguna herramienta
  nueva y el cursor no cambia.
- **La barra de herramientas no crece.** El orden del bloque de director que el dueño fijó el 31-ago se queda
  como está, y su test (`controls.test.tsx`) sigue valiendo tal cual.

#### Fuera de alcance (a propósito)
- Varias sondas a la vez, y recordar dónde la dejaste la última vez.
- **Ver la memoria REAL de un jugador concreto** — es justo lo que se acaba de borrar. Si algún día hace falta,
  vuelve como rebanada propia y con la lección aprendida escrita arriba.

### 7.4 · La niebla se degrada, y en la penumbra se ve a medias

Hoy la visión termina en un borde duro y se nota mucho. **Decisión del dueño (2026-08-31): la franja
difuminada CAMBIA lo que se ve**, no es sólo aspecto — y dentro se ve **todo difuminado, fichas incluidas**.

- Tres zonas, no dos: **clara** (lo de siempre) · **penumbra** (la franja nueva) · **negro**.
- En la penumbra el terreno y los muros se ven difuminados, y una criatura o un personaje aparece como un
  **bulto sin identidad**: sin nombre, sin retrato y sin poder abrir su ficha. Se sabe que **hay alguien**,
  no quién.
- 🔒 **Cómo se hace sin filtrar nada** (y esto es una decisión, no un detalle): hoy una ficha que no ves
  **no existe** en tu navegador. Para pintar un bulto hay que mandarte algo, así que el servidor manda
  **sólo posición y tamaño**, nunca el nombre, el retrato, el identificador ni la ficha. Un jugador curioso
  que mire lo que le llega verá exactamente lo mismo que ve en pantalla: un bulto. Hacerlo de otro modo
  —mandar la ficha entera y difuminarla al pintar— convertiría el efecto en un agujero.
- El ancho de la penumbra sale de lo que ya existe (`vision_radius` del token y la luz de la escena); no se
  inventa un número nuevo.

> 🛑 **BLOQUEADA — la premisa de arriba NO SE SOSTIENE HOY** (encontrado al construir, 2026-08-31).
>
> La decisión 🔒 dice «hoy una ficha que no ves no existe en tu navegador». **Eso sólo es cierto de las fichas
> que el director marca OCULTAS.** Una ficha normal que simplemente está fuera de tu línea de visión **sí
> llega entera** al navegador de todos los jugadores —nombre, retrato, identificador y estado— porque la RLS
> de `maps_tokens` no sabe de líneas de visión: sólo mira `visible` y que puedas ver la escena. Lo que la
> esconde es la niebla AL PINTAR, no el envío.
>
> Es decir: **el agujero que la penumbra quería evitar ya está abierto un paso antes.** Añadir un «bulto» con
> sólo posición y tamaño mientras la fila entera sigue viajando no protegería nada; sería teatro.
>
> **Taparlo de verdad es otra rebanada, y es decisión del dueño**: hay que dejar de servir `maps_tokens` a los
> jugadores por RLS y pasarlas por la API recortadas por visión, lo que además obliga a rehacer cómo llegan
> los cambios en vivo (hoy los jugadores se suscriben a la tabla). Mientras tanto, la parte VISUAL de la
> penumbra —las tres zonas y el bulto sin cara— se puede construir, pero hay que decir en voz alta que es un
> efecto, no una protección.

### Reglas y límites de esta rebanada
- **Todo lo de aquí es del DIRECTOR**, salvo lo que se ve: un jugador no crea capas, ni luces, ni cambia de
  vista. Lo único que le llega es el resultado.
- **Nada de esto cambia una regla del manual.** Las luces no iluminan todavía y la penumbra no da ni quita
  dados: quien está en penumbra no dispara mejor ni peor. El día que las luces iluminen, eso sí será una
  decisión de reglas y volverá a pasar por aquí.
- **La capa de notas del director no viaja al navegador de un jugador.** No es que se pinte oculta: no se
  envía.
- El pincel de transparencia **no destruye la imagen**: la máscara es un dato aparte y siempre reversible.

### Fuera de alcance (de esta rebanada)
- **Que las luces iluminen de verdad** — decisión explícita del dueño para más adelante.
- **Imágenes sueltas movibles** y **fondos animados** (GIF/vídeo por enlace): esperan a que existan las
  capas, porque lo primero que hay que decidir es en qué capa caen.
- **El modal de «subir imagen de fondo» descolocado**: es un fallo de colocación y va suelto, no aquí.
- **Deshacer/rehacer**, **rejilla más fina** y **muros a mano alzada**: peticiones de mapas del 2026-08-19,
  no de las siete de la escena.


## Rebanada 6 — galería de piezas

**Para qué**: construir un mapa dentro de la app —poner mobiliario, vegetación, suelos— sin salir a buscar
imágenes ni montar el plano en otro programa. Es lo que la rebanada 7 dejó apuntado como imposible hasta que
existieran las capas: «imágenes sueltas movibles esperan a que existan las capas, porque lo primero que hay que
decidir es en qué capa caen».

**Quién**: **sólo el director**. Al jugador le llega el resultado pintado, como todo lo demás de la escena.

### 6.1 · Tu biblioteca de piezas

- El director **sube sus propias imágenes** (una mesa, un roble, una alfombra). **Viven en la CAMPAÑA, no en la
  escena**: se suben una vez y se usan en todos sus mapas. Es la misma decisión que ya gobierna la biblioteca
  de fondos, y por el mismo motivo — una pieza que sólo valiera en una escena no es una biblioteca.
- Cada pieza cae en una **categoría que trae la app** —mobiliario · vegetación · suelos y alfombras · puertas y
  aberturas · trampas y marcas · varios— y hay **buscador por nombre**.
  - Categorías cerradas y no etiquetas libres, por elección del dueño (2026-08-31): las etiquetas obligan a
    etiquetar bien o no se encuentra nada, y el que sube es el mismo que busca.
- **La subida va por el camino único de `specs/core/images/SPEC.md`** (compresión a WebP en el navegador, tope
  de entrada 8 MB). ⚠ **La transparencia se conserva**: sin alfa, una mesa llegaría con un recuadro blanco
  alrededor y la galería entera no serviría de nada.
- 🔮 **El catálogo de serie queda montado por dentro.** La biblioteca distingue **piezas de la app** de **piezas
  de la campaña** desde el primer día, aunque hoy sólo existan las segundas. El día que haya dibujos, aparecen
  sin rehacer nada. **Los dibujos NO son parte de esta rebanada**: eso es arte, se compra o se encarga.

### 6.2 · Su propia ventana — la de fondos no se toca

**Petición literal del dueño (2026-08-31)**: *«crea un modal para cargar componentes pero no uses el mismo de
los fondos que dará por culo y complicará usar los fondos»*.

- La galería tiene **ventana propia**, independiente de `BackgroundPopover`. Son dos trabajos distintos —uno es
  el SUELO de la escena, el otro es el MOBILIARIO— y meterlos en la misma ventana ensuciaría la de fondos, que
  ya funciona.
- ⚠ Matiz que no contradice lo anterior: por dentro usa la **carcasa de ventana del sistema de diseño**, la
  misma que el resto de la app. Lo que no se reaprovecha es el popover de fondos, no la carcasa — si cada
  ventana se construyera desde cero, dejarían de parecerse entre ellas.

### 6.3 · Poner piezas en el mapa

- **Herramienta nueva** en la barra del director.
- **El sello se queda puesto**: se elige una pieza y **cada clic planta otra** hasta cambiar de herramienta.
  Plantar un bosque con «elegir → colocar → volver a la galería» es inviable.
- **Copiar y pegar** una pieza ya colocada, **con su giro y su tamaño**: cuando ya has ajustado una mesa y
  quieres cuatro iguales.
- 🚫 **Sin variación automática** de giro ni tamaño: el dueño eligió el sello exacto (2026-08-31). Lo que se
  planta es exactamente lo que se ve, no algo parecido.
- Se mueven, se giran y se escalan con **Seleccionar**, igual que los muros y las luces.
- **Caen en la capa de OBJETOS** (la natural de su tipo) y con el botón derecho se mandan a cualquier otra
  capa — eso ya funciona desde la rebanada 7 y no se construye otra vez.

### 6.4 · Cada pieza recuerda su escala

**Petición del dueño (2026-08-31)**: *«tengo que poder escalar el objeto y siempre se usa la última escala que
puse»*.

- Una pieza colocada **se escala** arrastrando de sus esquinas.
- **La escala se recuerda POR PIEZA de la biblioteca.** Ajustas un roble al tamaño que te gusta y **todos los
  robles que plantes salen ya a ese tamaño** — en esa escena y en las siguientes, hoy y la semana que viene.
- Se actualiza **por los dos caminos**: cambiar el tamaño al plantar, o redimensionar una ya colocada.
- **Por pieza y no una sola para todo**: una mesa y un roble no miden lo mismo, y una escala global obligaría a
  corregir en cada cambio de pieza, que es justo el trabajo que esto viene a quitar.
- ✅ **Decisión del agente, avisada**: la escala **mantiene la proporción** — se arrastra de las esquinas y la
  pieza no se deforma. Estirar sólo a lo ancho (una alfombra) queda fuera; añadirlo luego es aditivo y no
  obliga a repasar nada de lo ya colocado.

### 6.5 · Que estorben de verdad

- Cada pieza tiene un interruptor **«estorba»** con dos casillas independientes: **corta la vista** y **corta el
  paso**. Son las dos que ya distinguen los muros (`blocks_sight` / `blocks_move`), no dos conceptos nuevos.
- Lo que estorba es una **forma simple encima de la pieza** —rectángulo o círculo, ajustable—, **no la silueta
  exacta del dibujo**. La silueta real de un PNG es cara de calcular y da errores raros en los bordes.
- 🔦 **Si corta la vista, corta también la luz.** No hace falta nada nuevo: la luz se recorta contra los mismos
  segmentos que la visión (§ 7.2), así que una columna marcada «corta la vista» proyecta su sombra sola. Esto
  cierra de paso lo que § 7.2 dejó anotado como ausente («una ficha o un objeto no proyectan sombra») **para
  los objetos** — las fichas siguen sin proyectarla.
- El dato de «estorba» **se guarda desde el primer día** aunque se empiece sin usarlo: añadirlo después
  obligaría a repasar todas las piezas ya colocadas de todos los mapas.

### 6.6 · Elegir a qué capa va un fondo

**Petición del dueño (2026-08-31)**: *«cada fondo se tiene que poder asociar a una capa»*.

- ⚠ **Esto CAMBIA algo que ya funciona** (rebanada 7), y por eso está escrito aparte: hoy la foto cae en **la
  capa de terreno que esté activa**, sin decirlo. Si había otra activa, se va donde no se quería.
- Pasa a ser **explícito**: al poner un fondo se **elige en qué capa se pone**, de una lista con las capas de
  terreno de la escena más «el fondo de la escena», que es el comportamiento de siempre.
- **La asociación vive en la ESCENA, no en la biblioteca**: la misma foto puede ser el suelo de una capa en una
  mazmorra y el de otra capa en otro mapa. Una imagen de la biblioteca **no queda casada** con una capa.

### Reglas y límites de esta rebanada

- **Todo es del director.** Un jugador no sube piezas, no las coloca y no las mueve.
- **Una pieza no es una ficha**: no tiene ficha, ni iniciativa, ni se le tira nada. Si se quiere que algo actúe,
  eso es un token del bestiario y ya existe.
- **Borrar una pieza de la biblioteca NO borra las ya puestas en los mapas.** Perder el mobiliario de una
  mazmorra por limpiar la biblioteca sería un desastre silencioso, y es la misma regla que ya protege a las
  fichas cuando se borra una capa.
- **Nada de esto cambia una regla del manual.** Un mueble no da ni quita dados; estorbar es geometría.

### Fuera de alcance (de esta rebanada)

- **Los dibujos del catálogo de serie**: es arte, no código. Se compran o se encargan.
- **La silueta exacta** del PNG como obstáculo.
- **Piezas animadas**, **estirado libre** (sin mantener proporción) y **deshacer/rehacer** — este último ya
  estaba fuera desde la rebanada 7.
- **Que una FICHA proyecte sombra**: aquí sólo la proyectan los objetos marcados «corta la vista».
- **Limpieza de imágenes huérfanas** en el bucket: ya estaba fuera en `specs/core/images/SPEC.md`.

### Modelo de datos (rebanada 6)

Migración: `supabase/migrations/20260831200000_maps_props.sql`. **Dos tablas, y la separación entre ellas ES la
regla que pidió el dueño.**

- **`maps_props` — LA BIBLIOTECA.** Una pieza que existe para usarse: su **foto**, su **nombre**, su
  **categoría** (una de las seis cerradas) y el tamaño real del fichero subido. Además guarda lo que la pieza
  **recuerda**: la **última escala** con la que se usó (§ 6.4) y **con qué estorbo nace** una copia suya
  (§ 6.5). La escala es **un solo número**, no un ancho y un alto: así redimensionar no puede deformar la
  pieza, que es la decisión de mantener la proporción.
  - **`campaign_id` puede ir vacío**, y ahí está el catálogo de serie: vacío = **pieza de la app**, con valor =
    **pieza de esa campaña**. La distinción existe desde el primer día aunque hoy sólo haya piezas de campaña.
  - **Quién lee**: el director de esa campaña, y cualquiera las piezas de la app (no hay nada que esconder en
    el dibujo de una silla). **Un jugador no necesita leerla nunca**: lo plantado se lleva su propia foto.
  - **Quién escribe**: el director, y **sólo en su campaña** — nadie puede meter nada en el catálogo de la app
    desde la aplicación; eso se siembra por migración.

- **`maps_scene_props` — LO PLANTADO.** Cada copia puesta en un mapa: **dónde está**, **qué tamaño tiene**,
  **cuánto está girada**, **en qué capa vive** y **qué estorba**. Lo que estorba es una **forma simple**
  —rectángulo o círculo, con su tamaño y su desplazamiento respecto al centro—, nunca la silueta del dibujo.
  - 🔑 **Guarda su propia foto, copiada de la biblioteca al plantarla.** Es lo que hace cumplir la regla
    «borrar una pieza de la biblioteca no borra las ya puestas en los mapas»: el enlace a la biblioteca puede
    quedarse vacío y lo plantado sigue entero. La foto del bucket tampoco se borra al borrar la fila.
  - **Vive en una capa**, y si se borra la capa se va con ella — igual que los dibujos y las luces de la
    rebanada 7. (Las **fichas** son la excepción a esa regla, y por un buen motivo.)
  - **Quién lee**: el director todo; un jugador, si la escena le es visible **y** su capa le llega. Exactamente
    la misma condición que las luces.
  - **Quién escribe**: sólo el director.

**Lo que NO cambia en la base de datos:**
- **El § 6.6 («elegir a qué capa va un fondo») no necesita esquema.** La capa ya tiene su foto y su encaje
  desde la rebanada 7; lo que cambia es que la pantalla deje de dar por hecho «la capa activa» y te la haga
  elegir. Es trabajo de pantalla, no de datos.
- **`maps_walls` no se toca.** Una pieza que estorba **no es un muro**: se apunta en su propia fila, y el
  servidor la suma a la geometría al calcular la visión — que es también lo que hará que proyecte sombra.
- **No hay bucket nuevo.** Las fotos van al bucket `backgrounds` que ya existe, bajo `{campaña}/props/…`, con
  el mismo precedente que las máscaras del pincel de transparencia.

## Rebanada 8 — habitaciones rápidas (el «generador» de Builder)

> 🟡 **ESTE APARTADO ESTÁ SIN CONFIRMAR POR EL DUEÑO.** Escrito la noche del 2026-09-02 a partir de lo único
> que hay registrado de él (`WORK_STATE.md`, dos peticiones suyas) porque pidió avanzar mientras dormía.
> **Antes de tocar una sola línea de interfaz hay que: (1) que confirme este spec, y (2) que haya diseño en
> `rolvium.pen` aprobado por él.** Lo que sí está construido es el MOTOR —la geometría, sin pantalla—, que no
> depende de ninguna de las decisiones abiertas de abajo.
>
> ⚠ **Y un aviso honesto**: él dijo «el generador de habitaciones que tenemos diseñado». **No hay diseño.**
> Ni componente en el `.pen`, ni frame, ni nada en el historial; en `WORK_STATE.md` aparece tres veces y las
> tres como «sin empezar, pasa por spec → DBA → diseño antes de código». Lo que sí mandó fueron **dos
> capturas de Dungeon Scrawl como referencia**, que no es lo mismo que un diseño.

### Qué es
Dentro de **Builder** —que hoy es sólo la herramienta de muros— poder **dibujar un cuadrado o un círculo y que
la habitación se monte sola**, con sus paredes ya puestas, en vez de trazar segmento a segmento.

### Lo que él dijo, literal y sin interpretar
- Habitaciones y mazmorras rápidas **estilo Dungeon Scrawl** (mandó dos capturas).
- Elegir **tipo** de habitación/mazmorra, **dibujar cuadrados o círculos**, y que **la monte sola**.
- 🔒 **Las paredes generadas son OPACAS: no dejan pasar ni visión ni luz.**
- 🔒 **La foto de fondo hace de TEXTURA DE SUELO** de las habitaciones.
- 🔒 **NO copiar su interfaz.** Regla explícita suya: seguimos con la nuestra y le vamos añadiendo la
  funcionalidad.

### Reglas que se derivan de lo anterior
- **Una habitación no es una entidad nueva: es un atajo que produce MUROS de los de siempre.** Un muro normal
  ya es exactamente lo que él pidió —`blocksSight: true, blocksMove: true`— y las luces ya se recortan contra
  él. Así, lo generado se edita, se abre, se parte y se borra con todo lo que ya existe, y **no hace falta
  ninguna tabla ni ninguna migración**. Es la decisión que menos deuda deja.
- **Lo generado queda suelto.** Una vez puesta la habitación, sus paredes son paredes: mover una no mueve las
  demás. Es coherente con que no haya entidad «habitación», y evita prometer un agrupado que no existe.
- **Se pega a la rejilla**, como el resto de Builder.

### 🎨 LAS TEXTURAS — ampliación suya del 2026-09-02 (y lo que rompe)

Mandó una captura de Dungeon Scrawl y recordó: *«recuerda que te pedí que te bases en esta herramienta»* —
**basarse en lo que HACE, no copiar su interfaz**, que es exactamente lo que ya estaba escrito. Y añadió el
requisito que faltaba:

> *«Esto de base se tienen que poder elegir dos backgrounds, uno para la textura interna de las paredes y
> otro para el fondo de los pisos, pero si quiero luego dar una textura distinta por habitación para el piso
> o paredes necesito una herramienta para poder pintar ese piso con esa textura.»*

Son **dos cosas en capas**:
1. **Dos texturas de base, para toda la escena**: una para el **relleno de las paredes** y otra para el
   **suelo**. Es lo que en su captura son el color de pared y el color de suelo, pero con imagen.
2. **Una textura DISTINTA por habitación**, encima de las de base, **pintada con una herramienta** — no
   elegida en un desplegable: él quiere pintar el suelo de *esa* sala con *esa* textura.

> 🛑 **ESTO ROMPE UNA CONCLUSIÓN QUE YO HABÍA DADO POR BUENA, y hay que decirlo.**
>
> Escribí más arriba que «una habitación no es una entidad nueva: es un atajo que produce muros de los de
> siempre», y que por eso no hacía falta ni tabla ni migración. **Con texturas por habitación eso deja de
> sostenerse**: para darle a *una sala* un suelo distinto hay que saber **qué suelo es el de esa sala**, y hoy
> no hay nada que diga dónde acaba una habitación y empieza la de al lado — sólo hay muros sueltos.
>
> O sea que aparece una decisión de modelo de datos que antes no existía, y es suya:
> - **(a) La habitación pasa a ser una entidad** con su contorno guardado, y las texturas cuelgan de ella.
>   Es lo que menos sorpresas da luego (mover una sala entera, borrarla, cambiarle el suelo) y lo que más se
>   parece a lo que hace la herramienta de la captura. **Necesita tabla y migración → pasa por el DBA.**
> - **(b) No hay habitación: el suelo se pinta como se pinta hoy la máscara de una capa de terreno.** La
>   textura se aplica con un pincel sobre una capa, sin que nadie sepa qué es «una sala». Cuesta mucho menos
>   —la maquinaria de capas de terreno con máscara YA EXISTE (§ 7.1)— pero entonces «por habitación» es una
>   forma de hablar: la precisión la pone su pulso, no el generador.
>
> **No la decido yo.** La (b) es mucho más barata y reaprovecha lo construido; la (a) es la que de verdad
> hace lo que él describe.

### 🔴 CORRECCIONES SUYAS DEL 2026-09-02 (noche) — DOS DISEÑOS RECHAZADOS

Le enseñé dos intentos y tumbó los dos. Lo que dijo, literal, y lo que significa:

1. **«No se llama constructor de habitaciones: es el mismo Builder que pone hoy los muros, puertas y ventanas,
   que se le suma todo esto.»** → **No es una herramienta nueva.** Es **Builder**, el de siempre, con esto
   añadido. Muro · Puerta · Ventana siguen exactamente donde están, y la barra «Segmento» que ya existe
   convive con el panel. El nombre del panel es **Builder**.
2. **«Utiliza el icono que habíamos quedado.»** → `apps/web/public/icons/builder-mask.png`, su dibujo. Ya está
   en la app. No se discute ni se sustituye por un Material Symbol.
3. **«Respeta los colores de los botones.»** → **Rojo sangre = ACCIÓN, negro = SELECCIÓN.** En el primer
   intento puse «Cambiar» y «+ Subir» como texto suelto: son acciones y van en `pl-sangre`.
4. **«Falta el tema de aberturas, y tiene que ser compatible con lo ya creado.»** → Puertas y ventanas se
   siguen abriendo con el mismo disco de siempre y `planOpening` sigue partiendo los muros que pisa. El
   generador no puede traer un camino paralelo.
5. **«Rectángulos y círculos te quedas corto: ¿y si quiero poner una pared inclinada?»** → El motor de hoy
   (`roomRules.ts`) sólo sabe rectángulo y círculo. **Se queda corto.** Hacen falta al menos: pared suelta a
   cualquier ángulo, **polígono** (habitación de N lados) y trazado **a pulso**.
6. **«No me queda claro, si quiero cambiar la textura de una habitación, cómo lo hago.»** → El flujo de la
   textura por sala no se entendía. Tiene que estar dicho en pasos, en el propio panel.
7. **«No sé si te están faltando herramientas en esto.»** → Sí faltan; ver el punto 5. Queda abierto.

> 🔑 **Y LA ACLARACIÓN MÁS IMPORTANTE DE TODAS** (suya, esa misma noche):
>
> *«En el caso de estos muros tienen que comportarse como los muros que usamos para marcar sobre las fotos
> para la niebla de guerra dinámica, pero no debes eliminar lo que hicimos: convive, son cosas distintas. Uno
> es hacer mapas en la aplicación y otro es marcar sobre fotos importadas las habitaciones.»*
>
> Son **DOS MANERAS DE TRABAJAR QUE CONVIVEN**, y ninguna sustituye a la otra:
>
> | | Qué es | Qué hay hoy |
> |---|---|---|
> | **A · Marcar sobre una foto** | Traes una imagen de mapa y marcas encima dónde están los muros, para la niebla dinámica | **Construido y en uso.** Es lo que Builder hace hoy. NO SE TOCA. |
> | **B · Dibujar el mapa en la app** | No hay foto: las salas se levantan aquí, con sus texturas de pared y suelo | **Sin construir.** Es lo nuevo. |
>
> - **Los muros que genera B se comportan EXACTAMENTE como los de A** — cortan la vista y la luz, se abren en
>   puerta, se parten. Son la misma fila de `maps_walls`. Esto confirma la decisión de que una habitación no
>   necesita entidad propia para las PAREDES.
> - **Las texturas sólo tienen sentido en B.** Marcando sobre una foto, el suelo ya lo pone la foto. El panel
>   tiene que dejar claro en cuál de las dos estás, o la mitad de los controles no significa nada.
>
> ✅ **CONFIRMADO POR ÉL el 2026-09-03**, con estas palabras: *«los muros, puertas y ventanas de ahora quedan
> como están a nivel funcional; los utilizo en el caso de que diseñe un mapa con otra herramienta, lo importe
> y marque los muros, puertas y ventanas. El constructor que estamos haciendo ahora es para hacer mapas
> relativamente sencillos en Rolvium, y la niebla de batalla debe funcionar con estas construcciones
> también.»*
>
> 🔒 De ahí salen dos cosas que ya no se discuten:
> - **A no se toca a nivel funcional.** Ni una línea. Es la vía para mapas traídos de fuera.
> - **La niebla de guerra tiene que funcionar igual con lo levantado en B.** Sale gratis por la decisión de
>   que una habitación produce **muros normales** (`maps_walls`, `blocksSight`/`blocksMove`): la visión se
>   calcula en el servidor contra todos los muros, sin mirar quién los puso. **Es un requisito con nombre, y
>   por tanto lleva test propio**: una sala generada tapa la vista exactamente igual que un muro marcado a
>   mano sobre una foto.

### ✅ RESUELTO: LAS «PSEUDO TEXTURAS BASE» SON PREAJUSTES (captura recibida el 2026-09-03)

Preguntó: *«¿puedes agregar estas opciones, como las de la herramienta que te pasé, a nivel pseudo texturas
base?»* La captura llegó por fin: es el panel **«Ajustes preestablecidos de mazmorra»** de Dungeon Scrawl —
una rejilla de miniaturas, cada una enseñando **la esquina de una sala de verdad** (relleno de la pared +
suelo + rejilla), con nombre debajo: *Classic Hatching · Old School Module · Ancient Map · Gray Hatching ·
Interior Wall Fill · Rough Cavern · Classic Gray · Simple Walls · Black and White · Fog of War*.

**Qué significa, traducido a nuestro modelo:** un preajuste **no es una textura**, es **la pareja de texturas
base de golpe** — rellena a la vez el relleno de pared y el suelo de toda la escena, y de paso cómo se ve la
rejilla. Es exactamente la capa que faltaba encima de lo ya escrito:

| Nivel | Qué elige | Alcance |
|---|---|---|
| **1 · Preajuste** | Las dos de golpe, con un clic | Toda la escena |
| **2 · Las dos texturas base** | Pared y suelo por separado, o una foto suya (`+ Subir`) | Toda la escena |
| **3 · Una sala distinta** | Se pinta encima con el pincel, en dos pasos | Una habitación |

**Decisiones que se toman aquí** (y que el diseño v3 ya refleja):
- Los preajustes son **nuestros y en castellano**, no una copia de sus nombres — regla suya de no copiar su
  interfaz: *Rayado clásico · Módulo antiguo · Mapa antiguo · Rayado gris · Muro relleno · Caverna · Gris
  clásico · Muros simples · Tinta*. Nueve, en rejilla de 3×3, como en su captura.
- La miniatura **enseña una esquina de sala montada**, no un cuadrado de color: es lo que hace legible la
  diferencia entre «rayado» y «relleno» de un vistazo.
- Un preajuste **rellena** los dos huecos de nivel 2; en cuanto él cambie uno a mano, manda el suyo. El
  preajuste no bloquea nada.
- «Fog of War» de su captura **no se copia**: la niebla ya es nuestra (§ Rebanada 2 y § 7.4) y no es un
  estilo de dibujo.
- 🖌 **AL MENOS UN ESTILO TIENE QUE SER DE TRAZO A MANO ALZADA.** Corrección suya del 2026-09-03 viendo el
  primer intento de la rejilla: *«todos los trazos de todos los estilos son realmente rectos, ninguno parece
  a mano alzada; no digo que todos tengan que ser así pero al menos uno sí»*. Y mandó el lienzo de Dungeon
  Scrawl a tamaño grande: el «Classic Hatching» **no es un rayado de tiralíneas**, son **trazos cortos,
  gruesos y desiguales** apelotonados contra el muro, con el borde de fuera irregular. Eso es lo que hay que
  reproducir, no líneas paralelas perfectas.
  - `Rayado clásico` y `Rayado gris` pasan a trazo corto irregular (ángulo y largo con variación).
  - Entra `Trazo a mano`, con el **contorno del muro tembloroso**, y sale `Gris clásico`, que era el menos
    distinguible de la lista. Si él lo quiere de vuelta, la rejilla crece a diez.

### 🟠 LO QUE HACE FALTA QUE ÉL DECIDA (y por qué no lo decido yo)
1. **¿Puertas automáticas?** Una habitación cerrada sin puertas no se puede usar. ¿Se abre un hueco donde él
   pinche después, o el generador pone una puerta por pared, o ninguna y ya las abre a mano con el disco que
   ya existe? *Sospecha: ninguna automática — abrir una puerta ya es un gesto suyo de un clic.*
2. **¿Qué pasa cuando dos habitaciones se tocan?** ¿Se funden las paredes comunes, se quedan las dos, o la
   nueva parte a la vieja? *Esto cambia el motor, no sólo la pantalla.*
3. **La textura de suelo.** «La foto de fondo hace de textura de suelo» puede querer decir dos cosas muy
   distintas: (a) el suelo de la habitación **enseña** el fondo y **fuera** se tapa, o (b) se recorta una copia
   del fondo dentro de la habitación como una capa de terreno. La (a) es casi gratis con lo que ya hay; la (b)
   es una capa nueva por habitación.
4. **Qué «tipos» hay.** Él dijo «elegir tipo de habitación/mazmorra». Hoy el motor sabe hacer **rectángulo** y
   **círculo**. ¿Hacen falta más (pasillo, cruz, sala con columnas), o con esos dos empieza?
5. **¿Los muros generados nacen visibles para el jugador?** Los muros tienen ese interruptor y aquí importa.
6. **✅ RESUELTA (2026-09-03) — LA SALA LLEVA SU SUELO.** Sus palabras: «*sí, lleva su suelo pero con un
   matiz: tiene de base el suelo que seleccionas cuando comienzas a dibujar, luego puedo poner con un pincel
   otra textura a ese suelo, o pongo otra capa y juego ahí con transparencias, lo que me haga falta*».
   - **Una sala ES una entidad**, con su contorno y su suelo. Se acabó la opción (b).
   - **El suelo base no se elige después: se hereda del momento de dibujar.** La textura que esté puesta
     cuando empieza el trazo es la que se queda. Por eso los **preajustes** tienen sentido — eligen las dos
     texturas base de golpe y a partir de ahí todo lo que levante sale con ellas.
   - **Encima del suelo base NO se inventa nada nuevo**: el pincel de textura y las **capas de terreno con
     transparencia que ya existen** (§ 7.1) siguen siendo el camino para todo lo demás. La sala mete un suelo
     DEBAJO de lo que ya había; no lo reemplaza.
   - ⛔ **Va tabla + migración, y pasa por el DBA antes de una línea de código de salas.**
   - 🔒 **Esto es del modo «Dibujar aquí» y de nadie más.** Marcando sobre una foto no hay suelo que guardar:
     el suelo es la foto.
7. **🆕 ¿Las dos texturas de base son de la ESCENA o de la campaña?** Si son de la escena, cada mapa lleva las
   suyas; si son de la campaña, se eligen una vez y valen para todas. La segunda es menos trabajo para él y
   menos flexible.

### 🧩 EL GRUPO — modo «Sobre una foto» (decidido el 2026-09-03)

> **Esto NO son salas y no tiene nada que ver con la pregunta 6.** Marcando muros sobre una foto no hay suelo,
> ni textura, ni preajuste: hay muros. Confundir las dos cosas fue el error de la sesión anterior y es lo que
> hizo que el interruptor de modo se quedara sin construir «por culpa de la 6», cuando no dependía de ella.

Lo que pidió, con la herramienta del círculo puesta sobre una foto de mapa: «*no puedo arrastrar y seleccionar
por grupo*» · «*debería poder seleccionarlo entero y luego con doble clic por pedacitos, si no, cuando esté en
medio de otras cosas no se podrá mover*» · «*cuando lo seleccione debería poder escalarlo*».

- **Qué es un grupo**: los muros que salen de UN gesto. Un círculo son once muros y para él son **una cosa**.
  Puede acabar siendo el contorno de una sala, un pilar o un estanque — al grupo le da igual, y por eso **no
  se llama sala**. Nombre elegido por él: **«Grupo»**.
- **Un clic coge el grupo entero. Doble clic entra dentro** y ya se coge el muro suelto, como hoy.
- **Cogido, se mueve y SE ESCALA.** Escalar afecta sólo a la geometría de sus muros; puertas y ventanas que
  vivan en ellos se mantienen en proporción.
- **Se guarda.** Tiene que aguantar abrir una puerta, mover una pared, recargar y volver mañana. Adivinarlo
  cada vez mirando qué muros se tocan se rompe justo cuando más se usa.
- **Se puede agrupar a mano** (elección suya): coge varios muros por área y los ata él. Sin eso, todo lo que ya
  tiene marcado en sus mapas se quedaba suelto para siempre.
- **La selección por área tiene que coger muros.** Hoy `tokensInRect` coge **sólo fichas**
  (`MapCanvas.tsx`, gesto `marquee`) — no está roto, es que nunca se hizo para muros.
- 🎨 **Sin dibujar todavía**: cómo se ve un grupo cogido (marco, tiradores para escalar, qué enseña la barra
  mientras). No está en el v3 y va al `.pen` antes de tocar código.

### Modelo de datos
**Para las paredes sueltas, ninguno nuevo**: se escriben filas en `maps_walls` con `kind: 'wall'`, que es lo que
ya hace la herramienta.

**Para el GRUPO, sí hace falta algo**: los muros de un mismo gesto tienen que quedar atados, y tiene que
sobrevivir a recargar. Es una marca compartida en `maps_walls`, no una tabla de salas. **Pasa por el DBA antes
de tocar código.**

**Para la SALA con su suelo (pregunta 6, ya contestada)**: tabla de habitaciones con su contorno y su textura
base, con las capas de terreno existentes por encima. **Pasa por el DBA antes de tocar código.**

### 🎨 EL DISEÑO v3 (2026-09-03) — pendiente de su ok

Tercer intento, en `rolvium.pen`, banda 5. **Dos frames, porque el panel cambia según el modo:**

- `PL/Builder · panel ← v3 (modo + preajustes)` (`ePNCc`) — modo **«Dibujar aquí»**, el panel entero (300×650).
- `PL/Builder · panel ← v3 · modo SOBRE UNA FOTO` (`zpsjH`) — el mismo panel marcando sobre una foto: se
  caen los preajustes, las dos texturas base y el pincel de sala, porque ahí el suelo lo pone la foto.

Qué corrige respecto del v2, correción por corrección:

| Suya | Cómo queda en el v3 |
|---|---|
| 1 · «es el mismo Builder» | Se llama **Builder**; muro · puerta · ventana intactos y con la nota «se abren con el mismo disco» al lado |
| 2 · «el icono que habíamos quedado» | `builder-mask.png`, el suyo de verdad, metido como relleno de imagen en la cabecera |
| 3 · «respeta los colores» | Rojo sangre sólo en acciones (`CAMBIAR`, `+ SUBIR`, `QUITAR`); negro sólo en lo seleccionado |
| 4 · «falta el tema de aberturas» | Fila de siempre + nota explícita de que se abren con el mismo disco |
| 5 · «te quedas corto con rectángulos» | Seis formas: a mano · recta · rectángulo · círculo · polígono · a pulso |
| 6 · «no me queda claro cómo cambio la textura» | Tres niveles visibles en el propio panel: preajuste → las dos base → pincel por sala, con los dos pasos escritos |
| 7 · «no sé si faltan herramientas» | Abierto todavía; con las seis formas y los tres niveles, lo que falte ya se ve sobre el panel |
| 🔑 «son dos maneras que conviven» | **Sección nueva arriba del todo**, con dos miniaturas de verdad: una foto con muros marcados encima, y una sala levantada en la app. Es lo primero que se ve al abrir el panel |

**Segunda pasada del 2026-09-03**, después de que dijera que la rejilla era «un adefesio»: las miniaturas ya no
son un marco de cuadro con un borde alrededor, sino **la esquina de un mapa** — el muro entra en L por arriba
y por la izquierda y el suelo se sale por abajo y por la derecha, con su rejilla de casillas. Es lo que hace
que se distinga de un vistazo un rayado de un relleno. Y los dos rayados pasan a **trazo a mano**, más
`Trazo a mano` con el contorno tembloroso.

### Estado
- ✅ **Motor completo** (`domain/useCases/roomRules.ts`): rectángulo, círculo, **polígono** y **a pulso**.
  - **Polígono**: los VÉRTICES se pegan a la rejilla, los LADOS no → una pared puede ir a cualquier ángulo
    (su punto 5) y a la vez dos salas contiguas encajan sin rendijas de medio píxel por donde se cuela la vista.
  - **A pulso**: NO se pega a la rejilla —pegado saldría una escalera— y se limpia el temblor del ratón, o
    cada trazo dejaría cientos de muros que recalcular en cada refresco de la visión.
    - 🔧 **Corregido el 2026-09-03**: la limpieza medía cada punto contra la cuerda de sus **dos vecinos
      inmediatos**. En una recta funciona; en una CURVA cada punto está prácticamente encima de esa cuerda, así
      que no se guardaba ninguno y la red de seguridad devolvía **el trazo crudo entero** — la guarda que debía
      acotar los muros era justo lo que los dejaba sin acotar. Con la rejilla en 27, un círculo a pulso de
      radio 4 casillas escribía **75 muros**; de 15, **282**. Ahora es **Ramer–Douglas–Peucker**: se mide
      contra la cuerda del tramo COMPLETO y el anillo se parte por sus dos cabos (el primer punto y el más
      lejano a él), que es lo que le da extremos a una curva cerrada. Los mismos trazos salen hoy en **11** y
      **16** muros, y el número lo acota la tolerancia, no el tamaño de la sala. Y se ha quitado la vuelta del trazo crudo: lo que se resuelve en menos de tres vértices es
      una raya, y `freehandSides` la rechaza. Lo sujetan cinco tests de **trazo redondeado** — el agujero era
      que el único trazo de prueba era un cuadrado, todo lados rectos.
  - **Polígono, cierre**: se cierra pinchando sobre el primer vértice, con el tope en **media casilla**. Con el
    tope en una casilla entera el vecino en cruz —que cae a exactamente `grid`— cerraba la sala en vez de poner
    el vértice, y una L cuya última esquina cae junto a la primera era imposible (corregido el 2026-09-03).
  - **Una sala se escribe de una vez** (`MapsPort.addWalls`, un `insert` de varias filas): entran todos sus
    muros o no entra ninguno. Muro a muro, si fallaba el enésimo la sala quedaba **abierta** y por ese hueco se
    colaba la visión, avisando sólo con el banner genérico (corregido el 2026-09-03).
- ✅ **Interfaz construida**: la barra «Segmento» (que es Builder) lleva ahora la fila de formas —
  segmento · rectángulo · círculo · polígono · a pulso— y el lienzo pinta la sala mientras se levanta.
  **El Builder de siempre no se ha movido**: sin tocar la forma sigue siendo clic a clic, y puertas y
  ventanas siguen partiendo muros con `planOpening`. Hay test que lo sujeta.
- ✅ **La niebla funciona con lo levantado aquí**, que era el requisito con nombre. Dos tests: uno en el
  motor de visión de la API (una sala tapa la vista desde fuera y la contiene desde dentro, y un vano la
  deja pasar) y otro de regresión que comprueba que **no hay ninguna marca** que distinga una sala generada
  de un muro marcado a mano sobre una foto.
- 🟠 **Decisiones tomadas al construir, revisables por él**:
  - Los muros generados **nacen ocultos al jugador** (`visiblePlayers: false`), como cualquier muro nuevo.
    Es la pregunta 5 de abajo, contestada por coherencia con lo que ya había.
  - **Ninguna puerta automática** (pregunta 1): la sala se levanta cerrada y él abre los vanos con el disco
    de siempre. Es lo que ya sospechaba el spec.
  - **Dos salas que se tocan no se funden** (pregunta 2): quedan los dos muros. Es lo que menos promete y
    lo que se puede cambiar después sin romper nada.
- 🎨 **Diseño v3 en `rolvium.pen`, RECHAZADO por él** (2026-09-03). Lo dio por zanjado con un «ve
  construyendo y después vemos», así que la interfaz de arriba se ha construido con la barra que ya existía,
  sin inventar pantalla nueva. Las miniaturas de estilo siguen sin gustarle y **el panel de preajustes no se
  ha construido**.
- ⛔ **Las texturas, sin empezar**: dependen de la pregunta 6, que es de modelo de datos y es suya.


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

### Rebanada 7 — capas, luces, ojos de un personaje y penumbra
Migración `supabase/migrations/20260831120000_maps_layers_lights.sql`. **Dos tablas nuevas**, una columna
`layer_id` en las tablas de contenido que ya existían y un relleno para las escenas de hoy. Nada que tocar a
mano al desplegar.

- **`maps_layers`** — las capas de una escena. Guarda de qué **tipo** es (terreno · objetos · criaturas y
  personajes · notas del director), su **nombre**, su **orden**, si está **encendida** y si está
  **bloqueada**; y, sólo en las de terreno, la **foto**, su **encaje** y el **puntero a la máscara** del
  pincel de transparencia con un **número de versión**.
  - **Tres capas son fijas y hay exactamente una de cada por escena** (objetos, criaturas, notas del
    director): lo garantiza un índice único, y un disparador se las crea a toda escena nueva sin que nadie
    tenga que acordarse. El **terreno** es el único sin límite.
  - Las fijas se guardan **sin nombre**: la pantalla las rotula desde el tipo con las claves de i18n, para no
    meter castellano en la base de datos. Sólo las de terreno, que crea el director, llevan nombre propio.
  - El **orden** sólo ordena capas del mismo tipo. El orden entre tipos no se guarda porque no se elige: es
    el motor de pintado (terreno → objetos → criaturas → notas del director).
  - **El ojo es el de Photoshop** (aclaración literal del dueño, 2026-08-31: *«las capas son para cada
    escena, es un recurso para lograr cosas gráficas, como en photoshop»*): una capa apagada **no se pinta
    para nadie**, tampoco para el director. **No es un interruptor de privacidad** — y por eso «Notas del
    director» tiene que ser un tipo aparte: un interruptor se pulsa por error, un tipo no. El **candado** en
    cambio sólo afecta al director, que es el único que selecciona cosas.

- **La máscara del pincel de transparencia** se guarda como un **PNG en el bucket `backgrounds`** que ya
  existe, bajo `{campaignId}/masks/{layerId}.png`; en la fila de la capa sólo vive el **puntero** y un
  **número de versión** que sube en cada guardado (rompe la caché y avisa a un navegador de que el suyo se
  quedó viejo). Sin política de almacenamiento nueva: las de `backgrounds` ya dicen que el director sube y
  los miembros leen.
  - **Por qué una imagen y no trazos**, que es lo que hace el pincel de niebla (`maps_fog.explored`, polígonos
    en JSONB) y era el precedente a mirar: la niebla es **sí o no** y un polígono la describe entera; este
    pincel tiene **fuerza regulable**, así que cada punto guarda *cuánto* se ve, no *si* se ve. Como trazos
    habría que repintarlos todos en cada fotograma —miles, con degradado— y la lista crecería sin techo y
    viajaría entera a todos los navegadores en cada retoque. Un PNG **pesa lo mismo con una pincelada que con
    diez mil**, se sirve por CDN y se cachea.
  - **La foto original nunca se toca**: la máscara es un fichero aparte, así que subir la fuerza en sentido
    contrario siempre la devuelve. Sin máscara = capa opaca entera.

- **`maps_lights`** — una luz de ambiente. Guarda su **forma** (cono, radio o cuadrado), su **tipo**
  (antorcha, bombilla, fuego, farol, linterna, luz de luna, resplandor mágico), **dónde está**, **cuánto está
  girada**, la **apertura del cono**, su **color** y si **parpadea**. Vive en una capa como cualquier otro
  objeto de la escena.
  - **Hoy son pintura**: no revelan niebla, no cambian lo que ve nadie y no entran en el cálculo de visión.
  - Pero el **alcance en metros** y si **proyecta sombra** se guardan desde el primer día aunque no se lean:
    añadirlos el día que las luces iluminen obligaría a repasar a mano todas las luces ya colocadas de todas
    las escenas. En metros y no en píxeles, como `night_radius_m`.

- **«Manda esto a otra capa»** (petición literal del dueño): `maps_drawings`, `maps_tokens` y `maps_lights`
  llevan la capa donde están. **Vacío significa «su capa natural»** —los dibujos en objetos, las fichas en
  criaturas— así que **nada de lo que ya existe hubo que rellenarlo**.
  - Al borrar una capa **se van sus dibujos y sus luces** (es lo que significa borrar una capa en cualquier
    editor), pero **las fichas no**: una ficha es una pieza de juego con estado —los PV de la copia del
    bestiario, quién la controla— y perder el personaje de un jugador por borrar una capa decorativa sería un
    desastre silencioso. Vuelve sola a su capa natural.
  - Un jugador **sigue moviendo sólo `x` e `y`**: `layer_id` entró en la lista de columnas que el disparador
    `maps_tokens_guard_update` le prohíbe tocar. Sin eso podría mandar su ficha a las notas del director y
    desaparecer del mapa de los demás.

- **Las escenas que ya existen**: el relleno les crea sus tres capas fijas y **sube su foto de fondo a la capa
  de terreno de más abajo**, porque el dueño espera ver **su** foto en la lista para poder ponerle otra encima
  y borrarle trozos. `maps_scenes.bg_image_url` y `bg_transform` **no se borran ni se vacían** —el código de
  producción todavía los lee y quitarlos dejaría la escena en negro entre la migración y el despliegue de la
  pantalla—, quedan como respaldo con esta regla para quien pinte: **si la escena tiene alguna capa de
  terreno, manda la capa y `bg_image_url` se ignora**. Así no se pinta dos veces ni antes ni después.

- **Acceso**. **Escribe sólo el director** (capas y luces), como todo lo demás de la escena. **Lee**
  cualquier miembro que pueda ver la escena, pero **nunca** la capa «Notas del director» ni una capa apagada
  —ni la capa ni su contenido—. Lo decide un solo helper, `public.maps_layer_sends_to_players()`, usado por
  las políticas de capas, luces, dibujos y fichas, para que la regla dura del spec («la capa de notas **no
  viaja**: no es que se pinte oculta, es que no se envía») viva en un único sitio. La visibilidad **por
  ficha** (`visible`) sigue mandando, que es de reglas y no de capas: se suma a la de la capa, no la
  sustituye.
  - Comprobado en local consultando **como el jugador de verdad** (rol `authenticated` con su sesión, que es
    como consulta la app): de una escena con capa apagada y capa de notas, al jugador le llegan **sólo** las
    capas, fichas, dibujos y luces que se le pintan; y no puede crear capas, colocar luces ni dibujar en las
    notas del director. `db lint --level error` limpio y `npm run audit` 0 hard (RLS activa, ninguna política
    `TO anon`).

- **Lo que esta rebanada NO guarda, a propósito**:
  - **La sonda de prueba** (§ 7.3) no guarda **nada**: ni la sonda, ni dónde la dejaste, ni lo que vio. No es
    una fila de `maps_tokens` y no toca la niebla de nadie. Lo explorado que enseña lo acumula el NAVEGADOR
    mientras la sonda está puesta y se tira al quitarla. La visión sí la calcula la API —desde un punto
    `{x, y}`, no desde una ficha—, y esa petición tampoco escribe.
  - 🧨 **Y queda escrito por qué**: la versión anterior («ver con los ojos de ‹personaje›») pedía
    `getExplored(escena, dueño-de-la-ficha)` y con un director eso viene vacío → mapa negro en producción.
    Que nadie vuelva a atar esta herramienta a la memoria guardada de NADIE.
  - **La penumbra** no inventa un número: su anchura sale de `maps_tokens.vision_radius` y de la luz de la
    escena, que ya existen.
  - ⚠ **El bulto de una ficha en penumbra no puede viajar por RLS**: la RLS decide **filas enteras, no
    columnas**, así que mandar la fila sería mandar el nombre y el retrato. Lo manda **la API con
    `service_role`**, recortado a posición y tamaño. Queda escrito para que nadie «arregle» la política de
    `maps_tokens` abriéndola a las fichas en penumbra — eso convertiría el efecto en el agujero que el spec
    prohíbe.

### Rebanada 4 — paredes sólidas
Migración `supabase/migrations/20260822000000_maps_solid_walls.sql`. **Una sola columna**, aditiva y con valor por
defecto. No crea tablas ni políticas: `maps_scenes` ya tiene RLS con `maps_scenes_select` (leen los miembros de la
campaña) y `maps_scenes_dm_write FOR ALL` (escribe sólo el director), que es exactamente el reparto que pide la
spec — el interruptor lo pone el DIRECTOR y lo LEEN todos, igual que la luz o el modo de niebla.

- **`maps_scenes`** gana **`solid_walls`** (sí/no, por defecto **no**): si en esta escena un token puede o no
  atravesar un muro. Va por escena y no por campaña porque una mazmorra y un descampado no piden lo mismo, y se
  guarda —en vez de ser un botón del momento— porque «se te olvida encendido o apagado».
- **Por defecto NO**, a propósito: ninguna escena de las que ya existen se vuelve sólida de un día para otro sin
  que el director lo pida. Nada que rellenar a mano al desplegar.
- **`maps_walls` no se toca.** `blocks_move` existe desde la rebanada 1 y ya guarda qué corta el paso; lo único
  que faltaba era un sitio donde decir «en esta escena, hazle caso». Lo que bloquea es
  `blocks_move AND NOT is_open`, así que una puerta abierta deja pasar.
- **Que el director nunca choque NO se guarda**: es una regla, no un dato, y vive en el código con el resto de la
  física. Guardarlo daría dos sitios donde decir lo mismo y un día dirían cosas distintas.
- Acceso: **lee** cualquier miembro de la campaña que pueda ver la escena; **escribe** sólo el director. Sin
  política nueva porque las que hay ya lo dicen. Comprobado en local: `db lint --level error` limpio,
  `npm run audit` 0 hard (RLS activa, ninguna política `TO anon`).

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
