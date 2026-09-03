-- ============================================================================
-- Rebanada 7 · § 7.2 «La luz que gira (como una sirena)»
-- ============================================================================
-- Petición del dueño del 2026-08-31: un cono que dé vueltas solo, como el faro
-- de un coche de policía, y que todos en la mesa lo vean en la misma posición.
--
-- UNA sola columna, no dos. El plan escrito hablaba de «gira sí/no» + periodo;
-- son dos formas de decir lo mismo y tarde o temprano una miente (girando con
-- periodo 0, o quieta con periodo 4000). `spin_ms = 0` es «no gira», y
-- cualquier valor mayor es lo que tarda una vuelta entera.
--
-- Aditiva y con valor por defecto: ninguna luz ya colocada cambia de aspecto.
-- No crea tablas ni políticas — `maps_lights` ya tiene RLS y su reparto
-- (leen los miembros que ven la escena, escribe sólo el director), que es
-- exactamente el que pide esta columna: girar es cosa del director.
-- ============================================================================

ALTER TABLE public.maps_lights
  ADD COLUMN IF NOT EXISTS spin_ms integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.maps_lights.spin_ms IS
  'Milisegundos que tarda una vuelta entera del cono. 0 = la luz no gira. Sólo tiene sentido con shape = cone.';

-- Nadie debe poder guardar un periodo absurdo: ni negativo, ni tan corto que
-- sea un parpadeo epiléptico, ni tan largo que no se note que gira.
ALTER TABLE public.maps_lights
  ADD CONSTRAINT maps_lights_spin_ms_ck CHECK (spin_ms = 0 OR spin_ms BETWEEN 500 AND 60000);
