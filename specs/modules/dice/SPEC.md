# Dice (H6) — SPEC

## Purpose
Todas las tiradas de la plataforma: las del sistema (resueltas por su motor) y las libres (d4–d100, Fudge).
Generadas en servidor, inmutables y verificables. Who: todos los miembros; el director además con visibilidad
restringida.

## What the user can do
- **Tirar desde la ficha** (característica, ataque de arma, activación de don): la UI manda la intención
  (`RollRequest` del sistema + opciones + dados de recurso compartido cogidos) → la API genera dados (CSPRNG),
  llama a `engine.resolve`, persiste dados crudos + resultado → Registro y chat.
- **Lanzador de dados flotante** (ventana flotante arrastrable, **no modal** — la mesa sigue usable debajo; se abre desde el lateral): pestañas de visibilidad
  **Todos / Director / Secreta**, filas d4·d6·d8·d10·d12·d20·d100·Fudge × cantidad 1–6 (tocar = tirar),
  modificador, última tirada.
- **Registro** lateral: por tirada **quién tiró** (el nombre del PERSONAJE, no el de la cuenta: «Karen Sinclair ·
  Magnum .44»), título (característica · especialidad), dados propios / de recurso (borde oro) vs oposición,
  marcador, grado de éxito, avisos (revés, +1 Destino…), tiradas libres con total. Adjuntables al chat.
- **Ver el desglose de una tirada**: al pasar por encima de la entrada —o al llegar a ella con el teclado— sale un
  panel oscuro, «CÓMO SALIÓ ESTA TIRADA», con de dónde salieron los dados, qué reglas se aplicaron sin preguntar y
  cómo se cierra el resultado, cada línea con su página del manual. Debajo de la entrada no cuelga nada: el registro
  se lee de un vistazo y el detalle se consulta.
- Recalcular/verificar cualquier tirada (cliente o API) a partir de los dados crudos.

## Rules & limits
- Tirar *como* un personaje: sólo su dueño o el director (un miembro no puede registrar tiradas contra la ficha de otro).
- Inmutables: nadie (ni el DJ) edita/borra; una corrección es una tirada nueva que referencia la anterior.
- Visibilidad: `table` (todos), `dm` (jugador → DJ), `secret` (solo el autor; DJ). Filtrada por RLS.
- Recurso compartido: el descuento y la tirada son la misma transacción (si no hay dados, la tirada falla).
- El motor genérico sabe `NdX`, contar éxitos por predicado, explotar, mayor/menor, sumar; cada sistema aporta la regla.
- **El desglose lo escribe el SISTEMA, no la plataforma** (`Engine.explain`, opcional): sólo él sabe qué regla entró
  y en qué página del manual está. Un sistema que no lo declare simplemente no enseña desglose.
- **El desglose se lee de la tirada guardada, nunca de la ficha de ahora.** Una tirada es inmutable y su desglose
  tiene que decir lo mismo dentro de un mes, con el personaje ya curado y con otra armadura puesta: por eso
  `engine.resolve` copia en `result.detail` lo que la ficha sabía al tirar (valor de la característica, sus
  especialidades, la penalización por heridas, el estado de salud, la armadura puesta). Cuando esos campos no están
  —tiradas viejas, o resueltas sin ficha, como las de criatura— el desglose **calla** esas líneas en vez de
  inventarse un número.
- **El nombre de quien tiró es el del personaje**, unido por join desde `characters`. Si la RLS no me deja ver ese
  personaje, la entrada se queda sin nombre; **nunca cae en el del usuario**, que no dice nada de quién actuó.
- **«Ponerse a cubierto» (p.96) no sale en el desglose**: la regla no existe todavía en el código, y una línea que
  sólo puede decir «no» para siempre miente. Entra cuando entre la regla.

## Dados 3D (pendiente — pedido del dueño, 2026-08-18)

Al tirar, unos dados en 3D caen sobre la pantalla, se paran mostrando el resultado y desaparecen a los pocos
segundos. El registro de la derecha no cambia: la tirada queda ahí como hoy.

