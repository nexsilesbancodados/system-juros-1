
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_clients_name_trgm
  ON public.clients USING gin (lower(name) gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_clients_fuzzy(
  _term text,
  _threshold real DEFAULT 0.2,
  _limit int DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  name text,
  email text,
  phone text,
  cpf_cnpj text,
  status text,
  avatar_url text,
  similarity real
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id, c.name, c.email, c.phone, c.cpf_cnpj, c.status, c.avatar_url,
    GREATEST(
      similarity(lower(c.name), lower(_term)),
      similarity(lower(coalesce(c.email,'')), lower(_term))
    )::real AS similarity
  FROM public.clients c
  WHERE c.user_id = auth.uid()
    AND (
      similarity(lower(c.name), lower(_term)) >= _threshold
      OR lower(c.name) ILIKE '%' || lower(_term) || '%'
      OR similarity(lower(coalesce(c.email,'')), lower(_term)) >= _threshold
    )
  ORDER BY similarity DESC, c.name ASC
  LIMIT _limit;
$$;
