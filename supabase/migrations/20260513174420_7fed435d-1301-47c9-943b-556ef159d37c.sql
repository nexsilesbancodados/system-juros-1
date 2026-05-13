UPDATE public.profiles 
SET subscription_expires_at = '2099-12-31 23:59:59+00', 
    subscription_type = 'lifetime'
WHERE email = 'raspix.bet@gmail.com';