- **La animación NO decide nada.** Los dados los genera el servidor con CSPRNG y la tirada es inmutable
  (§ «Rules & limits»); la animación recibe el resultado ya decidido y **aterriza en él**. Las librerías de dados 3D
  aceptan justo eso — se les pasa la cara de cada dado. Lejos de debilitar el antitrampas, lo hace visible: se ve caer
  el dado que el servidor ya eligió.
- **Se carga aparte.** WebGL + física + mallas pesan del orden de cientos de KB; el bundle de la web va hoy por
  105 KB gzip. La librería entra por `import()` dinámico **la primera vez que se abre el lanzador**, nunca en el
  arranque. Si la carga falla, la tirada se resuelve igual y sólo se pierde la animación: **nada del resultado puede
  depender de que el 3D funcione.**
- **Duración**: los dados se van solos a los 3–4 s, y se pueden despachar con un clic. No bloquean el lienzo ni la
  mesa: son una capa por encima, sin capturar el ratón una vez parados.
- **Accesibilidad**: quien tenga `prefers-reduced-motion` no ve la caída — el resultado aparece directamente. La
  animación no es la única forma de leer la tirada; el registro lateral sigue siendo la fuente.
- Se abre desde la **primera herramienta** de la barra de la escena (`maps` rebanada 3).

## Connections
`game-system` (poolFor/resolve/actions), `table` (recursos), `characters`/`bestiary` (origen), `chat` (adjunto), `realtime`.

## Modelo de datos
- **`dice_rolls`**: una fila por tirada (sistema o libre): campaña, personaje (opcional), autor, sistema, tipo, título, la
  intención (`request`), los **dados crudos generados por el servidor** (`dice`), el resultado del motor (`result`),
  visibilidad `table`|`dm`|`secret`, `corrects_id` (una corrección es una tirada nueva que apunta a la anterior), fecha.
  **Inmutable** (trigger bloquea UPDATE/DELETE, también al director; sólo pasan las acciones de FK — borrar la campaña
  arrastra sus tiradas, borrar el personaje deja `character_id` a null). Se inserta sólo desde la API mediante
  `dice_commit_roll` (service role): comprueba la membresía del actor, **descuenta los dados de recurso compartido de su
  mano en la misma transacción** (si no los tiene, la tirada falla con `pool_empty`) y guarda la fila. La API además
  rechaza (403) una petición que tire más dados etiquetados con un recurso compartido de los que declara en
  `sharedResources`, para que el descuento no pueda esquivarse.
- Lectura por RLS: miembros de la campaña ven `table`; el autor ve las suyas; el director lo ve todo (`dm` y `secret`).
  El canal Realtime (`postgres_changes` en `dice_rolls`) sólo entrega lo que la RLS permite.
- Efectos de la tirada sobre la ficha (`result.effects.patch`, p.ej. subir Destino / recargar Fortuna) se aplican en la
  API tras guardar la tirada, con origen `roll`, por el mismo camino autoritativo que la ficha.
- Migración: `supabase/migrations/20260818120000_dice_rolls.sql`.


---

## Cómo se lanza una tirada, y el panel del director (pedido del dueño, 2026-08-20)

### El problema que arregla
La ficha tiene arriba un bloque «Tirada» con dificultad, especialidad y armadura como **preset pegajoso**: lo dejas
en «Difícil» y todas las tiradas siguientes salen así sin avisar. Está mal por dos motivos del manual:
- **La dificultad no la pone el jugador.** p.84, literal: «Los dados de dificultad son **lanzados por el director de
  juego**».
- **No se tira en el vacío.** p.82: todas las acciones son **tiradas opuestas** — dificultad si es reto, la
  característica del rival si es conflicto.

### Lado del jugador: todo al botón, y nada que adivinar

