-- ============================================================================
-- SUSURROS (H8) — endurecido de las dos funciones de TRIGGER de chat_messages.
-- Mismo criterio que 20260819010000_harden_functions.sql; hallazgo de
-- `get_advisors` nada más aplicar `chat_susurros` en hosted (2026-09-15):
--   · `chat_messages_immutable` iba sin `SET search_path` (function_search_path_mutable);
--   · `chat_messages_set_campaign` quedaba expuesta como RPC a `anon`
--     (anon_security_definer_function_executable). Las funciones de trigger no son API:
--     corren dentro de su tabla, nadie las llama desde el cliente.
-- ============================================================================
ALTER FUNCTION public.chat_messages_immutable()    SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.chat_messages_set_campaign() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.chat_messages_immutable()    FROM PUBLIC, anon, authenticated;
