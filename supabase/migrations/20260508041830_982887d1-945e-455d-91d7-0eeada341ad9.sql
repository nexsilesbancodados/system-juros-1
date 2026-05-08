ALTER TABLE public.settings 
ALTER COLUMN whatsapp_api_url SET DEFAULT 'https://nexsiles-evolution-api.y7p1l4.easypanel.host/',
ALTER COLUMN whatsapp_api_key SET DEFAULT '429683C4C977415CAAFCCE10F7D57E11';

-- Update existing rows that have null settings
UPDATE public.settings 
SET 
  whatsapp_api_url = COALESCE(whatsapp_api_url, 'https://nexsiles-evolution-api.y7p1l4.easypanel.host/'),
  whatsapp_api_key = COALESCE(whatsapp_api_key, '429683C4C977415CAAFCCE10F7D57E11')
WHERE whatsapp_api_url IS NULL OR whatsapp_api_key IS NULL;