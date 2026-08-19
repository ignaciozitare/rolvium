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
- **Registro** lateral: por tirada autor, título (característica · especialidad), dados propios / de recurso (borde
  oro) vs oposición, marcador, grado de éxito, avisos (revés, +1 Destino…), tiradas libres con total. Adjuntables al chat.
- Recalcular/verificar cualquier tirada (cliente o API) a partir de los dados crudos.

## Rules & limits
- Tirar *como* un personaje: sólo su dueño o el director (un miembro no puede registrar tiradas contra la ficha de otro).
- Inmutables: nadie (ni el DJ) edita/borra; una corrección es una tirada nueva que referencia la anterior.
- Visibilidad: `table` (todos), `dm` (jugador → DJ), `secret` (solo el autor; DJ). Filtrada por RLS.
- Recurso compartido: el descuento y la tirada son la misma transacción (si no hay dados, la tirada falla).
- El motor genérico sabe `NdX`, contar éxitos por predicado, explotar, mayor/menor, sumar; cada sistema aporta la regla.

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
