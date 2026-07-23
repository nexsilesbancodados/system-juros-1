-- ============================================================================
-- Segurança (P1) — Corrige o escalonamento de privilégio via UPDATE em profiles.
--
-- A policy "No self privilege escalation on profiles" foi criada para impedir que
-- um usuário altere o próprio is_admin / is_blocked / assinatura. Porém ela estava
-- como PERMISSIVE, e no Postgres policies permissivas se combinam por OR. Como
-- existe também a policy permissiva "Users can update own profile"
-- (WITH CHECK = auth.uid() = id), qualquer UPDATE na própria linha era aprovado
-- por essa segunda policy, ANULANDO a trava. Resultado: qualquer usuário
-- autenticado podia fazer  UPDATE profiles SET is_admin = true WHERE id = auth.uid()
-- e virar admin (is_admin() lê profiles.is_admin), ganhando acesso ao painel admin,
-- leitura/escrita de todos os profiles e assinatura grátis (policy admin em subscriptions).
--
-- A correção recria a MESMA regra como RESTRICTIVE. Policies restritivas se combinam
-- por AND, então a trava passa a valer SEMPRE, independentemente das permissivas.
-- Não toca em nenhum dado e não afeta edições legítimas de perfil (nome, avatar,
-- pix_key, configs de portal etc.), pois só bloqueia a mudança das colunas sensíveis
-- por quem não é admin. O service_role (webhooks/cron) ignora RLS e não é afetado.
-- ============================================================================

DROP POLICY IF EXISTS "No self privilege escalation on profiles" ON public.profiles;

CREATE POLICY "No self privilege escalation on profiles"
  ON public.profiles
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (
    is_admin(auth.uid())
    OR (
          (is_admin              IS NOT DISTINCT FROM (SELECT p.is_admin              FROM public.profiles p WHERE p.id = profiles.id))
      AND (is_blocked            IS NOT DISTINCT FROM (SELECT p.is_blocked            FROM public.profiles p WHERE p.id = profiles.id))
      AND (is_chat_blocked       IS NOT DISTINCT FROM (SELECT p.is_chat_blocked       FROM public.profiles p WHERE p.id = profiles.id))
      AND (trial_ends_at         IS NOT DISTINCT FROM (SELECT p.trial_ends_at         FROM public.profiles p WHERE p.id = profiles.id))
      AND (subscription_expires_at IS NOT DISTINCT FROM (SELECT p.subscription_expires_at FROM public.profiles p WHERE p.id = profiles.id))
      AND (subscription_type     IS NOT DISTINCT FROM (SELECT p.subscription_type     FROM public.profiles p WHERE p.id = profiles.id))
    )
  );
