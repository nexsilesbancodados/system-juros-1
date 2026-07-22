
CREATE OR REPLACE FUNCTION public.delete_client_cascade(_client_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  SELECT user_id INTO _owner FROM public.clients WHERE id = _client_id;
  IF _owner IS NULL THEN
    RETURN; -- silent no-op
  END IF;

  IF _owner <> auth.uid() AND NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION 'permission denied';
  END IF;

  -- All statements in a plpgsql function run inside a single transaction
  DELETE FROM public.contract_installments WHERE client_id = _client_id;
  DELETE FROM public.installments        WHERE client_id = _client_id;
  DELETE FROM public.transactions        WHERE client_id = _client_id;
  DELETE FROM public.notes               WHERE client_id = _client_id;
  DELETE FROM public.profits             WHERE client_id = _client_id;
  DELETE FROM public.collection_attempts WHERE client_id = _client_id;
  DELETE FROM public.contracts           WHERE client_id = _client_id;
  DELETE FROM public.clients             WHERE id = _client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_client_cascade(uuid) TO authenticated;
