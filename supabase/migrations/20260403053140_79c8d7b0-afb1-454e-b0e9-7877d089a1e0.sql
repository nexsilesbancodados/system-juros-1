
ALTER TABLE public.settings
ADD COLUMN IF NOT EXISTS bot_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_auto_send boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_send_hour integer DEFAULT 9,
ADD COLUMN IF NOT EXISTS bot_send_minute integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS bot_max_messages_per_day integer DEFAULT 50,
ADD COLUMN IF NOT EXISTS bot_work_days jsonb DEFAULT '["mon","tue","wed","thu","fri"]'::jsonb,
ADD COLUMN IF NOT EXISTS bot_escalation_rules jsonb DEFAULT '[{"days":0,"template":"lembrete","channel":"whatsapp"},{"days":1,"template":"cobranca_1d","channel":"whatsapp"},{"days":3,"template":"cobranca_3d","channel":"whatsapp"},{"days":7,"template":"cobranca_7d","channel":"whatsapp"},{"days":15,"template":"cobranca_15d","channel":"whatsapp"},{"days":30,"template":"cobranca_30d","channel":"whatsapp"}]'::jsonb,
ADD COLUMN IF NOT EXISTS bot_retry_interval_hours integer DEFAULT 24,
ADD COLUMN IF NOT EXISTS bot_stop_on_payment boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_notify_owner boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_greeting_message text DEFAULT 'Olá {nome}, aqui é do {empresa}.',
ADD COLUMN IF NOT EXISTS bot_closing_message text DEFAULT 'Qualquer dúvida, entre em contato. Obrigado!',
ADD COLUMN IF NOT EXISTS bot_send_pix boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS bot_send_receipt boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS bot_tone text DEFAULT 'formal';
