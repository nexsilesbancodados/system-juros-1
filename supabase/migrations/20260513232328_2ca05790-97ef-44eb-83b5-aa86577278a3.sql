UPDATE public.profiles 
SET subscription_type = 'lifetime', 
    subscription_expires_at = '2099-12-31 23:59:59'
WHERE email = 'teste@gmail.com';