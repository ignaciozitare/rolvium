-- ============================================================================
-- Rebanada 7 · § 7.2 «Intensidad por luz»
-- ============================================================================
-- Petición del dueño del 2026-09-01: «cada una además del alcance color etc
-- necesita una barra de intensidad».
--
-- Separa dos cosas que hasta hoy iban juntas: CUÁNTO ILUMINA (`range_m`, que ya
-- existe y sí cambia lo que se ve) y CUÁNTO CANTA (esto, que es sólo pintura).
-- Antes, la única forma de que una luz cantase menos era hacerla más pequeña,
-- que no es lo mismo: una vela tenue sigue alumbrando su rincón entero.
--
-- 🔒 NO cambia lo que nadie ve. Decisión suya del 2026-09-01, elegida sobre la
-- alternativa: una luz al 10 % revela exactamente el mismo terreno que al 100 %.
-- Por eso esta columna NO la lee la api: el cálculo de visión y de sombras
-- (`sceneVision.ts`) no la necesita y no la pide. Vive sólo en lo que se pinta.
--
-- Aditiva y con valor por defecto 100 = exactamente como se pintan hoy, así que
-- ninguna luz ya colocada cambia de aspecto. Es la misma jugada que salió bien
-- con `range_m` y `casts_shadow`: al llegar el día no hubo que repasar ninguna.
--
-- No crea tablas ni políticas — `maps_lights` ya tiene RLS y su reparto (leen
-- los miembros que ven la escena, escribe sólo el director), que es exactamente
-- el que pide esta columna: regular una luz es cosa del director.
-- ============================================================================

ALTER TABLE public.maps_lights
  ADD COLUMN IF NOT EXISTS intensity integer NOT NULL DEFAULT 100;

COMMENT ON COLUMN public.maps_lights.intensity IS
  'Fuerza con la que se PINTA la luz, en porcentaje. 100 = como se pintaba antes de que existiera esta columna. No afecta a la visión ni a la niebla: no la lee la api.';

-- El suelo no es 0 a propósito: una luz invisible es una luz que crees haber
-- borrado y no lo está — para eso está la papelera. El techo es 200 y no 100
-- (dueño, 2026-09-02: «la escala de luminosidad queda corta, el máximo tendría
-- que ser más brillante»): 100 sigue siendo «como se pintaba antes de que esto
-- existiera» —eso no se mueve, o cambiarían de aspecto todas sus luces ya
-- puestas— y lo que se abre es el margen por arriba.
--
-- Envuelto para que reaplicarla no reviente: `ADD COLUMN` ya lleva su
-- `IF NOT EXISTS`, pero `ADD CONSTRAINT` no tiene equivalente y en producción las
-- versiones de las migraciones no coinciden con los nombres de fichero del repo,
-- así que esta puede pasar dos veces.
DO $$
BEGIN
  ALTER TABLE public.maps_lights
    ADD CONSTRAINT maps_lights_intensity_ck CHECK (intensity BETWEEN 10 AND 200);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
