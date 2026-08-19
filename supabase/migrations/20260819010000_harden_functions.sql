-- ============================================================================
-- Rolvium — endurecido de funciones (hallazgo de `get_advisors` al pasar a hosted)
-- ============================================================================
-- Dos avisos, ninguno crítico, pero los dos reales ahora que la base está en
-- internet y el repo es público:
--
--   1. `function_search_path_mutable` — cinco funciones SECURITY DEFINER se
--      quedaron sin `SET search_path`. Sin él, quien pueda crear objetos en un
--      esquema que esté antes en el search_path del llamante puede secuestrar
--      un nombre sin cualificar dentro de la función.
--   2. `*_security_definer_function_executable` — las funciones de TRIGGER
--      quedan expuestas como RPC en `/rest/v1/rpc/...` porque PostgREST publica
--      todo lo ejecutable del esquema `public`. Llamarlas fuera de un trigger
--      falla, pero no tienen por qué estar ahí: se les quita el EXECUTE.
--
-- Los helpers que SÍ son para llamar (`is_admin`, `has_permission`, los RPC de
-- campañas, identidad, dados y mesa) se quedan como están: son la API.
-- ============================================================================
BEGIN;

-- ── 1. search_path fijo en las que faltaban ─────────────────────────────────
ALTER FUNCTION public.campaigns_new_code()            SET search_path = public;
ALTER FUNCTION public.campaigns_guard_update()        SET search_path = public;
ALTER FUNCTION public.campaigns_members_guard()       SET search_path = public;
ALTER FUNCTION public.characters_audit_origin()       SET search_path = public;
ALTER FUNCTION public.dice_rolls_immutable()          SET search_path = public;

-- ── 2. las funciones de trigger no son API ──────────────────────────────────
-- `handle_new_auth_user` la invoca el trigger de auth.users como propietaria;
-- las demás corren dentro de su tabla. Ninguna se llama desde el cliente.
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.campaigns_after_insert()',
    'public.campaigns_new_code()',
    'public.campaigns_guard_update()',
    'public.campaigns_members_guard()',
    'public.characters_guard_update()',
    'public.characters_write_audit()',
    'public.characters_audit_origin()',
    'public.dice_rolls_immutable()',
    'public.handle_new_auth_user()',
    'public.maps_tokens_guard_update()',
    'public.users_guard_self_update()',
    'public.touch_updated_at()'
  ] LOOP
    BEGIN
      EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
    EXCEPTION WHEN undefined_function THEN
      RAISE NOTICE 'no existe, se ignora: %', f;   -- replay-safe entre entornos
    END;
  END LOOP;
END $$;

-- ── 3. los helpers de permisos no hacen falta sin sesión ────────────────────
-- La app exige login (no hay caso de uso anónimo), así que `anon` no necesita
-- poder preguntar por roles ni permisos. `authenticated` los conserva: los usan
-- las políticas RLS al evaluarse como el usuario.
REVOKE EXECUTE ON FUNCTION public.is_admin()                 FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_permission(text)       FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_module(text)           FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_role_name()        FROM anon;

COMMIT;
