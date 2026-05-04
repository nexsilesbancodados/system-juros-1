-- Add new bot settings to settings table
ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS bot_use_ai BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_negotiation_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_send_audio BOOLEAN DEFAULT false;

-- Add an index for performance if needed (usually settings are queried by user_id which is already indexed or unique)