> **Estado — construido** (columnas 1 y 2 del `.pen` «Mesa/Tiradas · rediseño», nodo `v3vfV`).
> `characters/ui/RollPopover.tsx` + `characters/domain/useCases/rollIntent.ts`. Sale sobre la ficha,
> pegado al botón (`<Sheet>` pasa el rectángulo del botón como 4.º argumento de `onAction`), con captador
> invisible y Escape, igual que `CreatureRollPopover`. **Abre en TIRAR de una característica y en la
> acción de un arma**; activar un don y recargar siguen yendo directas, que es como estaban — el `.pen`
> no las diseña. **El bloque «Tirada» de la ficha TODAVÍA NO desaparece**: hoy es de donde `poolFor` saca
> la dificultad, y quitarlo antes de que exista el panel del director dejaría las tiradas de reto sin
> oposición ninguna. Se va con la columna 4.
>
> Nada del desplegable sabe de Plenilunio: los alcances salen del catálogo `ranges` (nuevo, con su
> dificultad y en orden, p.95–96), la penalización por heridas de `healthLevels`, y la reserva de
> `engine.sharedResources` — incluido su `blockedIf`, que es lo que hace que con Destino 10 no se ofrezca.
> Los dados de la reserva se **cogen de la mesa al confirmar** (`takeResource`/`returnResource`, los
> mismos de la barra) porque el servidor sólo deja tirar los que ya están en la mano.

- **Desaparece el bloque «Tirada».**
- Cada botón (TIRAR de una característica, o la acción de un arma) abre su propio panel con **sólo lo que el manual
  deja elegir en ese momento**:
  - ~~Especialidad~~ **NO se elige aquí**: si estás tirando una característica, tu especialidad ya está asignada en
    la ficha. Quien decide si encaja en esa acción es el director, desde su panel (p.83).
  - **Dados de la reserva de Destino** a coger, 0–5 (p.88–89).
  - **Alcance** si es un disparo: de él sale la dificultad, no se teclea un número (p.96). **Y lo mide el mapa**:
    con los dos tokens colocados la app sabe la distancia, así que sabe sola si es cuerpo a cuerpo o disparo y a
    qué alcance — el jugador sólo lo corrige si hace falta.
- **En el modal del jugador no van las leyendas de «esto ya lo sabe la ficha»** (dueño, 2026-08-20: mataban la
  pantalla y no aportaban nada). Lo que la ficha sabe se aplica y punto; si hace falta explicarlo, va en el
  **tooltip del registro**, no en el modal. Lo que el modal enseña son **dos controles**: cuántos dados tiras
  (con −/+) y cuántos coges de la reserva; en un disparo, además, el alcance. **Nada más.**
- Lo que la ficha ya sabe y aplica sin preguntar:
  - Penalización por heridas: −1 dado herido, −2 malherido (p.99), ya restada del total.
  - Armadura: si sale algún fracaso, convierte tantos triunfos como su penalización en éxitos normales (p.98).
    ⚠ **No quita dados** — error que hubo que corregir en el diseño.
  - Munición: disparar gasta un punto de cargador; sin balas el botón sale apagado (p.97).
  - Bonificación del arma: sólo cuerpo a cuerpo (p.96).
- **El jugador no elige cuántos dados tira**: son los de su característica (p.82). Sólo elige dados de reserva y,
  en combate, cómo reparte los de Combate.

### Lado del director: el panel de tiradas
Vive en la escena. Es **el mismo lanzador de dados** con un botón de **expandir**; no es una ventana nueva.
Corregido con el dueño el 2026-08-20, punto por punto:

- **Pedir una tirada**: primero marca **a quién** —y se puede marcar **a más de uno**—, y luego **mantiene pulsada
  una característica**: el desplegable de dificultad sale **pegado a ese botón**, suelta encima de la que quiera y
  la petición sale. **Sin botón de confirmar.** Las siete características van a **ancho igual**, dos filas de tres
  y la séptima centrada.
- **Si le vale la especialidad lo marca él**, no el jugador: es lo que dice p.83 («es el director de juego quien
  debe determinar si la especialidad del personaje es adecuada en esa ocasión»).
