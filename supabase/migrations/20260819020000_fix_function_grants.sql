-- ============================================================================
-- Rolvium — corrección de `20260819010000_harden_functions.sql`
-- ============================================================================
-- Aquella migración trató como «funciones de trigger» a dos que no lo son y
-- dejó a medias el revoke de los helpers. Se corrige aquí (y no editando el
-- fichero anterior) porque ya está aplicada en la base hosted: reescribir una
-- migración aplicada no la vuelve a ejecutar allí.
--
--   1. `campaigns_new_code()` NO es un trigger: es el DEFAULT de
--      `campaigns_campaigns.invite_code`. PostgreSQL evalúa los DEFAULT con los
--      privilegios de quien inserta, así que quitarle el EXECUTE a
--      `authenticated` rompe la creación de campañas desde el cliente:
--        ERROR: permission denied for function campaigns_new_code
--      Se le devuelve el EXECUTE a `authenticated` y `service_role` (a `anon`
--      y a PUBLIC no: siguen sin poder llamarla como RPC).
--
--   2. `is_admin()` / `has_permission()` / `has_module()` / `current_role_name()`
--      seguían siendo ejecutables por cualquiera: `REVOKE … FROM anon` sólo
--      quita la concesión explícita a `anon`, no la que PostgreSQL da a PUBLIC
--      por defecto. Hay que revocar de PUBLIC. `authenticated` y `service_role`
--      conservan su GRANT explícito (20260817000000), que es lo que usan las
--      políticas RLS al evaluarse — todas ellas son `TO authenticated`.
--
--   3. `roles_guard_system()` es de trigger y se quedó fuera de la lista.
-- ============================================================================
BEGIN;

-- ── 1. el DEFAULT de invite_code vuelve a ser ejecutable por el que inserta ──
GRANT EXECUTE ON FUNCTION public.campaigns_new_code() TO authenticated, service_role;

-- ── 2. helpers de permisos: revocar de PUBLIC, que es donde estaba el agujero ─
REVOKE EXECUTE ON FUNCTION public.is_admin()           FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_module(text)     FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_role_name()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(), public.has_permission(text),
                          public.has_module(text), public.current_role_name()
  TO authenticated, service_role;

-- ── 3. el trigger que faltaba ───────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.roles_guard_system() FROM PUBLIC, anon, authenticated;

COMMIT;
