CREATE TABLE IF NOT EXISTS public.collection_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  client_id UUID,
  contract_id UUID,
  installment_id UUID,
  channel TEXT NOT NULL CHECK (channel IN ('whatsapp','email','sms','pix_copy','manual')),
  message_preview TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_user_inst ON public.collection_attempts(user_id, installment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_attempts_user_client ON public.collection_attempts(user_id, client_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.collection_attempts TO authenticated;
GRANT ALL ON public.collection_attempts TO service_role;
ALTER TABLE public.collection_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users manage own collection attempts"
  ON public.collection_attempts FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);