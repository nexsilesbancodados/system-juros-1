
-- =========================
-- TABLE: investors
-- =========================
CREATE TABLE public.investors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  cpf_cnpj text,
  email text,
  phone text,
  whatsapp text,
  pix_key text,
  pix_key_type text,
  avatar_url text,
  notes text,
  access_token uuid NOT NULL DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX investors_access_token_key ON public.investors(access_token);
CREATE INDEX investors_user_id_idx ON public.investors(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investors TO authenticated;
GRANT ALL ON public.investors TO service_role;

ALTER TABLE public.investors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their investors"
  ON public.investors FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_investors_updated_at
  BEFORE UPDATE ON public.investors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABLE: investor_loans
-- =========================
CREATE TABLE public.investor_loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  principal numeric(14,2) NOT NULL CHECK (principal > 0),
  interest_rate numeric(6,2) NOT NULL DEFAULT 0,
  total_due numeric(14,2) NOT NULL,
  paid_amount numeric(14,2) NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  due_date date NOT NULL,
  frequency text NOT NULL DEFAULT 'bullet',
  status text NOT NULL DEFAULT 'active',
  payment_method text,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investor_loans_investor_idx ON public.investor_loans(investor_id);
CREATE INDEX investor_loans_user_idx ON public.investor_loans(user_id);
CREATE INDEX investor_loans_due_idx ON public.investor_loans(due_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_loans TO authenticated;
GRANT ALL ON public.investor_loans TO service_role;

ALTER TABLE public.investor_loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their investor loans"
  ON public.investor_loans FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_investor_loans_updated_at
  BEFORE UPDATE ON public.investor_loans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- TABLE: investor_payments
-- =========================
CREATE TABLE public.investor_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES public.investor_loans(id) ON DELETE CASCADE,
  investor_id uuid NOT NULL REFERENCES public.investors(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  paid_at timestamptz NOT NULL DEFAULT now(),
  method text,
  receipt_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX investor_payments_loan_idx ON public.investor_payments(loan_id);
CREATE INDEX investor_payments_investor_idx ON public.investor_payments(investor_id);
CREATE INDEX investor_payments_user_idx ON public.investor_payments(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.investor_payments TO authenticated;
GRANT ALL ON public.investor_payments TO service_role;

ALTER TABLE public.investor_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their investor payments"
  ON public.investor_payments FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================
-- FUNCTION: investor_portal_login
-- =========================
CREATE OR REPLACE FUNCTION public.investor_portal_login(_token uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _investor public.investors%rowtype;
  _loans jsonb;
  _branding jsonb;
  _owner jsonb;
BEGIN
  IF _token IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO _investor FROM public.investors
   WHERE access_token = _token AND status = 'active'
   LIMIT 1;
  IF _investor.id IS NULL THEN RETURN NULL; END IF;

  SELECT coalesce(jsonb_agg(row_payload ORDER BY (row_payload->>'due_date') ASC), '[]'::jsonb)
    INTO _loans
  FROM (
    SELECT jsonb_build_object(
      'id', l.id,
      'principal', l.principal,
      'interest_rate', l.interest_rate,
      'total_due', l.total_due,
      'paid_amount', l.paid_amount,
      'start_date', l.start_date,
      'due_date', l.due_date,
      'frequency', l.frequency,
      'status', l.status,
      'payment_method', l.payment_method,
      'paid_at', l.paid_at,
      'notes', l.notes,
      'created_at', l.created_at,
      'payments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', p.id, 'amount', p.amount, 'paid_at', p.paid_at,
          'method', p.method, 'receipt_url', p.receipt_url, 'notes', p.notes
        ) ORDER BY p.paid_at DESC)
        FROM public.investor_payments p WHERE p.loan_id = l.id
      ), '[]'::jsonb)
    ) AS row_payload
    FROM public.investor_loans l
    WHERE l.investor_id = _investor.id
  ) x;

  SELECT jsonb_build_object('name', p.name, 'pix_key', p.pix_key, 'pix_key_type', p.pix_key_type)
    INTO _owner
    FROM public.profiles p WHERE p.id = _investor.user_id;

  SELECT jsonb_build_object(
    'portal_title', s.portal_title,
    'portal_primary_color', s.portal_primary_color,
    'portal_contact_phone', s.portal_contact_phone,
    'portal_contact_email', s.portal_contact_email,
    'portal_logo_url', s.portal_logo_url,
    'company_name', s.company_name,
    'company_logo_url', s.company_logo_url
  ) INTO _branding FROM public.settings s WHERE s.user_id = _investor.user_id LIMIT 1;

  RETURN jsonb_build_object(
    'investor', jsonb_build_object(
      'id', _investor.id, 'name', _investor.name, 'email', _investor.email,
      'phone', _investor.phone, 'whatsapp', _investor.whatsapp,
      'cpf_cnpj', _investor.cpf_cnpj, 'avatar_url', _investor.avatar_url,
      'status', _investor.status
    ),
    'loans', _loans,
    'owner', coalesce(_owner, '{}'::jsonb),
    'branding', coalesce(_branding, '{}'::jsonb)
  );
END; $$;

REVOKE ALL ON FUNCTION public.investor_portal_login(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_portal_login(uuid) TO anon, authenticated;

-- =========================
-- FUNCTION: investor_regenerate_token
-- =========================
CREATE OR REPLACE FUNCTION public.investor_regenerate_token(_investor_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _new uuid := gen_random_uuid();
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  SELECT user_id INTO _owner FROM public.investors WHERE id = _investor_id;
  IF _owner IS NULL OR _owner <> auth.uid() THEN
    RAISE EXCEPTION 'permission denied';
  END IF;
  UPDATE public.investors SET access_token = _new, updated_at = now() WHERE id = _investor_id;
  RETURN _new;
END; $$;

REVOKE ALL ON FUNCTION public.investor_regenerate_token(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.investor_regenerate_token(uuid) TO authenticated;
