
-- 1) Storage: restringe listagem do bucket público "uploads"
DROP POLICY IF EXISTS "Anyone can view uploads" ON storage.objects;

CREATE POLICY "Owners can list own uploads"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'uploads'
  AND (auth.uid())::text = (storage.foldername(name))[1]
);

-- 2) Revoga EXECUTE em funções SECURITY DEFINER de anon/authenticated
REVOKE EXECUTE ON FUNCTION public.handle_new_user_trial() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_ticket_on_message() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.touch_dm_thread() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_installment_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_with_settings() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_channel_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_dm_participant(uuid, uuid) FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.portal_client_login(text, date) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_signup_checkout_url() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_clients_fuzzy(text, real, integer) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.search_clients_by_document(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) FROM PUBLIC, anon, authenticated;

-- 3) Re-concede apenas onde necessário
-- Portal do cliente e checkout devem ser acessíveis sem login
GRANT EXECUTE ON FUNCTION public.portal_client_login(text, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_signup_checkout_url() TO anon, authenticated;

-- Funções usadas apenas pela app autenticada
GRANT EXECUTE ON FUNCTION public.search_clients_fuzzy(text, real, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clients_by_document(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_dm_thread(uuid) TO authenticated;
