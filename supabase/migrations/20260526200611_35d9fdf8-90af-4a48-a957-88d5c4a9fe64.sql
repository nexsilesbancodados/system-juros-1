
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS needs_human boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS blocked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS followup_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_human_handoff_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_convo_user_lastmsg
  ON public.whatsapp_conversations (user_id, last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_wa_msg_convo_created
  ON public.whatsapp_messages (conversation_id, created_at);
