CREATE OR REPLACE FUNCTION public.portal_client_login(_cpf text, _birth_date date)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _client public.clients%rowtype;
  _contracts jsonb;
BEGIN
  IF length(_clean_cpf) < 11 OR _birth_date IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT *
  INTO _client
  FROM public.clients
  WHERE regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
    AND birth_date = _birth_date
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
          'status', i.status
        ) ORDER BY i.installment_number ASC, i.due_date ASC)
        FROM public.contract_installments i
        WHERE i.contract_id = c.id
          AND i.client_id = _client.id
      ), '[]'::jsonb)
    ) AS contract_payload
    FROM public.contracts c
    WHERE c.client_id = _client.id
  ) payload;

  RETURN jsonb_build_object(
    'client', jsonb_build_object(
      'id', _client.id,
      'name', _client.name,
      'email', _client.email,
      'phone', _client.phone,
      'whatsapp', _client.whatsapp,
      'cpf_cnpj', _client.cpf_cnpj,
      'status', _client.status,
      'birth_date', _client.birth_date
    ),
    'contracts', _contracts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.portal_client_login(text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.portal_client_login(text, date) TO anon, authenticated;