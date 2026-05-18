
-- Índice funcional sobre os dígitos do CPF/CNPJ para busca O(log n)
CREATE INDEX IF NOT EXISTS idx_clients_cpf_cnpj_digits
  ON public.clients ((regexp_replace(coalesce(cpf_cnpj, ''), '\D', '', 'g')));

CREATE OR REPLACE FUNCTION public.search_clients_by_document(_document text)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  cpf_cnpj text,
  status text,
  avatar_url text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.email, c.phone, c.cpf_cnpj, c.status, c.avatar_url
  FROM public.clients c
  WHERE c.user_id = auth.uid()
    AND regexp_replace(coalesce(c.cpf_cnpj, ''), '\D', '', 'g')
        = regexp_replace(coalesce(_document, ''), '\D', '', 'g')
    AND length(regexp_replace(coalesce(_document, ''), '\D', '', 'g')) IN (11, 14)
  ORDER BY c.name ASC
  LIMIT 50;
$$;

REVOKE EXECUTE ON FUNCTION public.search_clients_by_document(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.search_clients_by_document(text) TO authenticated;
