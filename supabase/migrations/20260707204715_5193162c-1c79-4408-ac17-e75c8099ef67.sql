
-- 1) Remove a função de login por senha fixa ("123456"). Era um backdoor
--    trivial de bypass do CPF e não deve permanecer no schema exposto.
DROP FUNCTION IF EXISTS public.portal_client_login_password(text, text);

-- 2) Restringe execução das funções restantes do portal.
--    - Revoga o EXECUTE do PUBLIC (default do Postgres) para que nenhum
--      papel implícito possa chamá-las.
--    - Concede EXECUTE apenas para anon (portal público) e authenticated.
--    Cada função continua sendo SECURITY DEFINER com search_path fixo e
--    já filtra por client_id derivado do CPF informado, então não expõe
--    dados de outro cliente.

REVOKE EXECUTE ON FUNCTION public.portal_client_login_cpf(text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.portal_client_login_cpf(text) TO anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.portal_client_login(text, date) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.portal_client_login(text, date) TO anon, authenticated;

-- 3) Blindagem extra: nenhuma função do portal deve poder ser chamada
--    pelo service_role a partir do frontend (o front nunca deve ter essa
--    chave). Mantemos o grant só para os papéis realmente esperados.
REVOKE EXECUTE ON FUNCTION public.portal_client_login_cpf(text) FROM service_role;
REVOKE EXECUTE ON FUNCTION public.portal_client_login(text, date) FROM service_role;
GRANT  EXECUTE ON FUNCTION public.portal_client_login_cpf(text) TO service_role;
GRANT  EXECUTE ON FUNCTION public.portal_client_login(text, date) TO service_role;
