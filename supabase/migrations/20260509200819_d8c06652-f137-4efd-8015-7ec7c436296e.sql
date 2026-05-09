UPDATE public.settings 
SET hubla_checkout_url = 'https://pay.hub.la/1zy88yhkEcKbJeVkTJDH/upsell'
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);