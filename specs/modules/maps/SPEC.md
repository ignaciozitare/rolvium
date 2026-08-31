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
- **Rebanada 6 — pendiente**: galería de componentes (muebles, árboles…) para construir mapas dentro de la app.
- **Rebanada 7 — A MEDIAS** (§ «Rebanada 7»). Confirmada por el dueño el 2026-08-31, y va **ANTES que la 5 y
  la 6** (decisión suya del mismo día): es donde pasa la partida y es lo que menos se ha tocado desde que lo
  pidió (2026-08-20).
  - ✅ **HECHO** (2026-08-31): el modelo de datos entero · el **panel de capas** (ojo, candado, orden, borrar,
    aviso de peso) · las **capas de terreno apiladas con su máscara** pintándose en el lienzo · las **luces de
    ambiente** de punta a punta, con su herramienta, su editor y el **parpadeo animado** por tipo.
  - ✅ **HECHO también** (2026-08-31, noche): el **pincel de transparencia** con sus dos sentidos · **mandar
    elementos a otra capa** con el botón derecho · **ver con los ojos de un personaje**, calculado en el
    servidor.
  - 🛑 **BLOQUEADA la penumbra**: su premisa de privacidad no se sostiene hoy — ver el aviso en § 7.4.

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

## Rebanada 7 — capas, luces de ambiente, ojos de un personaje y niebla degradada

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
preparado** para el día que iluminen de verdad.

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
- 🚫 **Lo que NO hace todavía**: no revela niebla, no cambia lo que ve nadie y no entra en el cálculo de
  visión del servidor. Es pintura. Queda dicho aquí para que ninguna línea prometa lo contrario.
- ✅ **Lo que hay que dejar listo para después**: alcance en metros (no en píxeles) y si la luz **proyecta
  sombra** contra los muros. Los dos se guardan desde el primer día aunque no se usen — añadirlos luego
  obligaría a repasar todas las luces ya colocadas de todas las escenas.

### 7.3 · Ver la escena con los ojos de un personaje

⚠ **La mitad ya existe**: el interruptor genérico «ver como jugador» está construido (`playerView` en
`CanvasControls`) y lo que hace es quitarle al director sus privilegios — los muros dorados, el velo azul y
las fichas ocultas. Se queda tal cual.

**Lo nuevo**: elegir **un personaje concreto** y ver la escena tal y como la ve él, con SU niebla y SU
visión. El dueño pidió las dos cosas (2026-08-31).

- Selector de personaje en los controles del lienzo, junto al interruptor de siempre.
- Es **sólo del director** y **no cambia nada para nadie**: no mueve la escena activa, no toca la niebla
  guardada, no avisa al jugador. Es una lente, no un modo.
- Sale rotulado en pantalla —«VIENDO COMO: Karen»— para que no se confunda con la vista propia. La etiqueta
  «VISTA DE DIRECTOR» que ya existe cambia a ésta mientras dure.
- **La visión la calcula el servidor**, con el mismo camino que la del jugador de verdad: si se recalculase
  en el navegador del director, lo que él ve y lo que ve el jugador podrían discrepar, que es justo lo que
  esta herramienta viene a comprobar.

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
  - **Ver con los ojos de un personaje** es una **lente** del director: no mueve la escena activa, no toca la
    niebla guardada y no avisa a nadie. No hay nada que persistir — la visión la calcula la API por el mismo
    camino que la del jugador de verdad.
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
