# Susurros (H8) — SPEC

> El módulo se llama `chat` por dentro (carpeta, ids, tabla) porque así nació y renombrarlo no le cambia nada a
> nadie. **En pantalla se llama SUSURROS**, y esa es la palabra: suya, 2026-09-15, «*el chat son los susurros, es
> más cámbiale el nombre*». Nunca «chat» en la interfaz.

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
- Cuando alguien te escribe, salta **la pastilla** —así la llama él— y **se lee y se contesta ahí mismo**, sin
  salir de la partida.
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
- Fuera de alcance: voz y vídeo (para eso está Discord), reacciones, hilos, adjuntar ficheros o imágenes.

## Connections
- `dice` — el Registro (`RollLog`) es de donde se traen las tiradas y donde NO aparecen las privadas.
- `table` — la pestaña vive en la columna lateral (`SidePanel`, hoy con las cuatro pestañas y tres en obra).
- `campaigns` — los participantes salen de los miembros de la campaña.
- `identity` — avatar, nombre y alias.
- `realtime` — un mensaje nuevo llega solo, sin recargar (`postgres_changes`), igual que el resto de la mesa.

## Modelo de datos
> Pending — DBA Agent will complete this section.
