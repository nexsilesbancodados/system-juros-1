INSERT INTO public.subscriptions (user_id, email, status, plan_name, current_period_end)
SELECT p.id, p.email, 'active', 'lifetime', '2099-12-31'::timestamptz
FROM public.profiles p
WHERE p.email = 'raspix.bet@gmail.com';

ALTER TABLE public.profiles DISABLE TRIGGER trg_protect_profile_admin_columns;
UPDATE public.profiles
SET subscription_expires_at = '2099-12-31'::timestamptz,
    subscription_type = 'lifetime'
WHERE email = 'raspix.bet@gmail.com';
ALTER TABLE public.profiles ENABLE TRIGGER trg_protect_profile_admin_columns;