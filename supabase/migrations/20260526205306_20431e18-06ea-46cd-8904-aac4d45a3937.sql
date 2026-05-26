
-- ===== Tags + intent on conversation =====
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS last_intent TEXT;

CREATE INDEX IF NOT EXISTS idx_wa_conv_tags ON public.whatsapp_conversations USING GIN(tags);

-- ===== Internal notes (per conversation) =====
CREATE TABLE IF NOT EXISTS public.whatsapp_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  author_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_notes TO authenticated;
GRANT ALL ON public.whatsapp_notes TO service_role;
ALTER TABLE public.whatsapp_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own wa notes" ON public.whatsapp_notes
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_wa_notes_convo ON public.whatsapp_notes(conversation_id, created_at DESC);

-- ===== Scheduled messages =====
CREATE TABLE IF NOT EXISTS public.whatsapp_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL,
  user_id UUID NOT NULL,
  text TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_scheduled_messages TO authenticated;
GRANT ALL ON public.whatsapp_scheduled_messages TO service_role;
ALTER TABLE public.whatsapp_scheduled_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own wa scheduled" ON public.whatsapp_scheduled_messages
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_wa_sched_pending ON public.whatsapp_scheduled_messages(status, scheduled_for) WHERE status = 'pending';

-- ===== Multi-instance WhatsApp =====
CREATE TABLE IF NOT EXISTS public.whatsapp_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  instance TEXT NOT NULL,
  api_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_instances TO authenticated;
GRANT ALL ON public.whatsapp_instances TO service_role;
ALTER TABLE public.whatsapp_instances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own wa instances" ON public.whatsapp_instances
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ===== Business hours on settings =====
ALTER TABLE public.settings
  ADD COLUMN IF NOT EXISTS bot_business_hours_only BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS bot_business_start TEXT DEFAULT '08:00',
  ADD COLUMN IF NOT EXISTS bot_business_end TEXT DEFAULT '18:00';

-- ===== Cron job: process scheduled messages every minute =====
-- (extensions pg_cron + pg_net already enabled in project)
DO $$ BEGIN
  PERFORM cron.unschedule('whatsapp-schedule-runner');
EXCEPTION WHEN OTHERS THEN NULL; END $$;

SELECT cron.schedule(
  'whatsapp-schedule-runner',
  '* * * * *',
  $$ SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/whatsapp-schedule-runner',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := jsonb_build_object('time', now())
  ); $$
);
