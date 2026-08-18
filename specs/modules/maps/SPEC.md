# Maps (H7) — SPEC

## Purpose
La escena: un plano de fondo, muros invisibles, niebla por línea de visión, tokens, dibujos compartidos y pin de
enfoque. El director prepara; el grupo juega encima. Who: todos; muchas herramientas son solo del director.

## What the user can do
- **Escenas** (solo DJ): crear, nombrar, activar (**el director decide qué escena ven los jugadores**), subir fondo.
- **Fondo del mapa** (popover, solo DJ): **color de base** (muestras + hex + cuentagotas; se ve donde no llega la
  imagen) y **biblioteca de imágenes** de la campaña (subir, elegir, ninguna) con ajuste Cubrir / Encajar /
  Reposicionar.
- **Barra vertical de herramientas** (izquierda del lienzo): Mover · Medir · Pin | Lápiz · Línea · Caja · Círculo ·
  Borrar; director además (separador oro): Muro · Revelar · Ocultar · **Encuentro** (abre desplegable con buscador y
  todas las entradas del bestiario; clic en el mapa coloca una instancia).
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

## Rules & limits
- El **cálculo de visión ocurre en el servidor** con todos los muros; al jugador le llega el polígono resuelto. Los
  muros con `visible_players=false` no viajan al cliente del jugador (RLS).
- Niebla explorada por jugador y escena; persiste entre sesiones.
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
