-- ─────────────────────────────────────────────────────────────────────────────
-- Las dos funciones de TRIGGER de adventures, cerradas como las de chat (`20260915231500_chat_susurros_harden`)
--
-- Al aplicar las migraciones de adventures a producción (2026-09-22) los asesores de Supabase avisaron de que
-- `adventures_seed_for_campaign()` y `maps_scenes_default_adventure()` —SECURITY DEFINER— quedaban
-- ejecutables por `anon` y `authenticated` como RPC. Sin riesgo real (una función que devuelve `trigger` no se
-- puede llamar a mano: Postgres la rechaza), pero la costumbre de este repo es cerrarlas, y el aviso se queda
-- mirando. Un trigger no necesita el permiso EXECUTE de nadie para dispararse: se comprobó al crearlo.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.adventures_seed_for_campaign()   FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.maps_scenes_default_adventure() FROM PUBLIC, anon, authenticated;
