
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE FUNCTION public.list_public_profiles()
RETURNS TABLE(id uuid, name text, avatar_url text, is_admin boolean, is_chat_blocked boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name, p.avatar_url, p.is_admin, p.is_chat_blocked
  FROM public.profiles p
$$;

REVOKE EXECUTE ON FUNCTION public.list_public_profiles() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_public_profiles() TO authenticated;
