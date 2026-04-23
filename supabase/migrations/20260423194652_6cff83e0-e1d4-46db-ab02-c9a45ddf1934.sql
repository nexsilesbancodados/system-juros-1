UPDATE public.profiles
SET is_admin = true, is_blocked = false
WHERE email = 'lopesgustavo4377@gmail.com';

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM public.profiles
WHERE email = 'lopesgustavo4377@gmail.com'
ON CONFLICT DO NOTHING;