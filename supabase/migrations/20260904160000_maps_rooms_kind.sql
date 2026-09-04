-- ============================================================================
-- Rebanada 8 · LOS MUROS SON RELLENO
-- ============================================================================
-- Petición suya del 2026-09-04, probando el constructor:
--
--   «*así como genero habitaciones necesito generar muros para corregir o lo
--    que sea. Hoy tomamos como que las habitaciones son huecos en el muro,
--    entonces los muros serán relleno de esos huecos*»
--
-- 🔑 Es la idea de la rebanada llevada hasta el final, y por eso NO hace falta
-- ni una tabla nueva ni una segunda física: la roca lo cubre todo, una SALA le
-- quita un trozo y un MURO se lo devuelve. La misma forma con el signo cambiado.
--
-- De ahí que sea UNA COLUMNA y no una tabla:
--   · `kind = 'room'` → excava. Es lo que había hasta hoy.
--   · `kind = 'fill'` → rellena. Un tabique, un pilar, corregir un borde.
--
-- Y todo lo demás sale gratis, porque ya estaba resuelto para las salas: se
-- dibujan con las mismas seis formas, se pegan a la misma rejilla, entran en el
-- mismo deshacer, y el contorno —que es el muro que se ve y el que tapa— lo
-- calcula el mismo `roomOutline` de `@rolvium/core`, ahora con dos listas.
--
-- POR QUÉ `room` POR DEFECTO: es lo que son todas las filas que ya existen. La
-- columna es aditiva y ninguna sala levantada cambia de aspecto.
--
-- LO QUE ESTA MIGRACIÓN **NO** TOCA:
--   · `maps_walls`. Sigue intacta, y sigue siendo el modo de marcar sobre una
--     foto. Un muro de relleno NO es una fila suya: es una forma más de esta
--     tabla, y su contorno se calcula.
--   · `floor_preset` / `floor_url` de un relleno se ignoran al pintar (un muro
--     no tiene suelo), pero se quedan en la fila: la columna es la misma y
--     partirla en dos tablas por eso sería peor.
-- ============================================================================

ALTER TABLE public.maps_rooms
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'room'
    CHECK (kind IN ('room', 'fill'));

COMMENT ON COLUMN public.maps_rooms.kind IS
  'room = excava un hueco en la roca (una habitacion). fill = devuelve roca al hueco (un muro, un pilar, una correccion).';

-- Pintar la escena pide las dos clases a la vez y en orden de llegada, así que
-- el índice que ya existe (scene_id, created_at) sigue sirviendo tal cual: no
-- hay ninguna consulta que filtre sólo por `kind`.

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
-- PostgREST guarda el esquema EN CACHÉ al arrancar. Sin este aviso, una columna
-- recién añadida no existe para él: las consultas que la nombran fallan enteras
-- y la pantalla se queda vacía sin decir por qué. Pasó de verdad el 2026-09-04
-- —«no funciona hacer rectángulos de salas, no sé si los has metido en otra
-- capa»— y costó un rato encontrarlo porque la base estaba perfecta.
NOTIFY pgrst, 'reload schema';
