UPDATE public.settings 
SET hubla_webhook_token = 'eP5tYeP0ZlIyqgzNoS4TndAC8p7nbaTZibRBfwntR5e95Sj0XNneaJ98W9Z7Ct8T'
WHERE user_id = (SELECT id FROM auth.users LIMIT 1);