
CREATE TABLE IF NOT EXISTS public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  contract_id uuid REFERENCES public.contracts(id) ON DELETE CASCADE,
  installment_id uuid REFERENCES public.contract_installments(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  dedupe_day date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date
);

CREATE INDEX IF NOT EXISTS idx_client_notifications_client
  ON public.client_notifications (client_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_client_notifications_daily
  ON public.client_notifications (installment_id, type, dedupe_day)
  WHERE installment_id IS NOT NULL;

GRANT ALL ON public.client_notifications TO service_role;
ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service role only" ON public.client_notifications
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.portal_client_notifications(_cpf text, _limit int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  _client_id uuid;
  _rows jsonb;
BEGIN
  IF length(_clean) < 11 THEN RETURN '[]'::jsonb; END IF;
  SELECT id INTO _client_id FROM public.clients
   WHERE regexp_replace(coalesce(cpf_cnpj,''), '\D','','g') = _clean
   ORDER BY created_at DESC LIMIT 1;
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

CREATE OR REPLACE FUNCTION public.portal_client_mark_notifications_read(_cpf text, _ids uuid[] DEFAULT NULL)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _clean text := regexp_replace(coalesce(_cpf,''), '\D', '', 'g');
  _client_id uuid; _n int;
BEGIN
  IF length(_clean) < 11 THEN RETURN 0; END IF;
  SELECT id INTO _client_id FROM public.clients
   WHERE regexp_replace(coalesce(cpf_cnpj,''), '\D','','g') = _clean
   ORDER BY created_at DESC LIMIT 1;
  IF _client_id IS NULL THEN RETURN 0; END IF;

  UPDATE public.client_notifications
     SET is_read = true
   WHERE client_id = _client_id AND is_read = false
     AND (_ids IS NULL OR id = ANY(_ids));
  GET DIAGNOSTICS _n = ROW_COUNT;
  RETURN _n;
END; $$;

GRANT EXECUTE ON FUNCTION public.portal_client_notifications(text, int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.portal_client_mark_notifications_read(text, uuid[]) TO anon, authenticated;
