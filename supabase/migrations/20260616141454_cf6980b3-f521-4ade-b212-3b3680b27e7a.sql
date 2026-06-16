-- ════════════════════════════════════════════════════════════════
-- 1) PAYWALL BYPASS FIX
--    Estende a trigger para impedir que usuários comuns alterem
--    trial_ends_at e subscription_expires_at no próprio profile.
--    Apenas admin (via DB direto) ou o webhook do Hubla (service_role
--    bypassa triggers SECURITY DEFINER? Não — service_role bypassa RLS
--    mas NÃO triggers. Por isso o webhook deve passar pela função
--    SECURITY DEFINER ou rodar como superuser — Supabase webhook usa
--    service_role e dispara triggers, então liberamos service_role).
-- ════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.protect_profile_admin_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_service_role boolean := (current_setting('request.jwt.claims', true)::jsonb->>'role') = 'service_role';
BEGIN
  -- service_role (webhooks do Hubla, edge functions admin) pode tudo
  IF _is_service_role THEN
    RETURN NEW;
  END IF;

  -- Caller não admin: força manter colunas sensíveis intactas
  IF NOT public.is_admin(auth.uid()) THEN
    NEW.is_admin := OLD.is_admin;
    NEW.is_blocked := COALESCE(OLD.is_blocked, false);
    NEW.is_chat_blocked := COALESCE(OLD.is_chat_blocked, false);
    -- Bloqueio de bypass de assinatura
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.subscription_expires_at := OLD.subscription_expires_at;
    NEW.subscription_type := OLD.subscription_type;
  END IF;
  RETURN NEW;
END;
$$;

-- Garante que a trigger existe
DROP TRIGGER IF EXISTS trg_protect_profile_admin_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_admin_columns
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.protect_profile_admin_columns();

-- Reset do usuário que burlou o paywall (datas 2099)
UPDATE public.profiles
SET trial_ends_at = NULL,
    subscription_expires_at = NULL
WHERE (trial_ends_at > now() + interval '5 years'
   OR  subscription_expires_at > now() + interval '5 years')
  AND is_admin = false;


-- ════════════════════════════════════════════════════════════════
-- 2) FIX: is_admin não pode mais dar admin via email hardcoded
-- ════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(
    (SELECT is_admin = true FROM public.profiles WHERE id = _user_id),
    false
  )
$$;


-- ════════════════════════════════════════════════════════════════
-- 3) FIX: chat_channel_members SELECT só vê linhas que o usuário
--    tem direito (própria linha, ou linhas de canais dos quais
--    ele faz parte; admin vê tudo)
-- ════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view channel memberships" ON public.chat_channel_members;
DROP POLICY IF EXISTS "Anyone authenticated can view memberships" ON public.chat_channel_members;
DROP POLICY IF EXISTS "select_all_members" ON public.chat_channel_members;

CREATE POLICY "chat_channel_members_select_scoped"
ON public.chat_channel_members
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_admin(auth.uid())
  OR public.is_channel_member(channel_id, auth.uid())
);


-- ════════════════════════════════════════════════════════════════
-- 4) FIX: RLS em realtime.messages
--    O app usa postgres_changes (que já respeita RLS das tabelas-fonte
--    per-tenant). Restringimos a authenticated only para bloquear
--    qualquer subscrição anônima de tópicos sensíveis.
-- ════════════════════════════════════════════════════════════════
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_realtime_read" ON realtime.messages;
CREATE POLICY "authenticated_realtime_read"
ON realtime.messages
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_realtime_write" ON realtime.messages;
CREATE POLICY "authenticated_realtime_write"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (true);