CREATE OR REPLACE FUNCTION public.portal_client_login_cpf(_cpf text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client public.clients%rowtype;
  _contracts jsonb;
  _owner jsonb;
  _branding jsonb;
BEGIN
  IF length(_clean_cpf) < 11 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO _client
  FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
  ORDER BY created_at DESC
  LIMIT 1;

  IF _client.id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT coalesce(jsonb_agg(contract_payload ORDER BY (contract_payload->>'created_at')::timestamptz DESC), '[]'::jsonb)
  INTO _contracts
  FROM (
    SELECT jsonb_build_object(
      'id', c.id,
      'capital', c.capital,
      'interest_rate', c.interest_rate,
      'num_installments', c.num_installments,
      'installment_amount', c.installment_amount,
      'frequency', c.frequency,
      'start_date', c.start_date,
      'status', c.status,
      'total_amount', c.total_amount,
      'total_interest', c.total_interest,
      'payment_method', c.payment_method,
      'created_at', c.created_at,
      'installments', coalesce((
        SELECT jsonb_agg(jsonb_build_object(
          'id', i.id,
          'installment_number', i.installment_number,
          'amount', i.amount,
          'due_date', i.due_date,
          'paid_at', i.paid_at,
          'paid_amount', i.paid_amount,
          'late_fee', i.late_fee,
          'status', i.status,
          'payment_method', i.payment_method,
          'receipt_url', i.receipt_url
        ) ORDER BY i.installment_number ASC, i.due_date ASC)
        FROM public.contract_installments i
        WHERE i.contract_id = c.id AND i.client_id = _client.id
      ), '[]'::jsonb)
    ) AS contract_payload
    FROM public.contracts c
    WHERE c.client_id = _client.id
  ) payload;

  SELECT jsonb_build_object('name', p.name, 'pix_key', p.pix_key, 'pix_key_type', p.pix_key_type)
  INTO _owner FROM public.profiles p WHERE p.id = _client.user_id;

  SELECT jsonb_build_object(
    'portal_title', s.portal_title,
    'portal_subtitle', s.portal_subtitle,
    'portal_welcome_message', s.portal_welcome_message,
    'portal_primary_color', s.portal_primary_color,
    'portal_contact_phone', s.portal_contact_phone,
    'portal_contact_email', s.portal_contact_email,
    'portal_logo_url', s.portal_logo_url,
    'company_name', s.company_name,
    'company_logo_url', s.company_logo_url
  )
  INTO _branding FROM public.settings s WHERE s.user_id = _client.user_id LIMIT 1;

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', _client.id, 'name', _client.name, 'email', _client.email,
      'phone', _client.phone, 'whatsapp', _client.whatsapp,
      'cpf_cnpj', _client.cpf_cnpj, 'status', _client.status, 'birth_date', _client.birth_date
    ),
    'contracts', _contracts,
    'owner', coalesce(_owner, '{}'::jsonb),
    'branding', coalesce(_branding, '{}'::jsonb)
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.portal_client_login_cpf(text) TO anon, authenticated;