-- ============================================================================
-- Portal do cliente: token de sessão em vez de CPF-como-senha.
--
-- As RPCs portal_client_notifications / portal_client_mark_notifications_read
-- autenticavam SÓ pelo CPF (baixa entropia) e eram chamáveis por anon — qualquer
-- um lia/marcava notificações de terceiros. Aqui:
--  - portal_client_login (que já exige CPF + data de nascimento) passa a emitir
--    um token de sessão aleatório e o retorna junto do dossiê.
--  - Novas RPCs de notificação recebem o TOKEN (segredo inadivinhável) e resolvem
--    o client_id a partir dele (com expiração).
--  - Revoga anon das RPCs antigas por CPF (fecha o vetor de leitura/marcação em massa).
-- Aditivo: nada é removido; o login continua com a mesma assinatura + um campo extra.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.portal_sessions (
  token      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON public.portal_sessions(client_id);
ALTER TABLE public.portal_sessions ENABLE ROW LEVEL SECURITY;
-- Sem policy para anon/authenticated: a tabela só é acessível via as funções
-- SECURITY DEFINER abaixo (que a leem/gravam), nunca por consulta direta.
GRANT ALL ON public.portal_sessions TO service_role;

-- portal_client_login: agora VOLATILE (grava o token) e retorna session_token.
CREATE OR REPLACE FUNCTION public.portal_client_login(_cpf text, _birth_date date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client public.clients%rowtype;
  _contracts jsonb;
  _owner jsonb;
  _branding jsonb;
  _token uuid;
BEGIN
  IF length(_clean_cpf) < 11 OR _birth_date IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _client FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND birth_date = _birth_date
  ORDER BY created_at DESC LIMIT 1;

  IF _client.id IS NULL THEN RETURN NULL; END IF;

  -- Emite um token de sessão (limpa expirados deste cliente antes).
  DELETE FROM public.portal_sessions WHERE client_id = _client.id AND expires_at < now();
  INSERT INTO public.portal_sessions (client_id) VALUES (_client.id) RETURNING token INTO _token;

  SELECT coalesce(jsonb_agg(contract_payload ORDER BY (contract_payload->>'created_at')::timestamptz DESC), '[]'::jsonb)
  INTO _contracts
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'capital', c.capital, 'interest_rate', c.interest_rate,
      'num_installments', c.num_installments, 'installment_amount', c.installment_amount,
      'frequency', c.frequency, 'start_date', c.start_date, 'status', c.status,
      'total_amount', c.total_amount, 'total_interest', c.total_interest,
      'payment_method', c.payment_method, 'created_at', c.created_at,
      'late_fee_percent', c.late_fee_percent,
      'daily_interest_percent', c.daily_interest_percent,
      'installments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id, 'installment_number', i.installment_number, 'amount', i.amount,
          'due_date', i.due_date, 'paid_at', i.paid_at, 'paid_amount', i.paid_amount,
          'late_fee', i.late_fee, 'status', i.status, 'payment_method', i.payment_method,
          'receipt_url', i.receipt_url,
          'late_fee_percent', c.late_fee_percent,
          'daily_interest_percent', c.daily_interest_percent
        ) ORDER BY i.installment_number ASC, i.due_date ASC)
        FROM public.contract_installments i
        WHERE i.contract_id = c.id AND i.client_id = _client.id
      ), '[]'::jsonb)
    ) AS contract_payload
    FROM public.contracts c WHERE c.client_id = _client.id
  ) payload;

  SELECT jsonb_build_object('name', p.name, 'pix_key', p.pix_key, 'pix_key_type', p.pix_key_type)
  INTO _owner FROM public.profiles p WHERE p.id = _client.user_id;

  SELECT jsonb_build_object(
    'portal_title', s.portal_title, 'portal_subtitle', s.portal_subtitle,
    'portal_welcome_message', s.portal_welcome_message, 'portal_primary_color', s.portal_primary_color,
    'portal_contact_phone', s.portal_contact_phone, 'portal_contact_email', s.portal_contact_email,
    'portal_logo_url', s.portal_logo_url, 'company_name', s.company_name, 'company_logo_url', s.company_logo_url
  ) INTO _branding FROM public.settings s WHERE s.user_id = _client.user_id LIMIT 1;

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', _client.id, 'name', _client.name, 'email', _client.email,
      'phone', _client.phone, 'whatsapp', _client.whatsapp,
      'cpf_cnpj', _client.cpf_cnpj, 'status', _client.status, 'birth_date', _client.birth_date
    ),
    'contracts', _contracts,
    'owner', coalesce(_owner, '{}'::jsonb),
    'branding', coalesce(_branding, '{}'::jsonb),
    'session_token', _token
  );
END;
$function$;

-- Notificações por TOKEN (substituem as versões por CPF no frontend).
CREATE OR REPLACE FUNCTION public.portal_notifications_by_token(_token uuid, _limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE _client_id uuid; _rows jsonb;
BEGIN
  SELECT client_id INTO _client_id FROM public.portal_sessions
   WHERE token = _token AND expires_at > now();
  IF _client_id IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT coalesce(jsonb_agg(to_jsonb(n) ORDER BY n.created_at DESC), '[]'::jsonb)
    INTO _rows
  FROM (
    SELECT id, type, title, message, metadata, is_read, created_at, contract_id, installment_id
      FROM public.client_notifications
     WHERE client_id = _client_id
     ORDER BY created_at DESC
     LIMIT greatest(1, least(coalesce(_limit,30), 100))
  ) n;
  RETURN _rows;
END; $$;

CREATE OR REPLACE FUNCTION public.portal_mark_notifications_read_by_token(_token uuid, _ids uuid[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _client_id uuid; _n int;
BEGIN
  SELECT client_id INTO _client_id FROM public.portal_sessions
   WHERE token = _token AND expires_at > now();
  IF _client_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.client_notifications
     SET is_read = true
   WHERE client_id = _client_id AND is_read = false
     AND (_ids IS NULL OR id = ANY(_ids));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

REVOKE EXECUTE ON FUNCTION public.portal_notifications_by_token(uuid, int) FROM public;
GRANT  EXECUTE ON FUNCTION public.portal_notifications_by_token(uuid, int) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.portal_mark_notifications_read_by_token(uuid, uuid[]) FROM public;
GRANT  EXECUTE ON FUNCTION public.portal_mark_notifications_read_by_token(uuid, uuid[]) TO anon, authenticated;

-- Fecha o vetor CPF-only: anon não chama mais as RPCs antigas de notificação.
REVOKE EXECUTE ON FUNCTION public.portal_client_notifications(text, int) FROM anon;
REVOKE EXECUTE ON FUNCTION public.portal_client_mark_notifications_read(text, uuid[]) FROM anon;
