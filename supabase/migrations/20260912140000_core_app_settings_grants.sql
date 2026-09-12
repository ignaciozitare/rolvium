-- ============================================================================
-- 🐞 `app_settings` SIN PERMISOS DE ACCESO (2026-09-12, lo vio él probando la
-- barra: «no quedan las herramientas donde las suelto»).
--
-- La migración `20260912100000_core_app_settings.sql` creó la tabla con su RLS
-- y sus políticas, pero SIN `GRANT`. En este proyecto los privilegios por
-- defecto de `public` están recortados a propósito (`anon`, `authenticated` y
-- `service_role` sólo heredan TRUNCATE/REFERENCES/TRIGGER), así que cada tabla
-- nueva tiene que dar los suyos a mano — como hacen todas las demás
-- (`20260818130000_maps.sql` § GRANT). Sin ellos PostgREST contesta
-- «permission denied» ANTES de mirar la RLS: leer devolvía error (la barra
-- salía de serie) y guardar fallaba (la barra volvía a como estaba).
--
-- Los permisos de fila siguen siendo los de la RLS: leen todos los que tienen
-- sesión, escribe `has_permission('manage_settings')`. Nada para `anon`.
-- ============================================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.app_settings TO service_role;

NOTIFY pgrst, 'reload schema';
