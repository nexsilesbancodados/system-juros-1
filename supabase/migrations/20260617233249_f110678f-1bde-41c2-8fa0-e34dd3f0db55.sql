ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS ai_category text,
  ADD COLUMN IF NOT EXISTS ai_severity text,
  ADD COLUMN IF NOT EXISTS ai_suggested_reply text,
  ADD COLUMN IF NOT EXISTS ai_triaged_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_category ON public.support_tickets(ai_category);
CREATE INDEX IF NOT EXISTS idx_support_tickets_ai_severity ON public.support_tickets(ai_severity);