-- ============================================================================
-- Hardening de banco (achados MÉDIOS/BAIXOS da auditoria). Não toca em dados.
-- Todas as leituras públicas legítimas do portal já passam por funções
-- SECURITY DEFINER (portal_client_login, portal_lookup_creditor_contact, etc.),
-- que rodam como owner e NÃO dependem dos grants/policies abaixo. Por isso
-- remover o acesso direto de `anon` é seguro e não quebra o portal.
-- ============================================================================

-- M-2: a view public_profiles (security_invoker=false) expunha nome + is_admin
-- de TODOS os usuários para anon. Não é usada pelo frontend (o app usa o RPC
-- list_public_profiles). Revoga o acesso anônimo — só se a view existir.
DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NOT NULL THEN
    EXECUTE 'REVOKE SELECT ON public.public_profiles FROM anon';
  END IF;
END $$;

-- M-3: `settings` guarda whatsapp_api_key/hubla_webhook_token e `profiles` guarda
-- PII + pix_key. O grant de SELECT para anon era uma defesa frágil (bastava uma
-- policy permissiva futura para vazar tudo). Anon não precisa ler essas tabelas
-- diretamente — remove o grant.
REVOKE SELECT ON public.settings FROM anon;
REVOKE SELECT ON public.profiles FROM anon;

-- L-2: is_admin(uuid) exposto a anon permitia sondar se um id é admin. Só faz
-- sentido para usuários autenticados (usado dentro das policies).
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM anon;

-- M-4: a policy de UPDATE anônimo em storage.objects permitia que QUALQUER anon
-- sobrescrevesse o comprovante de QUALQUER tenant (só checava a subpasta, sem
-- vincular ao dono). Os uploads legítimos do portal passam por edge functions
-- (service_role), então remover o UPDATE anônimo fecha o vetor de sobrescrita
-- sem afetar o fluxo real. O INSERT anônimo (upload novo) é mantido.
DROP POLICY IF EXISTS "uploads_anon_update_comprovantes" ON storage.objects;
