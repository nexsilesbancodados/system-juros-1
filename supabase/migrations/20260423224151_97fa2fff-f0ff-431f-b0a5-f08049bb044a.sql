-- 1. Adicionar campo data de nascimento em clientes
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. Bucket de backups (privado)
INSERT INTO storage.buckets (id, name, public)
VALUES ('backups', 'backups', false)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS no bucket backups: cada usuário acessa apenas sua pasta (user_id/...)
DROP POLICY IF EXISTS "Users view own backups" ON storage.objects;
CREATE POLICY "Users view own backups"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own backups" ON storage.objects;
CREATE POLICY "Users delete own backups"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'backups' AND auth.uid()::text = (storage.foldername(name))[1]);

-- 4. Trigger: ao marcar parcela como paga, dispara edge function de recibo via pg_net
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.notify_installment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Só dispara quando muda de pendente -> pago
  IF NEW.status = 'paid' AND (OLD.status IS NULL OR OLD.status <> 'paid') THEN
    PERFORM net.http_post(
      url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-receipt',
      headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
      body := jsonb_build_object('installment_id', NEW.id, 'user_id', NEW.user_id)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_installment_paid ON public.contract_installments;
CREATE TRIGGER trg_installment_paid
AFTER UPDATE OF status ON public.contract_installments
FOR EACH ROW EXECUTE FUNCTION public.notify_installment_paid();

-- 5. Agendamento pg_cron — chama edge functions automaticamente
-- Remove jobs antigos se existirem
DO $$
BEGIN
  PERFORM cron.unschedule(jobname) FROM cron.job WHERE jobname IN (
    'auto-late-fees-daily', 'auto-notifications-daily', 'auto-collection-hourly',
    'check-overdue-daily', 'auto-subscription-daily', 'auto-backup-daily',
    'auto-birthday-daily', 'auto-credit-score-daily', 'auto-cleanup-weekly'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Helper: todos os jobs usam o mesmo header
-- Multas e juros - todo dia 03:00
SELECT cron.schedule('auto-late-fees-daily', '0 3 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-late-fees',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Notificações internas - todo dia 06:00
SELECT cron.schedule('auto-notifications-daily', '0 6 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-notifications',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Cobrança WhatsApp - de hora em hora (a função interna respeita bot_send_hour)
SELECT cron.schedule('auto-collection-hourly', '0 * * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-collection',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Verificar atrasos - todo dia 07:00
SELECT cron.schedule('check-overdue-daily', '0 7 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/check-overdue',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Assinaturas - todo dia 02:00
SELECT cron.schedule('auto-subscription-daily', '0 2 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-subscription-check',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Backup - todo dia 04:00
SELECT cron.schedule('auto-backup-daily', '0 4 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Aniversário - todo dia 09:00
SELECT cron.schedule('auto-birthday-daily', '0 9 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-birthday',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Score de crédito - todo dia 05:00
SELECT cron.schedule('auto-credit-score-daily', '0 5 * * *', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-credit-score',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);

-- Limpeza - toda segunda 01:00
SELECT cron.schedule('auto-cleanup-weekly', '0 1 * * 1', $job$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-cleanup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := '{}'::jsonb
  );
$job$);