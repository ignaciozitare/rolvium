-- ============================================================================
-- Rebanada 8 · LAS TEXTURAS SE REPITEN Y SE ESCALAN
-- ============================================================================
-- Petición suya del 2026-09-04, probando el constructor recién hecho:
--
--   «*necesito que la textura se pueda escalar y tener un previo de cómo iría
--    quedando cuando la escale, porque por ejemplo tengo una textura de
--    mosaicos que quedan muy grandes por lo que necesito escalar la textura*»
--
-- 🐞 LO QUE ESTABA MAL, Y NO ERA UN AJUSTE QUE FALTABA: la textura se pintaba
-- como UNA SOLA COPIA ESTIRADA de borde a borde del mapa. Con una foto de
-- fondo eso es lo correcto —es lo que hace `bg_transform` desde la rebanada 1—,
-- pero una textura NO es una foto: es un azulejo que se repite. Estirada, un
-- mosaico de 40 px sale del tamaño del mapa entero, que es exactamente lo que
-- él vio.
--
-- Así que la textura pasa a REPETIRSE, y lo que se guarda es CUÁNTO MIDE UN
-- AZULEJO. En CASILLAS, no en píxeles, por lo mismo que el grosor del muro: un
-- suelo de «dos casillas por azulejo» se ve igual con la rejilla en 15 que en
-- 60, y no cambia al acercar o alejar. Es además la unidad en la que él piensa
-- («esto es del tamaño de media casilla»).
--
-- UNA ESCALA POR TEXTURA, no una compartida: la roca y el suelo son dos fotos
-- distintas, con dos tramas distintas, y no hay motivo para atarlas.
--
-- POR DEFECTO 4 CASILLAS: un azulejo grande, que es lo que menos sorprende al
-- subir una foto cualquiera. Ninguna escena existente cambia de aspecto por
-- esto, porque ninguna tiene todavía una textura puesta.
--
-- LO QUE ESTA MIGRACIÓN **NO** TOCA:
--   · `bg_image_url` / `bg_transform` de la escena y las fotos de las capas de
--     terreno. Ésas SÍ son fotos y se siguen encajando con Cubrir / Encajar /
--     Reposicionar, que es lo correcto para ellas. Aquí no se cambia nada.
--   · `maps_rooms.floor_url`. La columna se queda para cuando llegue el pincel
--     de repintar el suelo de UNA sala (la tanda siguiente).
-- ============================================================================

ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS wall_texture_scale  real NOT NULL DEFAULT 4
    CHECK (wall_texture_scale > 0 AND wall_texture_scale <= 40),
  ADD COLUMN IF NOT EXISTS floor_texture_scale real NOT NULL DEFAULT 4
    CHECK (floor_texture_scale > 0 AND floor_texture_scale <= 40);

COMMENT ON COLUMN public.maps_scenes.wall_texture_scale IS
  'Cuanto mide UN AZULEJO de la textura de pared, EN CASILLAS (no en px): la textura se repite, no se estira.';
COMMENT ON COLUMN public.maps_scenes.floor_texture_scale IS
  'Cuanto mide UN AZULEJO de la textura de suelo, EN CASILLAS (no en px): la textura se repite, no se estira.';

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
-- PostgREST guarda el esquema EN CACHÉ al arrancar. Sin este aviso, una columna
-- recién añadida no existe para él: las consultas que la nombran fallan enteras
-- y la pantalla se queda vacía sin decir por qué. Pasó de verdad el 2026-09-04
-- —«no funciona hacer rectángulos de salas, no sé si los has metido en otra
-- capa»— y costó un rato encontrarlo porque la base estaba perfecta.
NOTIFY pgrst, 'reload schema';
