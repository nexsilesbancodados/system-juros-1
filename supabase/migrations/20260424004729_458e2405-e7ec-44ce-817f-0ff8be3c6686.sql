-- Habilita extensões necessárias para agendamento HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Remove agendamento anterior se existir (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule('auto-backup-daily');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda backup diário às 03:00 UTC (00:00 BRT)
SELECT cron.schedule(
  'auto-backup-daily',
  '0 3 * * *',
  $$
  SELECT net.http_post(
    url := 'https://bnupitnrxyferelwroas.supabase.co/functions/v1/auto-backup',
    headers := '{"Content-Type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJudXBpdG5yeHlmZXJlbHdyb2FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUxNjU3MTUsImV4cCI6MjA5MDc0MTcxNX0.oFDPafl8-vTfEQ-a1KNgph8sTO4zynEH9_erKycncWg"}'::jsonb,
    body := jsonb_build_object('time', now())
  );
  $$
);