-- ============================================================================
-- Rebanada 7 · § 7.2 «Las luces iluminan de verdad»
-- LA SOMBRA VIENE ENCENDIDA
-- ============================================================================
-- `casts_shadow` nació apagada porque nadie la leía: se guardaba para el día
-- que las luces iluminasen de verdad. Ese día es hoy, y es la columna que
-- decide si una luz se recorta contra los muros.
--
-- Dejarla apagada por defecto habría dejado el arreglo sin efecto: el dueño
-- probó la primera versión y preguntó «las luces no iluminan del otro lado de
-- los muros, ¿correcto?», dando por hecho que NO. Lo normal en una antorcha es
-- proyectar sombra; lo raro —un resplandor mágico que atraviesa la piedra— es
-- lo que merece un interruptor, y el interruptor sigue ahí para eso.
--
-- El relleno alcanza a TODAS las luces ya colocadas, también a las que están en
-- `false`. No pisa ninguna decisión: hasta esta migración la columna no se leía
-- en ningún sitio, así que ese `false` no es la elección de nadie, es el valor
-- por defecto de antes.
-- ============================================================================

ALTER TABLE public.maps_lights ALTER COLUMN casts_shadow SET DEFAULT true;

UPDATE public.maps_lights SET casts_shadow = true WHERE casts_shadow = false;
