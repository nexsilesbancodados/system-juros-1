
CREATE OR REPLACE FUNCTION public.portal_lookup_creditor_contact(_cpf text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _clean_cpf text := regexp_replace(coalesce(_cpf, ''), '\D', '', 'g');
  _owner_id uuid;
  _out jsonb;
BEGIN
  IF length(_clean_cpf) < 11 THEN RETURN NULL; END IF;

  SELECT c.user_id INTO _owner_id
  FROM public.clients c
  WHERE regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g') = _clean_cpf
  ORDER BY c.created_at DESC LIMIT 1;

  IF _owner_id IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'company_name', s.company_name,
    'portal_contact_phone', s.portal_contact_phone,
    'portal_contact_email', s.portal_contact_email
  ) INTO _out
  FROM public.settings s WHERE s.user_id = _owner_id LIMIT 1;

  RETURN coalesce(_out, '{}'::jsonb);
END;
$$;

GRANT EXECUTE ON FUNCTION public.portal_lookup_creditor_contact(text) TO anon, authenticated;
