ALTER TABLE public.settings 
ADD COLUMN IF NOT EXISTS bot_process_audio BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_process_receipts BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_auto_confirm_payment BOOLEAN DEFAULT false;
