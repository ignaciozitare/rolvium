-- ============================================================================
-- LA BARRITA DEL TAMAÑO DE LAS FICHAS, POR ESCENA
-- ============================================================================
-- Encargo suyo del 2026-09-07, salido de un problema real de mesa:
--
--   «*si dibujan pasillos pequeños los tokens no pasarán, no quiero eliminar la
--    colisión de los tokens, quiero saber si podemos reducir el tamaño*»
--   «*el tamaño se configura no por saltos sino con una barrita progresiva…
--    y por escena, no para todo*»
--   «*esto hay que respetarlo en tamaños… que se mantenga la relación de
--    diminuto pequeño normal grande y enorme*»
--
-- Una ficha NORMAL ocupa hoy 1,5 casillas, así que no cabe por un pasillo de
-- una. A 2/3 de escala ocupa 1 casilla justa y pasa. Un GRANDE sigue sin pasar,
-- y así debe ser.
--
-- ── POR QUÉ ESTO NO CONTRADICE EL MANUAL ────────────────────────────────────
-- El libro (p.25) da ESTATURAS, no huellas en casillas. El paso a casillas y el
-- aumento de legibilidad del 33% que fija el normal en 1,5 son NUESTROS, y ya
-- están marcados como «⚠ interpretación» en RULES.md §1.6. Lo que SÍ es del
-- libro son las PROPORCIONES entre los cinco tamaños, y esta barrita las
-- conserva intactas porque es UN SOLO multiplicador para todos. Mover un
-- multiplicador nuestro es legítimo; cambiar la relación entre tamaños no lo
-- sería (regla suya: «con respecto a las reglas el manual manda»).
--
-- ── POR QUÉ VA EN LA ESCENA Y NO EN CADA FICHA ──────────────────────────────
-- Ésta es LA decisión de modelo, y la alternativa era peor de dos maneras.
-- `maps_tokens.size` guarda el tamaño en casillas de cada ficha, congelado al
-- colocarla, y el dueño pidió que la barrita afecte también a las que ya están
-- puestas («*en todas*»). Aplicarlo reescribiendo `size` significaría:
--   · una escritura MASIVA —una fila por ficha— cada vez que roza la barrita, y
--   · perder para siempre el tamaño original de cada ficha, así que volver
--     atrás sería imposible y arrastrar la barrita degradaría los datos.
-- Se guarda SÓLO el multiplicador aquí y se aplica al pintar y al calcular la
-- colisión. `maps_tokens.size` se queda exactamente como está: sigue siendo el
-- tamaño que dice la ficha del personaje, y la escena es una lente encima.
--
-- ── EL RECORRIDO ────────────────────────────────────────────────────────────
-- De 0,5 a 1,25, arrancando en 1. Cerrado con él mirando la tabla:
--
--   Tamaño   | Mitad | 2/3  | Centro (hoy) | Un cuarto más
--   Diminuto | 0,25  | 0,33 | 0,5          | 0,63
--   Pequeño  | 0,38  | 0,5  | 0,75         | 0,94
--   Normal   | 0,75  | 1    | 1,5          | 1,88
--   Grande   | 1,75  | 2,34 | 3,5          | 4,38
--   Enorme   | 3,5   | 4,69 | 7            | 8,75
--
-- DEFECTO 1: ninguna escena que ya existe cambia de aspecto por esta migración.
-- Nadie nota nada hasta que toca la barrita, que es la única forma honesta de
-- meter un ajuste global en escenas que ya están montadas.
--
-- ── RLS ─────────────────────────────────────────────────────────────────────
-- No hay tabla nueva: es una COLUMNA en `maps_scenes`, que ya tiene RLS activo
-- y sus políticas desde `20260818130000_maps.sql`. Una columna hereda las
-- políticas de su tabla, así que no hay nada que abrir ni que cerrar aquí. Que
-- sólo el director pueda MOVER la barrita ya lo garantiza la política de
-- escritura de `maps_scenes` — no se re-implementa el permiso en la columna.
--
-- LO QUE ESTA MIGRACIÓN **NO** TOCA:
--   · `maps_tokens.size` — ni una fila. Ver arriba.
--   · La tabla `TOKEN_CELLS` del sistema: de dónde sale el tamaño de cada
--     personaje no cambia, sigue saliendo de su ficha.
--   · Nada de la colisión: el cuerpo encoge, las reglas de choque no cambian.
-- ============================================================================

ALTER TABLE public.maps_scenes
  ADD COLUMN IF NOT EXISTS token_scale real NOT NULL DEFAULT 1;

-- El CHECK va aparte y con DROP delante para que la migración se pueda volver a
-- pasar sobre una base que ya la tiene, que es como se hacen aquí los rangos
-- (ver `night_radius_m` y `door_color`).
ALTER TABLE public.maps_scenes DROP CONSTRAINT IF EXISTS maps_scenes_token_scale_check;
ALTER TABLE public.maps_scenes
  ADD CONSTRAINT maps_scenes_token_scale_check
  CHECK (token_scale >= 0.5 AND token_scale <= 1.25);

COMMENT ON COLUMN public.maps_scenes.token_scale IS
  'Multiplicador del tamano de TODAS las fichas de esta escena (0,5 a 1,25; 1 = como siempre). Multiplica por igual a los cinco tamanos, asi que la proporcion del manual no cambia. No reescribe maps_tokens.size: se aplica al pintar y al calcular colision.';

-- ── Y QUE LA API SE ENTERE ──────────────────────────────────────────────────
-- PostgREST guarda el esquema EN CACHÉ al arrancar: sin este aviso la columna
-- recién añadida no existe para él y las consultas que la nombran fallan
-- enteras, dejando la pantalla vacía sin decir por qué.
NOTIFY pgrst, 'reload schema';
