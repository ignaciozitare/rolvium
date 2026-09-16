# Susurros (H8) — SPEC

> El módulo se llama `chat` por dentro (carpeta, ids, tabla) porque así nació y renombrarlo no le cambia nada a
> nadie. **En pantalla se llama SUSURROS**, y esa es la palabra: suya, 2026-09-15, «*el chat son los susurros, es
> más cámbiale el nombre*». Nunca «chat» en la interfaz.

**Estado: ✅ construido, revisado, QA pasado (modo bloqueo) y EN PRODUCCIÓN desde el 2026-09-15 (v0.10.0)**;
migraciones `chat_susurros` y `chat_susurros_harden` aplicadas al proyecto de producción. **Las pastillas tipo
LinkedIn** —ventanita de conversación sobre la mesa, ver «La pastilla» abajo— entraron el 2026-09-16 con la
**v0.11.0**. ⏳ **Pendiente**: el botón para traer una tirada del Registro a una conversación (el modelo de datos
ya lo soporta; le toca su propio paso de diseño).

## Purpose
Hablar en privado sin salir de la campaña: el director le dice a UN jugador «escuchas un ruido detrás de ti» sin
que se entere el resto, y los jugadores se escriben entre ellos. Who: los miembros de la campaña.

**No hay canal público.** Para hablar en la mesa ya está la mesa, y para los dados está el Registro; esto es
sólo lo privado. Decisión suya del 2026-09-15, que deja sin efecto el «canal **Mesa** (todos)» del spec viejo.

## What the user can do
- **Pestaña SUSURROS** en la columna lateral de la mesa (hoy dice «en construcción», junto a Registro · Notas ·
  Bitácora).
- Al abrirla: el **directorio de los jugadores de la campaña**. Se pincha a uno y se abre la conversación; se
  pincha a varios y se arma un **grupo**.
- Conversación de uno a uno o de grupo, con los mensajes uno debajo de otro y **avatar, nombre y hora**.
- **Cualquiera escribe a cualquiera**: el director a un jugador, un jugador al director, y los jugadores entre
  ellos. Ningún permiso especial.
- **La pastilla** —así la llama él— es una **ventanita de conversación tipo LinkedIn, abajo a la derecha, encima
  de la mesa** (aclarado por él el 2026-09-16: «*cuando abro una conversación tiene que estar la pastilla, se
  tiene que poder minimizar… no es fija, se tiene que poder cerrar*»). Lo de la columna se queda como está y
  las pastillas SE AÑADEN:
  - Al abrir una conversación desde el directorio, se abre en la columna como hoy **y además aparece su
    pastilla, MINIMIZADA**: una barrita con avatar y nombre. No nace desplegada a propósito —decisión suya del
    2026-09-16, al ver que si no se veía la misma conversación dos veces a la vez—; la ventanita la despliega él
    cuando la quiera. Si esa pastilla ya estaba puesta se respeta como la tuviera y sólo se le pone el contador
    a cero.
  - La pastilla se **despliega** (la conversación entera: mensajes, escribir, tirar en privado, ENVIAR), se
    **minimiza** (vuelve a la barrita) y se **cierra** con una X. Cerrarla no borra nada: se reabre desde el
    directorio.
  - Sirve para seguir hablando mientras la columna está en otra pestaña (Registro, Notas) o plegada. **Varias a
    la vez**, una al lado de otra.
  - Cuando **alguien te escribe** y no tienes su pastilla, **aparece sola, minimizada, en rojo sangre** (para
    que se vea) **y con un sonido corto**; lleva el número de mensajes sin leer. Si la tienes abierta, el
    mensaje entra directo. Esto SUSTITUYE al aviso que saltaba y se iba solo a los pocos segundos (lo construido
    el 15-09 como «pastilla», que él no había pedido así).
  - Al desplegarla se marca como leída y deja de estar en rojo.
  - **Mirar es mirar, dé igual dónde**: si esa conversación se está leyendo en la columna, lo que llegue NO le
    pone contador ni rojo a su barrita. Lo mismo que si la pastilla estuviera desplegada.
- La pestaña lleva un **contador de no leídos**.
- **Tirar en privado dentro de la conversación**, y **traer una tirada del Registro** a la conversación para
  enseñarla («mirad esto»).

