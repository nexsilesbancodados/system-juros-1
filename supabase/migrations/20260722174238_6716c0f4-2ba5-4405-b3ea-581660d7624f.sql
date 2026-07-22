
ALTER TABLE public.settings
  ALTER COLUMN whatsapp_api_url SET DEFAULT 'https://credmiasapp-evolution-api.fqr8ne.easypanel.host/',
  ALTER COLUMN whatsapp_api_key SET DEFAULT '429683C4C977415CAAFCCE10F7D57E11';

UPDATE public.settings
SET whatsapp_api_url = 'https://credmiasapp-evolution-api.fqr8ne.easypanel.host/',
    whatsapp_api_key = '429683C4C977415CAAFCCE10F7D57E11'
WHERE whatsapp_api_url IS NULL
   OR whatsapp_api_url = ''
   OR whatsapp_api_url LIKE '%nexsiles-evolution-api%';

UPDATE public.whatsapp_instances
SET api_url = 'https://credmiasapp-evolution-api.fqr8ne.easypanel.host/',
    api_key = '429683C4C977415CAAFCCE10F7D57E11'
WHERE api_url LIKE '%nexsiles-evolution-api%';