- **Lista de encuentros** de la escena, plegable, dentro del panel:
  - se pueden **añadir** encuentros a mano;
  - **el token que se tira al mapa se añade solo** a la lista;
  - el **nombre se edita en la propia fila** con un lápiz pequeño («EL DE LA PUERTA» en vez de «Hambriento (2)»);
  - una **flecha despliega** sus características y sus otras tiradas, y **al abrir uno se cierra el anterior**;
  - dentro del desplegado vale el mismo mantener-pulsado para la dificultad.
- **Atacar desde el token**: tocar la criatura en el mapa abre **su** modal de ataque. **Se suma a la lista, no la
  sustituye** — la lista sirve cuando no quieres buscar el bicho en el mapa. Esto es lo que hace que el panel no se
  desborde cuando hay diez criaturas en la escena.
- **Las tiradas del director para sí mismo NO van en este panel**: van en el lanzador de dados que ya existe.

**Tirada de una criatura contra el entorno vs contra un jugador**: contra el entorno es un reto y lleva dificultad
(mismo mantener-pulsado). **Contra un jugador es un conflicto y NO lleva dificultad** — los dados del otro lado los
pone el jugador al defenderse, así que ahí el desplegable no debe aparecer. Los dados de la criatura son su
característica; sólo en **Combate** se eligen, porque el libro deja repartirlos entre varios objetivos (p.94), y eso
vive en el modal de atacar.

### Tirada enfocada, y la respuesta agrupada
Al elegir jugador, la tirada queda **enfocada contra él**: le salta el aviso, contesta, y **las dos quedan como una
sola entrada agrupada** en el registro (pedido literal del dueño: «que quede todo agrupado»).
- **Cuerpo a cuerpo** (conflicto, p.93): al jugador se le pregunta **cuántos dados de Combate gasta en defenderse**
  (0 a su Combate). Los gastados **se le descuentan del turno siguiente**; si gasta todos renuncia a ese turno, y si
  ya los gastó todos queda **indefenso** (p.94: «sólo puede tomar dados de su siguiente turno»).
- **A distancia** (reto, p.96): el jugador **no gasta dados de defensa**. Lo que sí puede es **ponerse a cubierto**
  —reto de Combate o Astucia, y si lo logra, dispararle cuesta **+2 dados de dificultad** (p.96).
- **Si el jugador no contesta, la tirada espera indefinidamente.** Nadie la resuelve por él, ni el director
  (decisión del dueño, 2026-08-20).

### Reglas y límites
- El jugador **nunca** elige la dificultad de su propio reto.
- El registro **no etiqueta** si el grupo de la derecha es una dificultad o un rival. Es una regla del libro, no un
  descuido — p.85, literal: «Como todas las acciones requieren tiradas opuestas, Luis **no sabe** si el director de
  juego tira los dados porque hay otro personaje o porque es la dificultad de la acción».
- Los dados los sigue generando el **servidor**, y las tiradas siguen siendo **inmutables**: una tirada agrupada son
  **dos tiradas enlazadas**, nunca una editada.
- Atacar «como» una criatura es del director; un jugador no puede.

### El orden de turnos (p.92–93) — decisión del dueño, 2026-08-21

Sin turnos la columna 5 no se puede construir: defenderse **gasta dados del turno siguiente**, y no había
turno siguiente. El dueño eligió construir el orden entero en vez de fingirlo con un contador.

- **Quién entra**: lo abre el director y elige; le vienen ya marcados los personajes de la campaña y los
  encuentros de la escena.
- **El orden lo calcula la app**: **Destino descendente**. Empate → **PJ antes que PNJ**; entre PJ → **mayor
  Combate**; si aún persiste, **decide el director** (la app le pregunta cuál va antes). Literal de p.92–93,
  RULES.md §5.1. **El director NO reordena a mano** — el mando que el libro le da es desempatar, y sólo ese
  (decisión del dueño: dejar arrastrar libremente convierte la regla del Destino en una sugerencia).
- **Siguiente turno** y **cerrar el combate** los lleva el director.
- **Adelantarse cuesta 1 Fortuna** (p.89 uso 5, p.92) y **el sitio nuevo se queda** para el resto del
  combate: «el nuevo orden se mantiene».
