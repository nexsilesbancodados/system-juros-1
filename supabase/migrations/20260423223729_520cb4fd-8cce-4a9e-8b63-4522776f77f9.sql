-- Atualiza função is_admin para reconhecer super-admin por email
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT COALESCE(
    (SELECT (is_admin = true) OR (lower(email) = 'lopesgustavo4377@gmail.com')
     FROM public.profiles WHERE id = _user_id),
    false
  )
$function$;

-- Garante que o super-admin tenha a flag is_admin=true caso já exista
UPDATE public.profiles
SET is_admin = true
WHERE lower(email) = 'lopesgustavo4377@gmail.com';

-- Garante role 'admin' em user_roles para o super-admin (se a conta existir)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role FROM public.profiles
WHERE lower(email) = 'lopesgustavo4377@gmail.com'
ON CONFLICT DO NOTHING;