## Rules & limits
- **El historial es de la CAMPAÑA y se guarda** (suyo: «*vive dentro de la campaña, esto se guarda*»): lo de hoy
  sigue ahí la semana que viene, y no se borra al cerrar la mesa ni al cambiar de escena.
- Una conversación **sólo la leen sus participantes** — lo impide la RLS, no la pantalla.
- **Los dados van al Registro por defecto.** Ese camino no cambia.
- **Una tirada hecha en privado NO deja NINGÚN rastro en el Registro** — ni el resultado ni un «fulano tiró en
  privado». Suyo, 2026-09-15, preguntado expresamente. **Cualquiera** puede tirar en privado, no sólo el
  director.
- Una tirada traída del Registro viaja como referencia: si el Registro la tiene, la conversación la enseña.
- Sin editar ni borrar mensajes en v1 (auditoría simple).
- Un grupo lo crea cualquiera; en v1 **no se renombra ni se sale de él**.
- Pastillas: **hasta tres abiertas a la vez**; al abrir una cuarta se cierra la más antigua. El sonido suena
  SÓLO cuando aparece una pastilla por un susurro ajeno, nunca por lo que escribes tú (el navegador no deja
  sonar nada hasta que has tocado la página una vez: en la mesa eso ya ha pasado siempre).
- Fuera de alcance: voz y vídeo (para eso está Discord), reacciones, hilos, adjuntar ficheros o imágenes.

## Connections
- `dice` — el Registro (`RollLog`) es de donde se traen las tiradas y donde NO aparecen las privadas.
- `table` — la pestaña vive en la columna lateral (`SidePanel`, hoy con las cuatro pestañas y tres en obra).
- `campaigns` — los participantes salen de los miembros de la campaña.
- `identity` — avatar, nombre y alias.
- `realtime` — un mensaje nuevo llega solo, sin recargar (`postgres_changes`), igual que el resto de la mesa.

## Modelo de datos

**Tres tablas.** `chat_conversations` es cada conversación (1:1 o de grupo), siempre dentro de UNA campaña.
`chat_conversation_members` dice quién está en cada una, y ahí vive el contador de no leídos (cuándo la abrió
cada quien por última vez, por persona). `chat_messages` es cada mensaje, uno debajo de otro — sin editar ni
borrar, la base lo impide igual que con el Registro.

**Tres tipos de mensaje.** Uno normal, de texto. Uno de **tirada privada**: el dado se tira en el servidor,
igual que las tiradas del Registro, pero el resultado se guarda AQUÍ, en `chat_messages` — nunca en la tabla
del Registro (`dice_rolls`). No es una cuestión de ocultarlo en la pantalla: no hay ningún camino de datos por
el que una tirada así pueda llegar al Registro, ni para el director. Uno de **tirada traída del Registro**:
sólo apunta a la tirada que ya existe allí (una referencia), nunca la copia — y sólo se puede traer una que
ya se pudiera ver (de la misma campaña, y pública, suya o del director; la RLS lo impide, no la pantalla).
⏳ Falta el punto de entrada en pantalla (desde el Registro): el modelo de datos ya lo soporta, pero la UI no
estaba en el `.pen` aprobado — le toca su propio paso de diseño antes de construirse.

**Quién crea una conversación.** Cualquier miembro de la campaña, sin permiso especial. Si pincha a UNA sola
persona con la que ya habló antes, se reabre esa misma conversación — no se crea una nueva cada vez que se
pincha el mismo nombre. Si arma un grupo (varias personas a la vez), siempre es una conversación nueva.

**Quién lee qué (RLS).** Sólo los participantes de una conversación ven sus mensajes o la lista de quién está
en ella. A propósito, sin la excepción que llevan otras tablas del proyecto: ni siquiera un administrador de la
plataforma puede leer una conversación ajena — el dueño pidió expresamente que lo privado sea privado de
verdad.

**Marcar como leído.** Lo hace cada uno sobre su propia fila (nadie puede tocar la de otro), a través de una
función — no hay una edición directa de la tabla desde el navegador.

**Las pastillas (2026-09-16): sin cambio de datos.** Qué pastillas tiene cada uno abiertas o minimizadas es
estado de pantalla de ESE navegador, no de la campaña: no se guarda en la base. El «marcar leído» al desplegar
usa la misma función de siempre.