- Cada uno entra en su turno con sus dados de Combate **menos los que gastó defendiéndose**. Sólo se puede
  tomar prestado del **turno siguiente**, nunca de más allá (p.94, literal).
- Vive **en la escena**: un combate es de una escena, como los encuentros.

### Columna 4 · el panel del director — lo que dibuja el `.pen` (`v3vfV` → `qHMjx` → `QWHSS`)

Head **«LANZADOR · DIRECTOR»** + icono `unfold_less`: es el lanzador que ya existe, **expandido**.

- **«¿A QUIÉN LE PIDES LA TIRADA?»** · «puedes marcar varios» · chips de cada personaje + **«A TODOS»**.
- **«MANTÉN PULSADA UNA CARACTERÍSTICA»** · «y elige la dificultad sin soltar · p.84». Las siete a ancho
  igual, **tres por fila** (la séptima queda en la columna del medio). Al mantener pulsada, el botón se
  pone en tinta y **el desplegable sale pegado a ÉL, tapando lo que haya debajo**; la opción bajo el dedo
  se resalta en **oro**. Opciones: `FÁCIL · 1` `MEDIA · 2` `DIFÍCIL · 3` `MUY DIFÍCIL · 5` `ÉPICA · 6`.
  Nota del `.pen`: **«Sueltas encima de la dificultad y la petición sale. Sin botón de confirmar.»**
- Casilla **«Le vale su especialidad — lo decides tú (p.83)»**.
- **«ENCUENTROS EN LA ESCENA · N»** + **«+ AÑADIR»** + flecha de plegar. Cada fila: token con iniciales,
  nombre + **lápiz**, sub «Resistencia 30 · protección 3 · p.152», botón **ATACAR** (rojo sangre) y flecha
  de desplegar.
  - **Renombrar se hace en la propia fila**: el lápiz pasa a **check**, el nombre se vuelve campo de texto
    y **la línea de abajo conserva el nombre original** — «EL DE LA PUERTA» arriba, «Hambriento ·
    Resistencia 12 · p.150» debajo. Así se sabe qué bicho es aunque le hayas puesto mote.
  - Desplegado: las siete características como **número grande + rótulo pequeño** (`8 FOR`, `4 COM`…), una
    fila de chips **«otras tiradas»**, y la nota «Mantén pulsada una para elegir dificultad, igual que con
    los jugadores».
  - **Al desplegar uno se cierra el que estuviera abierto.**
  - **El token que se tira al mapa se añade solo a la lista.**
- Nota del `.pen`: atacar desde el token del mapa **se suma a la lista, no la sustituye** — es lo que evita
  que el panel se desborde con diez criaturas.
- **Las tiradas del director para sí mismo NO van aquí**: van en el lanzador de siempre.

⚠ **A confirmar con el dueño**: el `.pen` dibuja sólo **tres** chips en «otras tiradas» (FORTALEZA,
ASTUCIA, SUTILEZA) de las siete del ogro. No se inventa cuáles son: se pregunta.

### El aviso que le salta al jugador
- **Tirada pedida**: no está dibujada en el `.pen`. **Hay que diseñarla antes de tocar pantalla.**
- **Te atacan cuerpo a cuerpo** (columna 5, `oSBrx` → `dcTPM`) — **CONSTRUIDO 2026-08-21**: panel de papel
  con **filete sangre a la izquierda**, icono `swords` + **«TE ATACA UN OGRO»** en sangre. Cuerpo: «Cuerpo a
  cuerpo con 4 dados de Combate. Es un conflicto: los dados que pongas son tu defensa y tu ataque a la vez
  (p.93).» **«¿CUÁNTOS DADOS DE COMBATE GASTAS?»** con chips `0…Combate` (el elegido en tinta) y «tienes
  Combate: 4 dados» al lado. Caja gris con icono `schedule` y el coste, **que cambia con lo elegido**. Pie:
  **«NO ME DEFIENDO»** (fantasma) y **«DEFENDERME · N DADOS»** (oro).
