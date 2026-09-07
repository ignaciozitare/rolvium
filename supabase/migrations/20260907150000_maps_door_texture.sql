-- ============================================================================
-- LA PUERTA TAMBIÉN LLEVA TEXTURA
-- ============================================================================
-- Suyo, 2026-09-07, probando las puertas recién hechas en la app: «*cuando le doy
-- color se tiene que rellenar de ese color, no está la textura*» · «*te falta lo
-- de la textura*». Ya venía en el encargo del día («*si a la puerta se le puede
-- poner un color o textura mejor*») y el spec lo había dejado para después; lo
-- ha reclamado con la pantalla delante, así que entra ahora.
--
-- 🔑 MISMO REPARTO QUE EL COLOR, y por eso son columnas hermanas: una para toda
-- la ESCENA y una por PUERTA que la desmiente. Es lo que él eligió para el color
-- («por defecto todas iguales, y si una es especial se le cambia a ésa sola») y
-- no hay motivo para que la textura se comporte distinto.
--
-- 🔑 Y ES UNA URL DEL CATÁLOGO (`maps_textures`), no un fichero nuevo: las
-- texturas son DE LA HERRAMIENTA y ya se suben, se nombran y se clasifican en un
-- sitio (rebanada 8). Se guarda la URL y no el id de la fila a propósito, igual
-- que `wall_texture_url` y `floor_texture_url` de la escena: borrar una textura
-- del catálogo no puede dejar media mazmorra sin puertas.
--
-- ORDEN entre las dos: manda la TEXTURA si la hay, y si no el color. Eso vive en
-- el código que pinta, no aquí — una sola regla y en un solo sitio.
--
-- Aditiva y nula por defecto: ninguna puerta de las que ya existen cambia.
-- ============================================================================

ALTER TABLE public.maps_walls          ADD COLUMN IF NOT EXISTS door_texture_url text;
ALTER TABLE public.maps_room_openings  ADD COLUMN IF NOT EXISTS door_texture_url text;
ALTER TABLE public.maps_scenes         ADD COLUMN IF NOT EXISTS door_texture_url text;

COMMENT ON COLUMN public.maps_walls.door_texture_url IS
  'Textura propia de ESTA puerta, url del catalogo maps_textures. NULL = la de la escena. Manda sobre door_color.';
COMMENT ON COLUMN public.maps_room_openings.door_texture_url IS
  'Textura propia de ESTA puerta de sala. NULL = la de la escena. Manda sobre door_color.';
COMMENT ON COLUMN public.maps_scenes.door_texture_url IS
  'Textura por defecto de TODAS las puertas de la escena. NULL = sin textura, manda el color.';

-- Sin politicas nuevas: las tres tablas ya tienen su RLS y su reparto —lee quien
-- puede ver la escena, escribe solo el director—, que es exactamente el que pide
-- una columna que dice como se ve una puerta.

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
