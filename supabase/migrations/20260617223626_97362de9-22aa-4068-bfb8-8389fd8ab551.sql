-- Etapa 1: Bot WhatsApp com function calling, handoff visível, auditoria de ações

-- 1) whatsapp_conversations: status do bot e handoff humano
ALTER TABLE public.whatsapp_conversations
  ADD COLUMN IF NOT EXISTS bot_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS human_takeover_at timestamptz,
  ADD COLUMN IF NOT EXISTS human_takeover_reason text;

-- Backfill: convos com bot_paused=true viram 'paused'
UPDATE public.whatsapp_conversations
SET bot_status = 'paused'
WHERE bot_paused = true AND bot_status = 'active';

-- 2) Tabela de auditoria de tool calls do bot
CREATE TABLE IF NOT EXISTS public.bot_actions_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  client_id uuid,
  conversation_id uuid,
  tool_name text NOT NULL,
  tool_input jsonb NOT NULL DEFAULT '{}'::jsonb,
  tool_output jsonb NOT NULL DEFAULT '{}'::jsonb,
  success boolean NOT NULL DEFAULT true,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.bot_actions_log TO authenticated;
GRANT ALL ON public.bot_actions_log TO service_role;

ALTER TABLE public.bot_actions_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own bot actions"
  ON public.bot_actions_log FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS bot_actions_log_user_created_idx
  ON public.bot_actions_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS bot_actions_log_client_idx
  ON public.bot_actions_log (client_id, created_at DESC);

-- 3) Índice para histórico longo do WhatsApp (consultas por cliente)
CREATE INDEX IF NOT EXISTS whatsapp_messages_conv_created_idx
  ON public.whatsapp_messages (conversation_id, created_at DESC);