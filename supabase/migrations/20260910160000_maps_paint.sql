-- ============================================================================
-- Rebanada 10 (REESCRITA) — LA PINTURA: PINTAR ENCIMA
-- Spec: `specs/modules/maps/SPEC.md` § «Rebanada 10 · A · EL PINCEL».
--
-- Reescrita el 2026-09-10 después de que el dueño viera construida la versión
-- anterior y la parara en pantalla: «lo que has hecho no es un pincel para
-- pintar sobre las habitaciones o muros o fotos que pongas, lo que eso es, es
-- cavar con construir, que no es lo que te pedí».
--
-- ── NINGUNA TABLA NUEVA, NINGUNA POLÍTICA NUEVA, Y ESO NO ES SUERTE ─────────
--
-- «LA PINTURA SE SUMA» (suyo, 2026-09-10: «si tengo la base del piso a cuadros,
-- pinto musgo arriba y pongo otro color arriba de éste, se van sumando»). Eso
-- es LITERALMENTE lo que hace un lienzo de píxeles: cada pasada cae encima de
-- la anterior y el resultado queda cocido. Guardar una fila por pincelada para
-- luego re-apilarlas al abrir el mapa sería reconstruir en cada carga algo que
-- ya viene hecho — y multiplicaría las filas justo donde él ya sufrió el «va
-- lentísimo».
--
-- Así que la pintura es **UN PNG POR COSA PINTADA**, exactamente el mismo
-- patrón —y el mismo bucket, y las mismas políticas— que las máscaras de la
-- rebanada 9. Lo único que cambia es el signo: aquélla QUITA para que asome lo
-- de debajo, ésta PONE encima.
--
-- ── Y AHÍ ES DONDE SE CUMPLE «EL SCOPE ES LA HABITACIÓN» ────────────────────
--
-- Orden suya del 2026-09-10: «si elijo pintar una habitación el scope de ese
-- pincel es la habitación; si se me va la mano al muro, el muro no se tiene que
-- pintar. Lo mismo con el muro». El recorte NO sale de una comprobación que
-- alguien pueda olvidarse de escribir: sale de DÓNDE SE GUARDA. La pintura de
-- una sala vive en la fila de esa sala y se dibuja dentro de su contorno; la de
-- la roca vive en la escena y se dibuja dentro de la roca. Salirse es imposible.
--
-- ── LAS TRES COSAS SOBRE LAS QUE SE PINTA ──────────────────────────────────
--   · una habitación  → `maps_rooms.floor_paint_url`   (por FORMA)
--   · el muro / roca  → `maps_scenes.rock_paint_url`   (por ESCENA)
--   · una foto        → `maps_layers.paint_url`        (por CAPA de terreno)
--
-- La roca va por ESCENA y no por forma a propósito: la roca no es una fila, es
-- «todo lo que no es habitación» — el negativo de las formas excavadas. No hay
-- ninguna fila de muro a la que colgarle un PNG, y tampoco hace falta: la roca
-- no se mueve.
--
-- ⚠️ NADA DE ESTO CAMBIA LA PARTIDA. La pintura no toca por dónde se anda, ni
-- qué se ve, ni la luz — es la línea que separa este pincel del Builder, y por
-- eso ninguna columna de aquí entra en el cálculo de visión ni de colisiones.
-- ============================================================================

-- ── 1 · LA PINTURA DE UNA HABITACIÓN ────────────────────────────────────────
-- Va en la fila de la forma, y no en una tabla aparte, porque **la pintura es
-- de lo que pintaste** (suyo, 2026-09-10: hoy no se puede mover una habitación,
-- «pero debería irse con ella»). Colgada de la fila, el día que una forma se
-- pueda coger y arrastrar la pintura se va con ella sin escribir una línea más.
ALTER TABLE public.maps_rooms
  ADD COLUMN IF NOT EXISTS floor_paint_url text;

COMMENT ON COLUMN public.maps_rooms.floor_paint_url IS
  'La PINTURA de esta forma (rebanada 10): un PNG que se dibuja ENCIMA de su suelo, en backgrounds/{campaign}/paint/room-{id}.png. Se suma en capas y no cambia la partida. NULL = sin pintar. Distinto de floor_mask_url, que QUITA para que asome lo de debajo.';

-- ── 2 · LA PINTURA DE LA ROCA ───────────────────────────────────────────────
-- Por escena: la roca es el negativo de las formas excavadas, no una fila.
ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS rock_paint_url text;

COMMENT ON COLUMN public.maps_scenes.rock_paint_url IS
  'La PINTURA de la roca de este mapa (rebanada 10): un PNG que se dibuja ENCIMA del muro, en backgrounds/{campaign}/paint/rock-{scene}.png, recortado contra la roca. NULL = sin pintar.';

-- ── 3 · LA PINTURA DE UNA FOTO ──────────────────────────────────────────────
-- Una «foto que pongas» es una CAPA DE TERRENO (rebanada 7), que es donde ya
-- viven las fotos del mapa y donde ya pinta el pincel de la rebanada 9.
--
-- Lleva su propio número de versión, y no se apoya en `updated_at`, porque es
-- lo que ya hace la máscara de una capa (`mask_version`): el navegador cachea
-- el PNG por URL, y sin un número que cambie se queda con el de antes y parece
-- que el pincel no pinta. Una SALA no lo necesita porque su `updated_at` se
-- mueve sola y ya rompe la caché — cada tabla sigue la convención que ya tenía.
ALTER TABLE public.maps_layers
  ADD COLUMN IF NOT EXISTS paint_url text;
ALTER TABLE public.maps_layers
  ADD COLUMN IF NOT EXISTS paint_version integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.maps_layers.paint_url IS
  'La PINTURA de esta capa (rebanada 10): un PNG que se dibuja ENCIMA de su foto, en backgrounds/{campaign}/paint/layer-{id}.png. NULL = sin pintar. Distinto de mask_url, que QUITA.';
COMMENT ON COLUMN public.maps_layers.paint_version IS
  'Sube en cada guardado de la pintura: es el rompe-caché del navegador, igual que mask_version.';

-- ── 4 · QUIÉN LEE Y QUIÉN ESCRIBE ───────────────────────────────────────────
-- EXACTAMENTE LOS DE ANTES, y por eso no hay ni una política aquí.
--
-- `maps_rooms`, `maps_scenes` y `maps_layers` ya tienen RLS activa y sus
-- políticas cubren LA FILA ENTERA (rebanadas 7 y 8): escribe el director de la
-- campaña, leen sus miembros. Una columna nueva en una fila ya cubierta está
-- cubierta. Repetir la regla en dos sitios sólo sirve para que un día discrepen.
--
-- Y el PNG vive en el bucket `backgrounds`, que ya existe y ya tiene sus
-- políticas: mismo sitio y mismo trato que las máscaras de la rebanada 9.
--
-- Pintar es cosa de director, como todo lo que toca el dibujo del mapa: este
-- pincel NO añade ningún permiso nuevo al motor de roles.