- **Si el jugador no contesta, la petición espera indefinidamente.** Nadie tira por él, ni el director.
  Por eso el aviso **no se puede cerrar**: ni X, ni Escape, ni pulsar fuera. Quitárselo de en medio sin
  querer dejaría la partida parada sin que se note.
- **A distancia NO salta este aviso**: es un reto contra la dificultad del alcance.
- **Uno cada vez, el más viejo primero.** Dos avisos amontonados taparían el segundo.

#### Cómo funciona por dentro
1. El director ataca desde el token. **Cuerpo a cuerpo no tira**: `POST /attacks` guarda la petición ya
   armada por el sistema, **sin oposición**, con a quién ataca y con cuántos dados.
2. La fila está en la publicación de realtime: el aviso **le salta** al jugador sin recargar.
3. El jugador contesta: `POST /attacks/:id/answer`. La API mete sus dados de defensa como grupo
   `opposition` en la petición guardada, **tira ahí mismo** por el camino de siempre (`performRoll`:
   dados del servidor, tirada inmutable) y cierra el ataque apuntando la tirada que salió.
4. **El autor de la tirada es el DIRECTOR**, no quien contesta: quien ataca es su criatura, y el Registro
   tiene que decir eso.
5. Si la tirada falla, la fila **se queda pendiente** y el jugador puede volver a contestar, en vez de
   quedarse con un ataque muerto delante que nadie puede resolver.

⚠ **Cuántos dados puede gastar**: los que le daría **su propia característica ahora mismo**, pedidos al
`poolFor` del sistema — o sea **Combate menos la penalización por heridas**. No es una cuenta nueva: es el
mismo puñado que tiraría si actuase. El `.pen` dibuja «tienes Combate 4» y la pantalla dice «tienes
Combate: 4 dados», que es lo mismo cuando está sano y lo cierto cuando no lo está.

⚠ **El coste del próximo turno es TEXTO** (p.94). No hay orden de turnos todavía y **no se finge con un
contador**: el aviso dice lo que le va a costar y el jugador lo lleva. Entra de verdad con el orden de
turnos, ver arriba.

⚠ **El director no ve nada mientras espera.** El `.pen` no dibuja una pantalla de espera para él; se entera
cuando la tirada sale en el Registro. **Sin diseñar.**

#### El desglose de un conflicto (p.93 contra p.84)
La petición viaja con `conflict: true`, y sólo por eso el desglose dice **«Conflicto: 2 dados de defensa del
otro lado» (p.93)** en vez de «Reto a dificultad 2» (p.84), y cierra con «… contra 1 **de la defensa**» en
vez de «de dificultad». Los dados y las cuentas son idénticos: lo único que cambia es no llamar reto a un
conflicto. El **Registro** sigue sin etiquetar el grupo de la derecha (p.85); es el desglose, que abre quien
ya sabe de qué iba la tirada, el que lo nombra.

### Ponerse a cubierto (p.96) — ⚠ NO CONSTRUIDO
Es lo único que puede hacer un jugador al que disparan, y sin ello el ataque a distancia le deja sin
respuesta. Sería: reto de **Combate o Astucia, la mayor de las dos**, contra dificultad **1/2/3/5 según la
cobertura**; si lo logra, **dispararle cuesta +2 dados de dificultad**. Cerraría además la línea «A cubierto»
que el `.pen` pide en el desglose del Registro.

**Nada de esto existe todavía.** Este apartado decía «entra en esta tanda» y era falso: se dejó fuera a
propósito porque una línea que sólo puede decir «no» para siempre miente (decisión del dueño, 2026-08-21).
Es lo único del `.pen` de las tiradas que no está construido.

### El bloque «Tirada» de la ficha desaparece con esta tanda
Hoy es de donde `poolFor` saca la dificultad del reto. Se quita **cuando exista el panel del director**, no
antes: quitarlo antes deja las tiradas de reto sin oposición ninguna.

