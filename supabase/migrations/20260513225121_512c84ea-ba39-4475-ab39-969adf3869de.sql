UPDATE public.profiles 
SET is_admin = true, 
    subscription_type = 'lifetime',
    subscription_expires_at = '2099-12-31 23:59:59+00'
WHERE email = 'lopesgustavo4377@gmail.com';