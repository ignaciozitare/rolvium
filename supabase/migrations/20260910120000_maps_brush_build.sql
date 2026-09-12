-- ============================================================================
-- Rebanada 10 — EL PINCEL QUE CONSTRUYE (spec `specs/modules/maps/SPEC.md`
-- § «Rebanada 10», confirmada por el dueño el 2026-09-10).
--
-- CASI NADA QUE MIGRAR, Y ÉSA ES LA DECISIÓN DE LA REBANADA. Un brochazo NO es
-- una entidad nueva: es **una forma más de `maps_rooms`**, con su anillo
-- calculado a partir del trazo y del ancho del pincel. De ahí sale gratis todo
-- lo caro, que ya está construido y probado desde la rebanada 8:
--
--   · fundirse al tocarse            → `roomOutline` / `roomWalls` (@rolvium/core)
--   · la visión y las colisiones     → el servidor ya mira estas formas
--   · excavar o rellenar             → `kind = room | fill`, que ES «suelo o muro»
--
-- Modelarlo como una tabla aparte habría obligado a duplicar las tres cosas.
--
-- SIN TABLAS NUEVAS Y SIN POLÍTICAS NUEVAS: `maps_rooms` ya tiene RLS activa y
-- sus políticas (`maps_rooms_select` / `maps_rooms_write`, rebanada 8) cubren la
-- fila entera, luego cubren también estas columnas. Repetir la regla en dos
-- sitios sólo sirve para que un día discrepen.
-- ============================================================================

-- ── 1 · Un brochazo se reconoce como tal ────────────────────────────────────
-- `shape` no decide cómo se pinta —eso lo hace `points`— pero sí dice DE DÓNDE
-- salió la forma, y eso hay que poder saberlo después: un rectángulo arrastrado
-- y un brochazo a mano alzada se editan distinto el día que se puedan coger.
ALTER TABLE public.maps_rooms
  DROP CONSTRAINT IF EXISTS maps_rooms_shape_check;
ALTER TABLE public.maps_rooms
  ADD CONSTRAINT maps_rooms_shape_check
  CHECK (shape IN ('rect', 'circle', 'poly', 'free', 'brush'));

-- ── 2 · Cada forma se pinta con LO SUYO ─────────────────────────────────────
-- Hasta hoy una forma podía traer su propia FOTO (`floor_url`) pero no su
-- propio COLOR: el color salía del preajuste, que es una paleta cerrada de
-- nueve. Él pidió las dos cosas y con paleta abierta — «*también quiero poder
-- elegir colores para pintar, pero ahí tiene que haber una paleta base y un
-- color picker*» (2026-09-10).
--
-- Sin CHECK de formato, igual que `door_color` y `bg_color`: el cuentagotas
-- devuelve lo que devuelve el navegador y un patrón aquí sólo serviría para
-- rechazar un color válido escrito de otra forma.
ALTER TABLE public.maps_rooms
  ADD COLUMN IF NOT EXISTS floor_color text;

-- ── 3 · Qué manda sobre qué, dicho donde vive el dato ───────────────────────
-- El orden es el mismo que ya rige en las puertas (`door_texture_url` manda
-- sobre `door_color`): la foto gana al color, y el color gana al preajuste. Así
-- quitar una textura NO deja la forma en blanco: descubre el color que había
-- debajo, y quitar también el color la devuelve a su preajuste.
COMMENT ON COLUMN public.maps_rooms.floor_url IS
  'La FOTO de esta forma, url del catalogo maps_textures. En una forma que EXCAVA es su suelo; en una que RELLENA es su roca. NULL = la de la escena. Manda sobre floor_color.';
COMMENT ON COLUMN public.maps_rooms.floor_color IS
  'El COLOR de esta forma cuando no trae foto (rebanada 10). En una que EXCAVA es su suelo; en una que RELLENA es su roca. NULL = manda el preajuste floor_preset.';
COMMENT ON COLUMN public.maps_rooms.shape IS
  'De donde salio la forma: rect, circle, poly, free (contorno a mano alzada) o brush (un brochazo del pincel, rebanada 10).';
