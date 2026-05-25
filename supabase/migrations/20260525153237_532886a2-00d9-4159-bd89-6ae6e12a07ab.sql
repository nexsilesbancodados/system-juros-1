
-- 1) Set search_path em funções públicas que ainda não têm
ALTER FUNCTION public.handle_new_user_with_settings() SET search_path = public;

-- 2) Revogar EXECUTE de anon nas funções internas (apenas authenticated)
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_clients_fuzzy(text, real, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_clients_by_document(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_dm_participant(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) FROM anon;

-- Garantir que authenticated pode chamar essas funções
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clients_fuzzy(text, real, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clients_by_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_dm_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) TO authenticated;

-- Portal funções permanecem com EXECUTE para anon (login público por CPF)
-- portal_client_login e get_signup_checkout_url ficam acessíveis a anon de propósito.