### Fuera de alcance (de esta tanda)
- **Ataques y defensas múltiples** — repartir los dados de Combate entre varios oponentes (p.94).
- ~~Atacar tocando el token de la criatura en el mapa~~ (columna 6 del `.pen`) — **construido 2026-08-21**.
- ~~Orden de actuación por Destino~~ — **entra**, ver «El orden de turnos» arriba (dueño, 2026-08-21).
- El **Bestiario** (H5) como módulo — ya construido.

### ⚠ Bloqueo conocido antes de construirlo — RESUELTO CONTRA EL PDF 2026-08-21
Estaba escrito que las criaturas no tenían ni Combate ni daño. **Las dos mitades eran falsas.**

- **Características**: entraron con el Bestiario (H5). El ogro tiene Combate 4 y el panel puede tirar por él.
- **Daño**: lo dice el libro. Un zarpazo es un **ataque sin armas**, y la tabla de armas (p.97) le da
  **Daño: F**, la Fortaleza del atacante — el propio manual lo usa así en su ejemplo. El ogro pega **8** por
  triunfo. No hace falta ni inventarlo ni teclearlo. Recogido en `RULES.md` §8.
- ⚠ **«Garrote» y «Mordisco» son ESPECIALIDADES de Combate, no armas**: van en la columna de especialidad del
  bloque. Darles una línea de la tabla de armas sería inventarse un dato que el libro no da.
- ⚠ **Capacidades sin construir que tocan al combate**: Ira solar (suma al daño), Ponzoña (ataque aparte),
  Amparo de la noche (éxitos automáticos de noche), Deflagración, Incorpóreo, Inmune al dolor (sin
  penalización por heridas), Ancla terrenal. Tabla completa en `RULES.md` §8. **Fuera de esta tanda**, pero
  anotadas: hasta que existan, un ogro y un solar pegan igual de fuerte aunque el libro diga que no.

### Modelo de datos

**`dice_attacks`** (migración `20260821000000_dice_attacks.sql`) — una fila por ataque cuerpo a cuerpo a la
espera de respuesta. Guarda la `RollRequest` ya armada **sin el grupo de oposición**, quién ataca (nombre
**copiado**, para poder decir «te ataca un ogro» aunque el token ya no exista), a quién (`target_character_id`,
que es quien puede contestar), con cuántos dados, y en qué estado está (`pending` · `resolved` · `cancelled`).
`defence_dice` es lo que contestó: **`NULL` es silencio y `0` es «no me defiendo»**, que no es lo mismo.

⚠ **`cancelled` está en el CHECK pero hoy no lo escribe nadie**: no existe «el director retira el ataque».
Un ataque sólo se va al contestarlo, o en cascada si se borra la escena o el personaje. Cuando exista ese
botón, el sitio ya está hecho (`dice_close_attack(..., 'cancelled')`).

- **RLS**: lo ve el **director** de la campaña y el **dueño del personaje atacado**, nadie más. Los demás
  jugadores se enteran por la tirada, cuando salga en el Registro.
- **Sin políticas de escritura para el navegador.** Crear y contestar pasan por la API con el service role,
  igual que `dice_commit_roll`: los dados los genera el servidor, y si el navegador pudiera escribir la
  tabla podría abrirse un ataque a sí mismo o contestarlo por otro. Tres funciones `SECURITY DEFINER`:
  `dice_open_attack` (comprueba que es el director y que el atacado es de esa mesa), `dice_answer_attack`
  (sólo el dueño del personaje) y `dice_close_attack`.
- **En la publicación de realtime**, que es lo que hace que el aviso salte.
- Los tokens se sueltan con `SET NULL`: borrar un token a mitad de partida no puede borrar el ataque que el
  jugador tiene delante ni dejarlo sin contestar.

⚠ **Dos respuestas EXACTAMENTE simultáneas tirarían dos veces**, porque la fila no se cierra hasta que la
tirada sale bien. Es el precio elegido a cambio de poder reintentar cuando la tirada falla: una tirada de
más se ve en el Registro y no corrompe nada; quedarse sin poder contestar no se ve y no se arregla.
